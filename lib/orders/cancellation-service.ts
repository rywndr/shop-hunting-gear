import "server-only"

import { randomUUID } from "node:crypto"

import { sql } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { invalidateStorefrontProducts } from "@/lib/products/cache"
import type { MidtransStatusResponse } from "@/lib/payments/midtrans/schema"
import { matchingProviderRefund } from "@/lib/returns/refund-policy"

import {
  ACTIVE_CANCELLATION_STATUSES,
  type CancellationActor,
  type OrderCancellationActorType,
  type OrderCancellationFinancialAction,
  type OrderCancellationProviderSelectedStatus,
  type OrderCancellationReconciliationStatus,
  type OrderCancellationStatus,
} from "./cancellation"
import type {
  FulfillmentStatus,
  OrderSourceKind,
  PaymentStatus,
} from "./config"

export type RequestOrderCancellationInput = {
  readonly orderId: string
  readonly actorId: string
  readonly actorType: OrderCancellationActorType
  readonly reason: string
}

export type OrderCancellationRecord = {
  readonly id: string
  readonly orderId: string
  readonly actorId: string
  readonly actorType: OrderCancellationActorType
  readonly reason: string
  readonly status: OrderCancellationStatus
  readonly financialAction: OrderCancellationFinancialAction
  readonly refundAmount: number | null
  readonly providerIdempotencyKey: string | null
  readonly providerTransactionReference: string | null
  readonly providerSelectedStatus: OrderCancellationProviderSelectedStatus | null
  readonly reconciliationStatus: OrderCancellationReconciliationStatus
  readonly lastError: string | null
  readonly requestedAt: Date
  readonly completedAt: Date | null
}

export type RequestOrderCancellationResult =
  | {
      readonly kind: "created" | "existing"
      readonly cancellation: OrderCancellationRecord
    }
  | { readonly kind: "not-eligible" }
  | { readonly kind: "not-found" }

export type CustomerCancellationState =
  | { readonly kind: "none" }
  | { readonly kind: "processing" }
  | { readonly kind: "refund_pending" }
  | { readonly kind: "manual_refund_required" }
  | {
      readonly kind: "completed"
      readonly financialOutcome:
        | "cancelled_before_settlement"
        | "refund_confirmed"
        | "already_reversed"
        | "no_refund_required"
    }
  | { readonly kind: "failed" }

type CancellationSqlRow = {
  readonly result_kind: "created" | "existing"
  readonly id: string
  readonly order_id: string
  readonly actor_id: string
  readonly actor_type: OrderCancellationActorType
  readonly reason: string
  readonly status: OrderCancellationStatus
  readonly financial_action: OrderCancellationFinancialAction
  readonly refund_amount: number | null
  readonly provider_idempotency_key: string | null
  readonly provider_transaction_reference: string | null
  readonly provider_selected_status: OrderCancellationProviderSelectedStatus | null
  readonly reconciliation_status: OrderCancellationReconciliationStatus
  readonly last_error: string | null
  readonly requested_at: Date
  readonly completed_at: Date | null
}

function cancellationFromSqlRow(row: CancellationSqlRow) {
  return {
    id: row.id,
    orderId: row.order_id,
    actorId: row.actor_id,
    actorType: row.actor_type,
    reason: row.reason,
    status: row.status,
    financialAction: row.financial_action,
    refundAmount: row.refund_amount,
    providerIdempotencyKey: row.provider_idempotency_key,
    providerTransactionReference: row.provider_transaction_reference,
    providerSelectedStatus: row.provider_selected_status,
    reconciliationStatus: row.reconciliation_status,
    lastError: row.last_error,
    requestedAt: row.requested_at,
    completedAt: row.completed_at,
  } satisfies OrderCancellationRecord
}

function actorAuthorizationSql({
  actorId,
  actorType,
  orderUserId,
}: CancellationActor & { readonly orderUserId: ReturnType<typeof sql> }) {
  return sql`
    actor.id = ${actorId}
    AND (
      (${actorType} = 'customer' AND actor.role = 'user'
        AND actor.id = ${orderUserId})
      OR (${actorType} = 'admin' AND actor.role = 'admin')
    )
  `
}

function authorizationSql({
  orderId,
  actorId,
  actorType,
}: Pick<RequestOrderCancellationInput, "orderId" | "actorId" | "actorType">) {
  return sql`
    current_order.id = ${orderId}
    AND ${actorAuthorizationSql({
      actorId,
      actorType,
      orderUserId: sql`current_order.user_id`,
    })}
  `
}

function cancellationAuthorizationSql({
  cancellationId,
  actorId,
  actorType,
}: CancellationActor & { readonly cancellationId: string }) {
  return sql`
    cancellation.id = ${cancellationId}
    AND ${actorAuthorizationSql({
      actorId,
      actorType,
      orderUserId: sql`current_order.user_id`,
    })}
  `
}

function activeCancellationStatusValues() {
  return sql.join(
    ACTIVE_CANCELLATION_STATUSES.map((status) => sql`${status}`),
    sql`, `
  )
}

export async function customerCancellationStates({
  userId,
  orderIds,
}: {
  readonly userId: string
  readonly orderIds: readonly string[]
}): Promise<ReadonlyMap<string, CustomerCancellationState>> {
  if (orderIds.length === 0) return new Map()
  const ids = sql.join(
    orderIds.map((orderId) => sql`${orderId}`),
    sql`, `
  )
  const result = await db.execute<{
    readonly order_id: string
    readonly status: OrderCancellationStatus
    readonly financial_action: OrderCancellationFinancialAction
    readonly payment_status: PaymentStatus
  }>(sql`
    SELECT cancellation.order_id, cancellation.status,
      cancellation.financial_action, current_order.payment_status
    FROM order_cancellation AS cancellation
    INNER JOIN customer_order AS current_order
      ON current_order.id = cancellation.order_id
    INNER JOIN "user" AS actor ON actor.id = ${userId}
    WHERE current_order.id IN (${ids})
      AND actor.role = 'user'
      AND actor.id = current_order.user_id
  `)

  return new Map(
    result.rows.map((row) => {
      let state: CustomerCancellationState
      switch (row.status) {
        case "requested":
        case "provider_operation_pending":
          state = { kind: "processing" }
          break
        case "refund_pending":
          state = { kind: "refund_pending" }
          break
        case "manual_refund_required":
          state = { kind: "manual_refund_required" }
          break
        case "failed":
          state = { kind: "failed" }
          break
        case "completed":
          state = {
            kind: "completed",
            financialOutcome:
              row.financial_action === "refund"
                ? "refund_confirmed"
                : row.payment_status === "refunded"
                  ? "already_reversed"
                  : row.financial_action === "cancel_payment"
                    ? "cancelled_before_settlement"
                    : "no_refund_required",
          }
          break
        default: {
          const _exhaustive: never = row.status
          return _exhaustive
        }
      }
      return [row.order_id, state] as const
    })
  )
}

async function authorizedCancellation({
  orderId,
  actorId,
  actorType,
}: Pick<
  RequestOrderCancellationInput,
  "orderId" | "actorId" | "actorType"
>): Promise<OrderCancellationRecord | null> {
  const result = await db.execute<CancellationSqlRow>(sql`
    SELECT 'existing'::text AS result_kind, cancellation.*
    FROM customer_order AS current_order
    INNER JOIN "user" AS actor ON true
    INNER JOIN order_cancellation AS cancellation
      ON cancellation.order_id = current_order.id
    WHERE ${authorizationSql({ orderId, actorId, actorType })}
    LIMIT 1
  `)
  const [row] = result.rows

  return row ? cancellationFromSqlRow(row) : null
}

export async function requestOrderCancellation({
  orderId,
  actorId,
  actorType,
  reason,
}: RequestOrderCancellationInput): Promise<RequestOrderCancellationResult> {
  const normalizedReason = reason.trim()
  if (normalizedReason.length === 0 || normalizedReason.length > 1000) {
    throw new Error("Invalid cancellation reason.")
  }

  const result = await db.execute<CancellationSqlRow>(sql`
    WITH authorized_order AS MATERIALIZED (
      SELECT
        current_order.id,
        current_order.fulfillment_status,
        current_order.payment_status,
        current_order.tracking,
        actor.id AS actor_id
      FROM customer_order AS current_order
      INNER JOIN "user" AS actor ON true
      WHERE ${authorizationSql({ orderId, actorId, actorType })}
      FOR UPDATE OF current_order
    ),
    existing AS MATERIALIZED (
      SELECT cancellation.*
      FROM order_cancellation AS cancellation
      INNER JOIN authorized_order
        ON authorized_order.id = cancellation.order_id
    ),
    inserted AS (
      INSERT INTO order_cancellation (
        id,
        order_id,
        actor_id,
        actor_type,
        reason,
        status,
        financial_action,
        reconciliation_status
      )
      SELECT
        ${randomUUID()},
        authorized_order.id,
        authorized_order.actor_id,
        ${actorType},
        ${normalizedReason},
        'requested',
        'undetermined',
        'pending'
      FROM authorized_order
      WHERE NOT EXISTS (SELECT 1 FROM existing)
        AND (
          authorized_order.fulfillment_status = 'awaiting_payment'
          OR (
            authorized_order.fulfillment_status = 'processing'
            AND authorized_order.payment_status = 'paid'
            AND authorized_order.tracking IS NULL
          )
        )
      ON CONFLICT (order_id) DO NOTHING
      RETURNING *
    ),
    hold_set AS (
      UPDATE customer_order AS current_order
      SET
        cancellation_requested_at = coalesce(
          current_order.cancellation_requested_at,
          now()
        ),
        updated_at = now()
      FROM authorized_order
      WHERE current_order.id = authorized_order.id
        AND (
          EXISTS (SELECT 1 FROM inserted)
          OR EXISTS (
            SELECT 1
            FROM existing
            WHERE existing.status IN (${activeCancellationStatusValues()})
          )
        )
      RETURNING current_order.id
    )
    SELECT 'existing'::text AS result_kind, existing.*
    FROM existing
    WHERE EXISTS (SELECT 1 FROM hold_set)
    UNION ALL
    SELECT 'created'::text AS result_kind, inserted.*
    FROM inserted
    WHERE EXISTS (SELECT 1 FROM hold_set)
    LIMIT 1
  `)
  const [row] = result.rows

  if (row) {
    return {
      kind: row.result_kind,
      cancellation: cancellationFromSqlRow(row),
    }
  }

  const concurrent = await authorizedCancellation({
    orderId,
    actorId,
    actorType,
  })
  if (concurrent) {
    return { kind: "existing", cancellation: concurrent }
  }

  const eligibility = await db.execute<{ readonly eligible: boolean }>(sql`
    SELECT
      current_order.fulfillment_status = 'awaiting_payment'
        OR (
          current_order.fulfillment_status = 'processing'
          AND current_order.payment_status = 'paid'
          AND current_order.tracking IS NULL
        ) AS eligible
    FROM customer_order AS current_order
    INNER JOIN "user" AS actor ON true
    WHERE ${authorizationSql({ orderId, actorId, actorType })}
  `)
  const [order] = eligibility.rows

  return order ? { kind: "not-eligible" } : { kind: "not-found" }
}

export type CancellationContext = {
  readonly cancellation: OrderCancellationRecord
  readonly order: {
    readonly id: string
    readonly sourceKind: OrderSourceKind
    readonly paymentStatus: PaymentStatus
    readonly paymentInitStatus: "pending" | "creating" | "ready" | "failed"
    readonly fulfillmentStatus: FulfillmentStatus
    readonly tracking: string | null
    readonly snapToken: string | null
    readonly paymentSessionExpiresAt: Date | null
    readonly midtransTransactionId: string | null
    readonly grossAmount: number
  }
}

type CancellationContextRow = CancellationSqlRow & {
  readonly source_kind: OrderSourceKind
  readonly payment_status: PaymentStatus
  readonly payment_init_status: "pending" | "creating" | "ready" | "failed"
  readonly fulfillment_status: FulfillmentStatus
  readonly tracking: string | null
  readonly snap_token: string | null
  readonly payment_session_expires_at: Date | null
  readonly midtrans_transaction_id: string | null
  readonly gross_amount: number
}

export async function cancellationContextForActor({
  orderId,
  actorId,
  actorType,
}: CancellationActor & {
  readonly orderId: string
}): Promise<CancellationContext | null> {
  const result = await db.execute<CancellationContextRow>(sql`
    SELECT cancellation.*, current_order.source_kind,
      current_order.payment_status, current_order.payment_init_status,
      current_order.fulfillment_status, current_order.tracking,
      current_order.snap_token, current_order.payment_session_expires_at,
      current_order.midtrans_transaction_id, current_order.gross_amount
    FROM order_cancellation AS cancellation
    INNER JOIN customer_order AS current_order
      ON current_order.id = cancellation.order_id
    INNER JOIN "user" AS actor ON true
    WHERE ${authorizationSql({ orderId, actorId, actorType })}
    LIMIT 1
  `)
  const [row] = result.rows
  if (!row) return null

  return {
    cancellation: cancellationFromSqlRow({ ...row, result_kind: "existing" }),
    order: {
      id: row.order_id,
      sourceKind: row.source_kind,
      paymentStatus: row.payment_status,
      paymentInitStatus: row.payment_init_status,
      fulfillmentStatus: row.fulfillment_status,
      tracking: row.tracking,
      snapToken: row.snap_token,
      paymentSessionExpiresAt: row.payment_session_expires_at,
      midtransTransactionId: row.midtrans_transaction_id,
      grossAmount: row.gross_amount,
    },
  }
}

export async function selectCancellationProviderAction({
  cancellationId,
  actorId,
  actorType,
  providerIdempotencyKey,
  providerTransactionReference,
  providerSelectedStatus,
}: {
  readonly cancellationId: string
  readonly actorId: string
  readonly actorType: OrderCancellationActorType
  readonly providerIdempotencyKey: string
  readonly providerTransactionReference: string | null
  readonly providerSelectedStatus?: OrderCancellationProviderSelectedStatus
}): Promise<OrderCancellationRecord | null> {
  const shouldPromoteSnapSession =
    providerTransactionReference !== null &&
    (providerSelectedStatus === "pending" ||
      providerSelectedStatus === "authorize" ||
      providerSelectedStatus === "capture")
  const result = await db.execute<CancellationSqlRow>(sql`
    WITH authorized AS MATERIALIZED (
      SELECT cancellation.id
      FROM order_cancellation AS cancellation
      INNER JOIN customer_order AS current_order
        ON current_order.id = cancellation.order_id
      INNER JOIN "user" AS actor ON true
      WHERE ${cancellationAuthorizationSql({ cancellationId, actorId, actorType })}
      FOR UPDATE OF cancellation
    ), updated AS (
      UPDATE order_cancellation AS cancellation
      SET financial_action = 'cancel_payment',
        provider_idempotency_key = coalesce(
          cancellation.provider_idempotency_key,
          ${providerIdempotencyKey}
        ),
        provider_transaction_reference = coalesce(
          cancellation.provider_transaction_reference,
          ${providerTransactionReference}
        ),
        provider_selected_status = CASE
          WHEN cancellation.provider_selected_status = 'snap_session'
            AND cancellation.provider_transaction_reference IS NULL
            AND ${shouldPromoteSnapSession}
            THEN ${providerSelectedStatus ?? null}
          ELSE coalesce(
            cancellation.provider_selected_status,
            ${providerSelectedStatus ?? null}
          )
        END,
        status = 'provider_operation_pending',
        reconciliation_status = 'pending',
        last_error = null,
        updated_at = now()
      FROM authorized
      WHERE cancellation.id = authorized.id
        AND cancellation.status IN (${activeCancellationStatusValues()})
        AND cancellation.financial_action IN ('undetermined', 'cancel_payment')
      RETURNING cancellation.*
    )
    SELECT 'existing'::text AS result_kind, updated.* FROM updated
  `)
  const [row] = result.rows
  return row ? cancellationFromSqlRow(row) : null
}

export async function selectAlreadyReversedCancellationAction({
  cancellationId,
  actorId,
  actorType,
  providerTransactionReference,
}: {
  readonly cancellationId: string
  readonly actorId: string
  readonly actorType: OrderCancellationActorType
  readonly providerTransactionReference: string
}): Promise<OrderCancellationRecord | null> {
  const result = await db.execute<CancellationSqlRow>(sql`
    WITH authorized AS MATERIALIZED (
      SELECT cancellation.id
      FROM order_cancellation AS cancellation
      INNER JOIN customer_order AS current_order
        ON current_order.id = cancellation.order_id
      INNER JOIN "user" AS actor ON true
      WHERE ${cancellationAuthorizationSql({ cancellationId, actorId, actorType })}
      FOR UPDATE OF cancellation
    ), updated AS (
      UPDATE order_cancellation AS cancellation
      SET financial_action = 'none', refund_amount = NULL,
        provider_idempotency_key = NULL,
        provider_transaction_reference = coalesce(
          cancellation.provider_transaction_reference,
          ${providerTransactionReference}
        ),
        status = 'provider_operation_pending',
        reconciliation_status = 'pending', last_error = NULL,
        completed_at = NULL, updated_at = now()
      FROM authorized
      WHERE cancellation.id = authorized.id
        AND cancellation.status IN (${activeCancellationStatusValues()})
        AND cancellation.financial_action IN ('undetermined', 'none')
        AND cancellation.refund_amount IS NULL
        AND cancellation.provider_idempotency_key IS NULL
        AND (
          cancellation.provider_transaction_reference IS NULL
          OR cancellation.provider_transaction_reference =
            ${providerTransactionReference}
        )
      RETURNING cancellation.*
    )
    SELECT 'existing'::text AS result_kind, updated.* FROM updated
  `)
  const [row] = result.rows
  return row ? cancellationFromSqlRow(row) : null
}

export async function recordCancellationReconciliationProblem({
  cancellationId,
  actorId,
  actorType,
  error,
}: {
  readonly cancellationId: string
  readonly actorId: string
  readonly actorType: OrderCancellationActorType
  readonly error: string
}): Promise<void> {
  await db.execute(sql`
    UPDATE order_cancellation AS cancellation
    SET status = CASE
          WHEN cancellation.financial_action = 'cancel_payment'
            THEN 'provider_operation_pending'
          ELSE cancellation.status
        END,
        reconciliation_status = 'failed',
        last_error = ${error.slice(0, 1000)},
        updated_at = now()
    FROM customer_order AS current_order, "user" AS actor
    WHERE current_order.id = cancellation.order_id
      AND ${cancellationAuthorizationSql({ cancellationId, actorId, actorType })}
      AND cancellation.status IN (${activeCancellationStatusValues()})
  `)
}

export type CompleteUnpaidCancellationResult =
  | { readonly kind: "completed" | "already-completed" }
  | { readonly kind: "paid" | "not-eligible" | "not-found" }

type CompletionSqlRow = {
  readonly completed: number
  readonly status: OrderCancellationStatus | null
  readonly payment_status: PaymentStatus | null
  readonly fulfillment_status: FulfillmentStatus | null
}

export async function completeUnpaidOrderCancellation({
  cancellationId,
  actorId,
  actorType,
  financialAction,
  providerTransactionReference = null,
}: {
  readonly cancellationId: string
  readonly actorId: string
  readonly actorType: OrderCancellationActorType
  readonly financialAction: "none" | "cancel_payment"
  readonly providerTransactionReference?: string | null
}): Promise<CompleteUnpaidCancellationResult> {
  const result = await db.execute<CompletionSqlRow>(sql`
    WITH locked AS MATERIALIZED (
      SELECT cancellation.id AS cancellation_id, cancellation.status,
        cancellation.financial_action, cancellation.provider_idempotency_key,
        current_order.id AS order_id, current_order.payment_status,
        current_order.fulfillment_status, current_order.tracking
      FROM order_cancellation AS cancellation
      INNER JOIN customer_order AS current_order
        ON current_order.id = cancellation.order_id
      INNER JOIN "user" AS actor ON true
      WHERE ${cancellationAuthorizationSql({ cancellationId, actorId, actorType })}
      FOR UPDATE OF cancellation, current_order
    ), transitioned AS (
      UPDATE customer_order AS current_order
      SET payment_status = 'cancelled', fulfillment_status = 'cancelled',
        cancelled_at = coalesce(current_order.cancelled_at, now()),
        checkout_key = null, updated_at = now()
      FROM locked
      WHERE current_order.id = locked.order_id
        AND locked.fulfillment_status = 'awaiting_payment'
        AND locked.tracking IS NULL
        AND locked.payment_status NOT IN (
          'paid', 'partial_refund', 'refunded', 'partial_chargeback', 'chargeback'
        )
      RETURNING current_order.id
    ), released_stock AS (
      UPDATE product AS current_product
      SET stock = current_product.stock + reservation.quantity,
        updated_at = now()
      FROM order_inventory_reservation AS reservation
      INNER JOIN transitioned ON transitioned.id = reservation.order_id
      WHERE reservation.status = 'reserved'
        AND current_product.slug = reservation.product_slug
      RETURNING reservation.id
    ), released_reservations AS (
      UPDATE order_inventory_reservation AS reservation
      SET status = 'released', released_at = now()
      FROM transitioned
      WHERE transitioned.id = reservation.order_id
        AND reservation.status = 'reserved'
      RETURNING reservation.id
    ), completed AS (
      UPDATE order_cancellation AS cancellation
      SET status = 'completed',
        financial_action = ${financialAction},
        provider_transaction_reference = coalesce(
          cancellation.provider_transaction_reference,
          ${providerTransactionReference}
        ),
        reconciliation_status = CASE
          WHEN ${financialAction} = 'none' THEN 'not_required'
          ELSE 'reconciled'
        END,
        last_error = null,
        completed_at = coalesce(cancellation.completed_at, now()),
        updated_at = now()
      FROM locked
      WHERE cancellation.id = locked.cancellation_id
        AND cancellation.status IN (${activeCancellationStatusValues()})
        AND (
          EXISTS (SELECT 1 FROM transitioned)
          OR locked.fulfillment_status = 'cancelled'
        )
        AND (
          (${financialAction} = 'none'
            AND cancellation.financial_action IN ('undetermined', 'none'))
          OR (${financialAction} = 'cancel_payment'
            AND cancellation.financial_action = 'cancel_payment'
            AND cancellation.provider_idempotency_key IS NOT NULL)
        )
      RETURNING cancellation.id
    )
    SELECT
      (SELECT count(*)::integer FROM completed) AS completed,
      (SELECT status FROM locked) AS status,
      (SELECT payment_status FROM locked) AS payment_status,
      (SELECT fulfillment_status FROM locked) AS fulfillment_status
  `)
  const [row] = result.rows
  if (!row || row.status === null) return { kind: "not-found" }
  if (row.completed > 0) {
    invalidateStorefrontProducts()
    return { kind: "completed" }
  }
  if (row.status === "completed") return { kind: "already-completed" }
  if (
    row.payment_status === "paid" ||
    row.payment_status === "partial_refund" ||
    row.payment_status === "refunded" ||
    row.payment_status === "partial_chargeback" ||
    row.payment_status === "chargeback"
  ) {
    return { kind: "paid" }
  }
  return { kind: "not-eligible" }
}

export async function reactivateFailedPaidCancellation({
  orderId,
  actorId,
  actorType,
}: CancellationActor & {
  readonly orderId: string
}): Promise<OrderCancellationRecord | null> {
  const result = await db.execute<CancellationSqlRow>(sql`
    WITH locked AS MATERIALIZED (
      SELECT cancellation.id
      FROM order_cancellation AS cancellation
      INNER JOIN customer_order AS current_order
        ON current_order.id = cancellation.order_id
      INNER JOIN "user" AS actor ON true
      WHERE ${authorizationSql({ orderId, actorId, actorType })}
        AND cancellation.status = 'failed'
        AND cancellation.completed_at IS NULL
        AND cancellation.financial_action IN ('undetermined', 'none')
        AND cancellation.refund_amount IS NULL
        AND current_order.payment_status IN ('paid', 'partial_refund')
        AND current_order.fulfillment_status = 'processing'
        AND current_order.tracking IS NULL
      FOR UPDATE OF cancellation, current_order
    ), reactivated AS (
      UPDATE order_cancellation AS cancellation
      SET status = 'requested', financial_action = 'undetermined',
        provider_idempotency_key = NULL,
        provider_transaction_reference = NULL,
        provider_selected_status = NULL,
        reconciliation_status = 'pending', last_error = NULL,
        completed_at = NULL, updated_at = now()
      FROM locked
      WHERE cancellation.id = locked.id
      RETURNING cancellation.*
    ), hold_set AS (
      UPDATE customer_order AS current_order
      SET cancellation_requested_at = coalesce(cancellation_requested_at, now()),
        updated_at = now()
      FROM reactivated
      WHERE current_order.id = reactivated.order_id
    )
    SELECT 'existing'::text AS result_kind, reactivated.* FROM reactivated
  `)
  const [row] = result.rows
  return row ? cancellationFromSqlRow(row) : null
}

type CancellationRefundSelection =
  | {
      readonly kind: "online-refund"
      readonly refundKey: string
      readonly providerTransactionReference: string
    }
  | {
      readonly kind: "verified-offline-settlement"
      readonly providerTransactionReference: string
      readonly providerStatus: "settlement"
    }
  | {
      readonly kind: "manual-order-refund"
    }

export async function selectCancellationRefundAction({
  cancellationId,
  actorId,
  actorType,
  refundAmount,
  selection,
}: {
  readonly cancellationId: string
  readonly actorId: string
  readonly actorType: OrderCancellationActorType
  readonly refundAmount: number
  readonly selection: CancellationRefundSelection
}): Promise<OrderCancellationRecord | null> {
  const financialAction =
    selection.kind === "online-refund" ? "refund" : "manual_refund"
  const refundKey =
    selection.kind === "online-refund" ? selection.refundKey : null
  const providerTransactionReference =
    selection.kind === "manual-order-refund"
      ? null
      : selection.providerTransactionReference
  const verifiedOfflineSettlement =
    selection.kind === "verified-offline-settlement" &&
    selection.providerStatus === "settlement"
  const status =
    financialAction === "refund" ? "refund_pending" : "manual_refund_required"
  const result = await db.execute<CancellationSqlRow>(sql`
    WITH authorized AS MATERIALIZED (
      SELECT cancellation.id
      FROM order_cancellation AS cancellation
      INNER JOIN customer_order AS current_order
        ON current_order.id = cancellation.order_id
      INNER JOIN "user" AS actor ON true
      WHERE ${cancellationAuthorizationSql({ cancellationId, actorId, actorType })}
      FOR UPDATE OF cancellation
    ), updated AS (
      UPDATE order_cancellation AS cancellation
      SET financial_action = ${financialAction}, refund_amount = ${refundAmount},
        provider_idempotency_key = ${refundKey},
        provider_transaction_reference = coalesce(
          cancellation.provider_transaction_reference,
          ${providerTransactionReference}
        ),
        provider_selected_status = CASE
          WHEN cancellation.financial_action = 'cancel_payment'
            THEN cancellation.provider_selected_status
          WHEN ${financialAction} = 'refund' THEN 'settlement'
          ELSE cancellation.provider_selected_status
        END,
        status = ${status}, reconciliation_status = 'pending',
        last_error = NULL, completed_at = NULL, updated_at = now()
      FROM authorized
      WHERE cancellation.id = authorized.id
        AND cancellation.status IN (${activeCancellationStatusValues()})
        AND (cancellation.refund_amount IS NULL
          OR cancellation.refund_amount = ${refundAmount})
        AND (
          (${financialAction} = 'refund' AND (
            (cancellation.financial_action = 'undetermined'
              AND cancellation.provider_idempotency_key IS NULL)
            OR (cancellation.financial_action = 'refund'
              AND cancellation.provider_idempotency_key = ${refundKey})
            OR (cancellation.financial_action = 'cancel_payment'
              AND cancellation.provider_selected_status IN (
                'pending', 'authorize', 'capture', 'snap_session'
              )
              AND (
                cancellation.provider_transaction_reference =
                  ${providerTransactionReference}
                OR (cancellation.provider_selected_status = 'snap_session'
                  AND cancellation.provider_transaction_reference IS NULL)
              )
              AND ${refundKey}::text IS NOT NULL)
          ))
          OR (${financialAction} = 'manual_refund'
            AND (
              (cancellation.financial_action IN (
                'undetermined', 'manual_refund'
              ) AND cancellation.provider_idempotency_key IS NULL)
              OR (${verifiedOfflineSettlement}
                AND cancellation.financial_action = 'cancel_payment'
                AND cancellation.provider_selected_status IN (
                  'pending', 'authorize', 'capture', 'snap_session'
                )
                AND (
                  cancellation.provider_transaction_reference =
                    ${providerTransactionReference}
                  OR (cancellation.provider_selected_status = 'snap_session'
                    AND cancellation.provider_transaction_reference IS NULL)
                ))
            ))
        )
      RETURNING cancellation.*
    )
    SELECT 'existing'::text AS result_kind, updated.* FROM updated
  `)
  const [row] = result.rows
  return row ? cancellationFromSqlRow(row) : null
}

type CommitPaidCancellationResult =
  | { readonly kind: "committed" | "already-committed" }
  | { readonly kind: "not-eligible" | "not-found" }

export async function commitPaidCancellationOperation({
  cancellationId,
  actorId,
  actorType,
  completion,
}: {
  readonly cancellationId: string
  readonly actorId: string
  readonly actorType: OrderCancellationActorType
  readonly completion:
    | "cancel_confirmed"
    | "already_reversed"
    | "refund_pending"
    | "manual_refund_required"
}): Promise<CommitPaidCancellationResult> {
  const result = await db.execute<{
    transitioned: number
    status: OrderCancellationStatus | null
    fulfillment_status: FulfillmentStatus | null
  }>(sql`
    WITH locked AS MATERIALIZED (
      SELECT cancellation.*, current_order.fulfillment_status,
        current_order.tracking, current_order.payment_status
      FROM order_cancellation AS cancellation
      INNER JOIN customer_order AS current_order
        ON current_order.id = cancellation.order_id
      INNER JOIN "user" AS actor ON true
      WHERE ${cancellationAuthorizationSql({ cancellationId, actorId, actorType })}
      FOR UPDATE OF cancellation, current_order
    ), eligible AS (
      SELECT * FROM locked
      WHERE tracking IS NULL
        AND fulfillment_status IN ('processing', 'cancelled')
        AND payment_status IN ('paid', 'partial_refund', 'refunded')
        AND (
          (${completion} = 'cancel_confirmed'
            AND financial_action = 'cancel_payment'
            AND provider_selected_status IN ('pending', 'authorize', 'capture')
            AND provider_transaction_reference IS NOT NULL)
          OR (${completion} = 'refund_pending'
            AND financial_action = 'refund' AND refund_amount > 0
            AND provider_idempotency_key IS NOT NULL)
          OR (${completion} = 'manual_refund_required'
            AND financial_action = 'manual_refund' AND refund_amount > 0)
          OR (${completion} = 'already_reversed'
            AND financial_action = 'none' AND refund_amount IS NULL
            AND provider_idempotency_key IS NULL
            AND provider_transaction_reference IS NOT NULL)
        )
    ), transitioned AS (
      UPDATE customer_order AS current_order
      SET fulfillment_status = 'cancelled',
        payment_status = CASE WHEN ${completion} = 'cancel_confirmed'
          THEN 'cancelled' ELSE current_order.payment_status END,
        cancelled_at = coalesce(current_order.cancelled_at, now()),
        checkout_key = NULL, updated_at = now()
      FROM eligible
      WHERE current_order.id = eligible.order_id
      RETURNING current_order.id
    ), cancelled_reservations AS (
      UPDATE order_inventory_reservation AS reservation
      SET status = 'cancelled', released_at = coalesce(released_at, now())
      FROM transitioned
      WHERE reservation.order_id = transitioned.id
        AND reservation.status = 'consumed'
      RETURNING reservation.product_slug, reservation.quantity
    ), restored_inventory AS (
      UPDATE product AS current_product
      SET stock = current_product.stock + restored.quantity,
        sold = greatest(0, current_product.sold - restored.quantity),
        updated_at = now()
      FROM (
        SELECT product_slug, sum(quantity)::integer AS quantity
        FROM cancelled_reservations GROUP BY product_slug
      ) AS restored
      WHERE current_product.slug = restored.product_slug
    ), cancellation_updated AS (
      UPDATE order_cancellation AS cancellation
      SET status = CASE
          WHEN ${completion} IN ('cancel_confirmed', 'already_reversed')
            THEN 'completed'
          WHEN ${completion} = 'refund_pending' THEN 'refund_pending'
          ELSE 'manual_refund_required'
        END,
        reconciliation_status = CASE WHEN ${completion} IN (
            'cancel_confirmed', 'already_reversed'
          )
          THEN 'reconciled' ELSE 'pending' END,
        completed_at = CASE WHEN ${completion} IN (
            'cancel_confirmed', 'already_reversed'
          )
          THEN coalesce(cancellation.completed_at, now()) ELSE NULL END,
        last_error = NULL, updated_at = now()
      FROM eligible
      WHERE cancellation.id = eligible.id
        AND EXISTS (SELECT 1 FROM transitioned)
      RETURNING cancellation.id
    )
    SELECT (SELECT count(*)::integer FROM cancellation_updated) AS transitioned,
      (SELECT status FROM locked) AS status,
      (SELECT fulfillment_status FROM locked) AS fulfillment_status
  `)
  const [row] = result.rows
  if (!row || row.status === null) return { kind: "not-found" }
  if (row.transitioned > 0) {
    invalidateStorefrontProducts()
    return { kind: "committed" }
  }
  if (row.fulfillment_status === "cancelled")
    return { kind: "already-committed" }
  return { kind: "not-eligible" }
}

export async function reconcileCancellationRefund(
  payment: MidtransStatusResponse
): Promise<boolean> {
  const result = await db.execute<CancellationSqlRow>(sql`
    SELECT 'existing'::text AS result_kind, cancellation.*
    FROM order_cancellation AS cancellation
    WHERE cancellation.order_id = ${payment.order_id}
      AND cancellation.financial_action = 'refund'
      AND cancellation.status IN ('refund_pending', 'completed')
    LIMIT 1
  `)
  const [row] = result.rows
  if (!row) return false
  const cancellation = cancellationFromSqlRow(row)
  if (
    !cancellation.providerIdempotencyKey ||
    cancellation.refundAmount === null ||
    (cancellation.providerTransactionReference &&
      payment.transaction_id !== cancellation.providerTransactionReference)
  )
    return false
  const match = matchingProviderRefund({
    payment,
    refundKey: cancellation.providerIdempotencyKey,
    amount: cancellation.refundAmount,
  })
  if (!match) return false
  await db.execute(sql`
    UPDATE order_cancellation
    SET status = CASE WHEN ${match.bankConfirmedAt !== null}
        THEN 'completed' ELSE 'refund_pending' END,
      reconciliation_status = 'reconciled',
      completed_at = CASE WHEN ${match.bankConfirmedAt !== null}
        THEN coalesce(completed_at, now()) ELSE NULL END,
      last_error = NULL,
      updated_at = now()
    WHERE id = ${cancellation.id} AND status = 'refund_pending'
      AND financial_action = 'refund'
      AND provider_idempotency_key = ${cancellation.providerIdempotencyKey}
      AND refund_amount = ${cancellation.refundAmount}
  `)
  return true
}

export async function abandonOrderCancellation({
  cancellationId,
  actorId,
  actorType,
  error,
}: {
  readonly cancellationId: string
  readonly actorId: string
  readonly actorType: OrderCancellationActorType
  readonly error: string
}): Promise<void> {
  await db.execute(sql`
    WITH abandoned AS (
      UPDATE order_cancellation AS cancellation
      SET status = 'failed', reconciliation_status = 'reconciled',
        last_error = ${error.slice(0, 1000)}, completed_at = null,
        updated_at = now()
       FROM customer_order AS authorized_order, "user" AS actor
       WHERE authorized_order.id = cancellation.order_id
         AND cancellation.id = ${cancellationId}
         AND ${actorAuthorizationSql({
           actorId,
           actorType,
           orderUserId: sql`authorized_order.user_id`,
         })}
        AND cancellation.status IN (${activeCancellationStatusValues()})
      RETURNING cancellation.order_id
    )
    UPDATE customer_order AS current_order
    SET cancellation_requested_at = null, updated_at = now()
    FROM abandoned
    WHERE current_order.id = abandoned.order_id
  `)
}
