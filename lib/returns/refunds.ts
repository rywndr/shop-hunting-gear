import "server-only"

import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { user } from "@/lib/db/schema/auth"
import { customerOrder } from "@/lib/db/schema/order"
import { returnRefund, returnRequest } from "@/lib/db/schema/return"
import {
  getSnapTransactionStatus,
  MidtransApiError,
  refundMidtransTransaction,
} from "@/lib/payments/midtrans/client"
import type { MidtransStatusResponse } from "@/lib/payments/midtrans/schema"
import { applyMidtransPaymentUpdate } from "@/lib/orders/service"
import { grossAmountMatches } from "@/lib/payments/midtrans/reconciliation"
import {
  REFUND_RETRY_WINDOW_MS,
  matchingProviderRefund,
  returnRefundMethod,
  refundAmountInteger,
} from "./refund-policy"

async function authorizedActor(actorId: string) {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, actorId))
  return actor?.role === "admin"
}

async function refundRecord(returnId: string) {
  const [row] = await db
    .select({
      request: returnRequest,
      order: customerOrder,
      refund: returnRefund,
    })
    .from(returnRequest)
    .innerJoin(customerOrder, eq(customerOrder.id, returnRequest.orderId))
    .leftJoin(returnRefund, eq(returnRefund.returnId, returnRequest.id))
    .where(eq(returnRequest.id, returnId))
  return row
}

// Only GET status responses belong here, never the initial POST or notification.
export async function reconcileReturnRefunds(payment: MidtransStatusResponse) {
  const [order] = await db
    .select()
    .from(customerOrder)
    .where(eq(customerOrder.id, payment.order_id))
  if (
    !order ||
    order.sourceKind === "manual" ||
    !grossAmountMatches(payment.gross_amount, order.grossAmount) ||
    !["200", "201"].includes(payment.status_code) ||
    (order.midtransTransactionId &&
      payment.transaction_id !== order.midtransTransactionId)
  )
    throw new Error("Invalid refund reconciliation payment.")
  const isRefundStatus = ["refund", "partial_refund"].includes(
    payment.transaction_status.toLowerCase()
  )
  const cumulative = isRefundStatus
    ? refundAmountInteger(payment.refund_amount)
    : null
  if (isRefundStatus && (cumulative === null || cumulative > order.grossAmount))
    throw new Error("Invalid cumulative refund amount.")
  const rows = await db
    .select({ refund: returnRefund })
    .from(returnRefund)
    .innerJoin(returnRequest, eq(returnRequest.id, returnRefund.returnId))
    .where(eq(returnRequest.orderId, order.id))
  let candidate = rows[0]?.refund
  if (
    candidate?.status === "blocked" &&
    candidate.method === "midtrans" &&
    candidate.blockedReason === "unknown_payment_method"
  ) {
    const decision = returnRefundMethod({
      paymentType: payment.payment_type,
      amount: candidate.amount,
      grossAmount: order.grossAmount,
    })
    if (decision !== "unknown") {
      const method = decision === "offline" ? "offline" : "midtrans"
      const paymentType = payment.payment_type ?? "unknown"
      await db.execute(sql`
        WITH changed AS (
          UPDATE return_refund SET method = ${method}, status = 'ready', blocked_reason = NULL,
            lease_until = NULL, lease_token = NULL, last_error = NULL
          WHERE id = ${candidate.id} AND method = 'midtrans' AND status = 'blocked'
            AND blocked_reason = 'unknown_payment_method' AND provider_observed_amount = 0
            AND first_attempt_at IS NULL
            AND (lease_until IS NULL OR lease_until < now())
          RETURNING return_id
        ) INSERT INTO return_event (return_id, kind, detail)
          SELECT return_id, ${method === "offline" ? "refund_offline_required" : "refund_method_recovered"}, ${`Midtrans payment method reconciled: ${paymentType}.`} FROM changed
      `)
      const [recovered] = await db
        .select({ refund: returnRefund })
        .from(returnRefund)
        .where(eq(returnRefund.id, candidate.id))
      candidate = recovered?.refund
    }
  }
  if (!isRefundStatus) return
  if (cumulative === null) throw new Error("Invalid cumulative refund amount.")
  const match =
    candidate?.method === "midtrans"
      ? matchingProviderRefund({
          payment,
          refundKey: candidate.refundKey,
          amount: candidate.amount,
        })
      : null
  if (
    candidate?.method === "midtrans" &&
    payment.refunds?.some(
      (refund) => refund.refund_key === candidate.refundKey
    ) &&
    !match
  )
    throw new Error("Provider refund does not match the persisted attempt.")
  if (match && match.amount > cumulative)
    throw new Error("Refund exceeds provider cumulative amount.")
  // Repeated partial_refund snapshots can carry a newly confirmed individual
  // refund even when the existing payment state machine ignores the status.
  await db.execute(sql`
    WITH snapshot AS (
      UPDATE customer_order SET midtrans_refund_amount = greatest(coalesce(midtrans_refund_amount, 0), ${cumulative}), updated_at = now()
      WHERE id = ${order.id} AND payment_status IN ('paid','partial_refund','refunded','partial_chargeback','chargeback') RETURNING id
    ), changed AS (UPDATE return_refund SET
      provider_refund_id = ${match?.id ?? null},
      provider_observed_amount = ${match?.amount ?? 0},
      bank_confirmed_at = coalesce(bank_confirmed_at, ${match?.bankConfirmedAt?.toISOString() ?? null}::timestamptz),
      confirmed_at = CASE WHEN ${match?.bankConfirmedAt !== null && match !== null} THEN coalesce(confirmed_at, now()) ELSE confirmed_at END,
      status = CASE WHEN ${match?.bankConfirmedAt !== null && match !== null} THEN 'confirmed' ELSE 'pending' END,
      last_error = NULL,
      blocked_reason = NULL
    WHERE id = ${candidate?.id ?? null} AND method = 'midtrans' AND status <> 'confirmed'
      AND ${match !== null} AND EXISTS (SELECT 1 FROM snapshot)
      AND (provider_observed_amount = 0 OR (${match?.bankConfirmedAt?.toISOString() ?? null}::timestamptz IS NOT NULL AND bank_confirmed_at IS NULL))
      RETURNING return_id, status
    ) INSERT INTO return_event (return_id, kind, detail)
      SELECT return_id, 'refund_' || status, ${match?.id ?? ""} FROM changed
  `)
}

async function currentPayment(
  row: NonNullable<Awaited<ReturnType<typeof refundRecord>>>
) {
  const payment = await getSnapTransactionStatus({
    orderId: row.order.id,
    transactionId: row.order.midtransTransactionId,
  })
  if (
    payment.order_id !== row.order.id ||
    !grossAmountMatches(payment.gross_amount, row.order.grossAmount) ||
    (row.order.midtransTransactionId &&
      payment.transaction_id !== row.order.midtransTransactionId)
  )
    throw new Error("Refund payment does not match order.")
  await reconcileReturnRefunds(payment)
  await applyMidtransPaymentUpdate(payment)
  return payment
}

export async function refreshReturnRefund(returnId: string) {
  const row = await refundRecord(returnId)
  if (!row || row.order.sourceKind === "manual") return false
  await currentPayment(row)
  return true
}

// Both actions and SQL authorize admin mutations. No transaction spans a fetch.
export async function startReturnRefund({
  returnId,
  actorId,
}: {
  readonly returnId: string
  readonly actorId: string
}) {
  if (!(await authorizedActor(actorId))) return false
  let row = await refundRecord(returnId)
  if (!row || row.request.status !== "inspected") return false
  let payment: MidtransStatusResponse | null = null
  if (row.order.sourceKind !== "manual") payment = await currentPayment(row)
  // Read after reconciliation. It may have confirmed an earlier timed-out POST.
  row = await refundRecord(returnId)
  if (!row) return false
  if (row.refund?.status === "confirmed") return true
  if (row.refund?.status === "blocked") return false
  if (!row.refund) {
    const id = randomUUID()
    const merchandise = row.order.grossAmount - row.order.shippingCost
    // Use the fresh status only. Persisted payment types may describe an older
    // snapshot and must not turn an unidentified payment into a payout.
    const decision =
      row.order.sourceKind === "manual"
        ? "offline"
        : returnRefundMethod({
            paymentType: payment?.payment_type,
            amount: merchandise,
            grossAmount: row.order.grossAmount,
          })
    const method = decision === "offline" ? "offline" : "midtrans"
    const initialStatus = decision === "unknown" ? "blocked" : "ready"
    const preparationError =
      decision === "unknown"
        ? "Unknown Midtrans payment method. Reconcile before resolution."
        : null
    const blockedReason =
      decision === "unknown" ? "unknown_payment_method" : null
    // Price and amount come from persisted original items. An unrelated prior
    // provider reversal needs staff investigation, not another automatic payout.
    const result = await db.execute<{ id: string }>(sql`
      WITH locked_order AS MATERIALIZED (SELECT * FROM customer_order WHERE id = ${row.order.id} FOR UPDATE), inserted AS (
      INSERT INTO return_refund (id, return_id, method, status, blocked_reason, last_error, amount, refund_key, actor_id)
      SELECT ${id}, r.id, ${method}, ${initialStatus}, ${blockedReason}, ${preparationError}, amounts.amount, ${`return_${id}`}, ${actorId}
      FROM return_request r JOIN locked_order o ON o.id = r.order_id
      CROSS JOIN LATERAL (SELECT sum(i.quantity * original.price)::integer amount FROM return_request_item i
        JOIN customer_order_item original ON original.id = i.order_item_id
        WHERE i.return_id = r.id AND i.received_quantity = i.quantity) amounts
      WHERE r.id = ${returnId} AND r.status = 'inspected' AND o.payment_status = 'paid'
        AND amounts.amount > 0 AND amounts.amount = o.gross_amount - o.shipping_cost
        AND coalesce(o.midtrans_refund_amount, 0) = 0 AND coalesce(o.midtrans_chargeback_amount, 0) = 0
        AND EXISTS (SELECT 1 FROM "user" WHERE id = ${actorId} AND role = 'admin')
      ON CONFLICT (return_id) DO NOTHING RETURNING id, return_id
      ), event AS (
        INSERT INTO return_event (return_id, actor_id, kind, detail)
        SELECT return_id, ${actorId}, 'refund_prepared', ${method} FROM inserted
      ) SELECT id FROM inserted
    `)
    row = await refundRecord(returnId)
    if (!row?.refund) return false
    if (result.rows.length === 0 && row.refund.status === "confirmed")
      return true
  }
  if (!row.refund || row.refund.status === "blocked") return false
  if (row.refund.method === "offline") return true
  if (!payment?.transaction_id) return false
  const paymentDecision = returnRefundMethod({
    paymentType: payment.payment_type,
    amount: row.refund.amount,
    grossAmount: row.order.grossAmount,
  })
  if (paymentDecision !== "midtrans") {
    const unknownPaymentMethod = paymentDecision === "unknown"
    await db.execute(sql`UPDATE return_refund SET status = 'blocked', blocked_reason = CASE WHEN ${unknownPaymentMethod} AND provider_observed_amount = 0 AND first_attempt_at IS NULL THEN 'unknown_payment_method' ELSE NULL END, last_error = 'Midtrans payment method is not positively supported. Reconcile before resolution.'
      WHERE id = ${row.refund.id} AND status IN ('ready', 'pending') AND method = 'midtrans'
        AND (lease_until IS NULL OR lease_until < now())`)
    return false
  }
  const correlated = matchingProviderRefund({
    payment,
    refundKey: row.refund.refundKey,
    amount: row.refund.amount,
  })
  if (correlated) return true
  if (payment.transaction_status.toLowerCase() !== "settlement") return false
  const leaseToken = randomUUID()
  const claim = await db.execute<{ id: string; first_attempt: boolean }>(sql`
    WITH locked AS MATERIALIZED (SELECT * FROM return_refund WHERE id = ${row.refund.id} FOR UPDATE), claimed AS (
      UPDATE return_refund r SET status = 'pending', first_attempt_at = coalesce(r.first_attempt_at, now()), lease_until = now() + interval '30 seconds', lease_token = ${leaseToken}, last_error = NULL
      FROM locked WHERE r.id = locked.id AND locked.status IN ('ready', 'pending') AND locked.method = 'midtrans' AND locked.provider_observed_amount = 0
        AND (locked.lease_until IS NULL OR locked.lease_until < now())
        AND (locked.first_attempt_at IS NULL OR locked.first_attempt_at > now() - (${REFUND_RETRY_WINDOW_MS} * interval '1 millisecond'))
        AND EXISTS (SELECT 1 FROM "user" WHERE id = ${actorId} AND role = 'admin')
      RETURNING r.id, r.return_id, r.refund_key
    ), event AS (
      INSERT INTO return_event (return_id, actor_id, kind, detail)
      SELECT return_id, ${actorId}, 'refund_attempt', refund_key FROM claimed
    ) SELECT claimed.id, locked.first_attempt_at IS NULL AS first_attempt FROM claimed JOIN locked ON locked.id = claimed.id
  `)
  if (claim.rows.length === 0) {
    await db.execute(sql`UPDATE return_refund SET status = 'blocked', blocked_reason = NULL, last_error = 'Refund key retry window expired. Reconcile before manual resolution.'
      WHERE id = ${row.refund.id} AND method = 'midtrans' AND status IN ('ready', 'pending') AND provider_observed_amount = 0
        AND first_attempt_at <= now() - (${REFUND_RETRY_WINDOW_MS} * interval '1 millisecond')`)
    return false
  }
  let failure: unknown = null
  try {
    await refundMidtransTransaction({
      transactionId: payment.transaction_id,
      refundKey: row.refund.refundKey,
      amount: row.refund.amount,
      reason: "Pengembalian barang pesanan",
    })
  } catch (error) {
    failure = error
  }
  // Persist definitive failures before GET: an unavailable status endpoint must
  // not make the rejected POST retryable. Verified first-attempt 412 handling
  // below is the explicit audited resolution transition.
  const definitiveFailure =
    failure instanceof MidtransApiError &&
    !failure.retryable &&
    failure.providerStatusCode !== "406"
  if (definitiveFailure && failure instanceof MidtransApiError) {
    await db.execute(sql`UPDATE return_refund SET status = 'blocked', blocked_reason = NULL, last_error = ${`Midtrans ${failure.providerStatusCode ?? failure.status}.`}
      WHERE id = ${row.refund.id} AND lease_token = ${leaseToken} AND status <> 'confirmed'`)
  }
  // Success, duplicate ID, timeout and errors all require the same status read.
  let after: MidtransStatusResponse
  try {
    after = await currentPayment(row)
  } catch (error) {
    await db.execute(
      sql`UPDATE return_refund SET last_error = CASE WHEN status = 'blocked' THEN coalesce(last_error, '') || ' Status reconciliation unavailable.' ELSE 'Status reconciliation unavailable.' END WHERE id = ${row.refund.id} AND lease_token = ${leaseToken} AND status <> 'confirmed'`
    )
    throw error
  }
  const match = matchingProviderRefund({
    payment: after,
    refundKey: row.refund.refundKey,
    amount: row.refund.amount,
  })
  if (
    !match &&
    failure instanceof MidtransApiError &&
    failure.providerStatusCode === "412" &&
    claim.rows[0]?.first_attempt === true &&
    after.transaction_status.toLowerCase() === "settlement"
  ) {
    // A first attempt explicitly rejected as non-refundable, followed by GET
    // verification, may use the approved audited offline policy. Ambiguous
    // earlier attempts never reach this branch.
    await db.execute(sql`WITH changed AS (
      UPDATE return_refund SET method = 'offline', status = 'ready', lease_until = NULL, lease_token = NULL, last_error = 'Midtrans rejected refund eligibility.'
      WHERE id = ${row.refund.id} AND lease_token = ${leaseToken} AND status <> 'confirmed' AND provider_observed_amount = 0 RETURNING return_id
    ) INSERT INTO return_event (return_id, actor_id, kind, detail) SELECT return_id, ${actorId}, 'refund_offline_required', 'Midtrans 412; first attempt rejected and status verified.' FROM changed`)
    return true
  }
  const lastError = match
    ? null
    : failure instanceof MidtransApiError
      ? `Midtrans ${failure.providerStatusCode ?? failure.status ?? "timeout"}.`
      : failure
        ? "Refund request unavailable."
        : null
  await db.execute(sql`WITH changed AS (UPDATE return_refund SET lease_until = NULL, lease_token = NULL,
    last_error = ${lastError},
    blocked_reason = CASE WHEN ${match !== null || (!match && definitiveFailure)} THEN NULL ELSE blocked_reason END,
    status = CASE WHEN ${!match && definitiveFailure} THEN 'blocked' ELSE status END
    WHERE id = ${row.refund.id} AND lease_token = ${leaseToken} AND status <> 'confirmed' RETURNING return_id
    ) INSERT INTO return_event (return_id, actor_id, kind, detail)
      SELECT return_id, ${actorId}, 'refund_response', ${lastError ?? "Awaiting provider bank confirmation."} FROM changed`)
  return true
}

export async function confirmOfflineRefund({
  returnId,
  actorId,
  reference,
}: {
  readonly returnId: string
  readonly actorId: string
  readonly reference: string
}) {
  if (!(await authorizedActor(actorId))) return false
  const row = await refundRecord(returnId)
  if (!row?.refund || row.refund.method !== "offline") return false
  if (row.refund.status === "confirmed")
    return row.refund.reference === reference
  if (row.order.sourceKind !== "manual") await currentPayment(row)
  const result = await db.execute<{ id: string }>(sql`
    WITH locked_order AS MATERIALIZED (SELECT * FROM customer_order WHERE id = ${row.order.id} FOR UPDATE), changed AS (
      UPDATE return_refund refund SET status = 'confirmed', confirmed_at = now(), reference = ${reference}, actor_id = ${actorId}
      FROM return_request r, locked_order o WHERE r.id = refund.return_id AND r.id = ${returnId} AND r.status = 'inspected'
        AND r.order_id = o.id AND o.payment_status = 'paid' AND coalesce(o.midtrans_refund_amount, 0) = 0 AND coalesce(o.midtrans_chargeback_amount, 0) = 0
        AND refund.method = 'offline' AND refund.status = 'ready' AND length(trim(${reference})) > 0
        AND EXISTS (SELECT 1 FROM "user" WHERE id = ${actorId} AND role = 'admin') RETURNING refund.id, refund.return_id
    ), event AS (
      INSERT INTO return_event (return_id, actor_id, kind, detail)
      SELECT return_id, ${actorId}, 'refund_confirmed_offline', ${reference} FROM changed
    ) SELECT id FROM changed
  `)
  return result.rows.length > 0
}
