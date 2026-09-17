import "server-only"

import { randomUUID } from "node:crypto"

import { sql } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { invalidateStorefrontProducts } from "@/lib/products/cache"

import {
  ACTIVE_CANCELLATION_STATUSES,
  type OrderCancellationActorType,
  type OrderCancellationFinancialAction,
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
    reconciliationStatus: row.reconciliation_status,
    lastError: row.last_error,
    requestedAt: row.requested_at,
    completedAt: row.completed_at,
  } satisfies OrderCancellationRecord
}

function authorizationSql({
  orderId,
  actorId,
  actorType,
}: Pick<RequestOrderCancellationInput, "orderId" | "actorId" | "actorType">) {
  return sql`
    current_order.id = ${orderId}
    AND actor.id = ${actorId}
    AND (
      (${actorType} = 'customer' AND actor.role = 'user'
        AND actor.id = current_order.user_id)
      OR (${actorType} = 'admin' AND actor.role = 'admin')
    )
  `
}

function activeCancellationStatusValues() {
  return sql.join(
    ACTIVE_CANCELLATION_STATUSES.map((status) => sql`${status}`),
    sql`, `
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
      current_order.fulfillment_status IN ('awaiting_payment', 'processing')
        AND (
          current_order.fulfillment_status <> 'processing'
          OR current_order.tracking IS NULL
        ) AS eligible
    FROM customer_order AS current_order
    INNER JOIN "user" AS actor ON true
    WHERE ${authorizationSql({ orderId, actorId, actorType })}
  `)
  const [order] = eligibility.rows

  return order ? { kind: "not-eligible" } : { kind: "not-found" }
}

export type AdminCancellationContext = {
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
  }
}

type AdminCancellationContextRow = CancellationSqlRow & {
  readonly source_kind: OrderSourceKind
  readonly payment_status: PaymentStatus
  readonly payment_init_status: "pending" | "creating" | "ready" | "failed"
  readonly fulfillment_status: FulfillmentStatus
  readonly tracking: string | null
  readonly snap_token: string | null
  readonly payment_session_expires_at: Date | null
  readonly midtrans_transaction_id: string | null
}

export async function adminCancellationContext({
  orderId,
  actorId,
}: {
  readonly orderId: string
  readonly actorId: string
}): Promise<AdminCancellationContext | null> {
  const result = await db.execute<AdminCancellationContextRow>(sql`
    SELECT cancellation.*, current_order.source_kind,
      current_order.payment_status, current_order.payment_init_status,
      current_order.fulfillment_status, current_order.tracking,
      current_order.snap_token, current_order.payment_session_expires_at,
      current_order.midtrans_transaction_id
    FROM order_cancellation AS cancellation
    INNER JOIN customer_order AS current_order
      ON current_order.id = cancellation.order_id
    INNER JOIN "user" AS actor
      ON actor.id = ${actorId} AND actor.role = 'admin'
    WHERE cancellation.order_id = ${orderId}
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
    },
  }
}

export async function selectCancellationProviderAction({
  cancellationId,
  actorId,
  providerIdempotencyKey,
  providerTransactionReference,
}: {
  readonly cancellationId: string
  readonly actorId: string
  readonly providerIdempotencyKey: string
  readonly providerTransactionReference: string | null
}): Promise<OrderCancellationRecord | null> {
  const result = await db.execute<CancellationSqlRow>(sql`
    WITH authorized AS MATERIALIZED (
      SELECT cancellation.id
      FROM order_cancellation AS cancellation
      INNER JOIN "user" AS actor
        ON actor.id = ${actorId} AND actor.role = 'admin'
      WHERE cancellation.id = ${cancellationId}
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

export async function recordCancellationReconciliationProblem({
  cancellationId,
  actorId,
  error,
}: {
  readonly cancellationId: string
  readonly actorId: string
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
    FROM "user" AS actor
    WHERE cancellation.id = ${cancellationId}
      AND actor.id = ${actorId}
      AND actor.role = 'admin'
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
  financialAction,
  providerTransactionReference = null,
}: {
  readonly cancellationId: string
  readonly actorId: string
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
      INNER JOIN "user" AS actor
        ON actor.id = ${actorId} AND actor.role = 'admin'
      WHERE cancellation.id = ${cancellationId}
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

export async function abandonOrderCancellation({
  cancellationId,
  actorId,
  error,
}: {
  readonly cancellationId: string
  readonly actorId: string
  readonly error: string
}): Promise<void> {
  await db.execute(sql`
    WITH abandoned AS (
      UPDATE order_cancellation AS cancellation
      SET status = 'failed', reconciliation_status = 'reconciled',
        last_error = ${error.slice(0, 1000)}, completed_at = null,
        updated_at = now()
      FROM "user" AS actor
      WHERE cancellation.id = ${cancellationId}
        AND actor.id = ${actorId}
        AND actor.role = 'admin'
        AND cancellation.status IN (${activeCancellationStatusValues()})
      RETURNING cancellation.order_id
    )
    UPDATE customer_order AS current_order
    SET cancellation_requested_at = null, updated_at = now()
    FROM abandoned
    WHERE current_order.id = abandoned.order_id
  `)
}
