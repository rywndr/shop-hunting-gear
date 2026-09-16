import "server-only"

import { randomUUID } from "node:crypto"

import { sql } from "drizzle-orm"

import { db } from "@/lib/db/client"

import {
  ACTIVE_CANCELLATION_STATUSES,
  type OrderCancellationActorType,
  type OrderCancellationFinancialAction,
  type OrderCancellationReconciliationStatus,
  type OrderCancellationStatus,
} from "./cancellation"

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
