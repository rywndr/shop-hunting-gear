import "server-only"

import { randomUUID } from "node:crypto"
import { and, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { canAccessAdmin, getCurrentSession } from "@/lib/auth/session"
import { customerOrder, customerOrderItem } from "@/lib/db/schema/order"
import {
  returnPhoto,
  returnRefund,
  returnRequest,
  returnRequestItem,
} from "@/lib/db/schema/return"
import { invalidateStorefrontProducts } from "@/lib/products/cache"
import { isReturnEligible } from "./eligibility"
import {
  RETURN_WINDOW_MS,
  type AdminReturnRequest,
  type CustomerReturnState,
  type ReturnReason,
} from "./config"
import { RETURN_PHOTO_LIMITS } from "./schema"
import type { ReturnReviewInput } from "./schema"

export async function customerReturnStates({
  userId,
  orderIds,
}: {
  readonly userId: string
  readonly orderIds: readonly string[]
}): Promise<ReadonlyMap<string, CustomerReturnState>> {
  if (orderIds.length === 0) return new Map()
  const rows = await db
    .select({
      order: customerOrder,
      request: returnRequest,
      refund: returnRefund,
      currentTime: sql<string>`now()::text`,
    })
    .from(customerOrder)
    .leftJoin(returnRequest, eq(returnRequest.orderId, customerOrder.id))
    .leftJoin(returnRefund, eq(returnRefund.returnId, returnRequest.id))
    .where(
      and(
        eq(customerOrder.userId, userId),
        inArray(customerOrder.id, [...orderIds])
      )
    )
  return new Map(
    rows.map(({ order, request, refund, currentTime }) => [
      order.id,
      request
        ? {
            kind: "requested",
            id: request.id,
            status: request.status,
            note: request.note,
            refundStatus: refund?.status ?? null,
          }
        : {
            kind: isReturnEligible({
              ...order,
              hasRequest: false,
              now: new Date(currentTime),
            })
              ? "eligible"
              : "unavailable",
          },
    ])
  )
}

export async function createReturnRequest({
  userId,
  orderId,
  reason,
  details,
  photos,
  id = randomUUID(),
}: {
  readonly userId: string
  readonly orderId: string
  readonly reason: ReturnReason
  readonly details: string
  readonly photos: readonly {
    readonly id: string
    readonly objectKey: string
  }[]
  readonly id?: string
}) {
  if (photos.length < 1 || photos.length > RETURN_PHOTO_LIMITS.count)
    return { kind: "not-eligible" } as const
  const photoValues = sql.join(
    photos.map((photo) => sql`(${photo.id}::text, ${photo.objectKey}::text)`),
    sql`, `
  )
  // One claim per order, including rejections. The unique constraint arbitrates
  // concurrent submissions even when their statement snapshots predate the lock.
  const result = await db.execute<{ id: string }>(sql`
    WITH locked_order AS MATERIALIZED (
      SELECT * FROM customer_order WHERE id = ${orderId} AND user_id = ${userId} FOR UPDATE
    ), inserted AS (
      INSERT INTO return_request (id, order_id, reason, details)
      SELECT ${id}, id, ${reason}, ${details} FROM locked_order
      WHERE fulfillment_status = 'completed' AND payment_status = 'paid'
        AND coalesce(midtrans_refund_amount, 0) = 0 AND coalesce(midtrans_chargeback_amount, 0) = 0
        AND completed_at IS NOT NULL AND completed_at <= now() AND completed_at > now() - (${RETURN_WINDOW_MS} * interval '1 millisecond')
        AND EXISTS (SELECT 1 FROM customer_order_item WHERE order_id = locked_order.id)
      ON CONFLICT (order_id) DO NOTHING RETURNING id, order_id
    ), items AS (
      INSERT INTO return_request_item (id, return_id, order_item_id, quantity)
      SELECT gen_random_uuid()::text, inserted.id, item.id, item.quantity
      FROM inserted JOIN customer_order_item item ON item.order_id = inserted.order_id
      RETURNING id
    ), photos AS (
      INSERT INTO return_photo (id, return_id, object_key)
      SELECT photo.id, inserted.id, photo.object_key FROM inserted
      CROSS JOIN (VALUES ${photoValues}) photo(id, object_key) RETURNING id
    ) SELECT id FROM inserted
  `)
  if (result.rows[0]) return { kind: "created", id: result.rows[0].id } as const
  const states = await customerReturnStates({ userId, orderIds: [orderId] })
  return {
    kind:
      states.get(orderId)?.kind === "requested" ? "duplicate" : "not-eligible",
  } as const
}

// Call only after action authorization. SQL also checks the actor's current role.
export async function reviewReturn({
  actorId,
  input,
}: {
  readonly actorId: string
  readonly input: ReturnReviewInput
}) {
  if (input.kind !== "inspect") {
    const status = input.kind === "approve" ? "approved" : "rejected"
    const result = await db.execute<{ id: string }>(sql`
      WITH changed AS (
        UPDATE return_request SET status = ${status}, note = ${input.note}, reviewed_by = ${actorId}, reviewed_at = now()
        WHERE id = ${input.returnId} AND (status = 'requested' OR (status = 'approved' AND ${status} = 'rejected'))
          AND EXISTS (SELECT 1 FROM "user" WHERE id = ${actorId} AND role = 'admin')
        RETURNING id
      ), event AS (
        INSERT INTO return_event (return_id, actor_id, kind, detail)
        SELECT id, ${actorId}, ${status}, ${input.note} FROM changed
      ) SELECT id FROM changed
    `)
    return result.rows.length > 0
  }
  if (
    input.items.length === 0 ||
    new Set(input.items.map(({ id }) => id)).size !== input.items.length
  )
    return false
  const values = sql.join(
    input.items.map(
      (item) =>
        sql`(${item.id}::text, ${item.receivedQuantity}::integer, ${item.resellableQuantity}::integer)`
    ),
    sql`, `
  )
  const result = await db.execute<{ changed: number; restocked: number }>(sql`
    WITH locked_request AS MATERIALIZED (
      SELECT * FROM return_request WHERE id = ${input.returnId} FOR UPDATE
    ), input(id, received, resellable) AS (VALUES ${values}),
    eligible AS MATERIALIZED (
      SELECT r.id FROM locked_request r
      WHERE r.status = 'approved'
        AND EXISTS (SELECT 1 FROM "user" WHERE id = ${actorId} AND role = 'admin')
        AND (SELECT count(*) FROM return_request_item WHERE return_id = r.id) = ${input.items.length}
        AND (SELECT count(*) FROM return_request_item item JOIN input ON input.id = item.id
          WHERE item.return_id = r.id AND input.received = item.quantity AND input.resellable BETWEEN 0 AND input.received) = ${input.items.length}
        AND NOT EXISTS (
          SELECT 1 FROM return_request_item item JOIN input ON input.id = item.id
          JOIN customer_order_item original ON original.id = item.order_item_id
          WHERE item.return_id = r.id AND input.resellable > 0 AND NOT EXISTS (
            SELECT 1 FROM product p JOIN order_inventory_reservation reservation ON reservation.product_slug = p.slug
            WHERE p.slug = original.product_slug AND reservation.order_id = r.order_id AND reservation.status = 'consumed'
          )
        )
    ), inspected AS (
      UPDATE return_request r SET status = 'inspected', note = ${input.note}, inspected_at = now(), inspected_by = ${actorId}
      FROM eligible WHERE r.id = eligible.id AND r.status = 'approved' RETURNING r.id
    ), event AS (
      INSERT INTO return_event (return_id, actor_id, kind, detail)
      SELECT id, ${actorId}, 'inspected', ${input.note} FROM inspected
    ), items AS (
      UPDATE return_request_item item SET received_quantity = input.received, resellable_quantity = input.resellable
      FROM input, inspected WHERE item.id = input.id AND item.return_id = inspected.id RETURNING item.*
    ), restocks AS (
      INSERT INTO return_restock (return_item_id, product_id, quantity, actor_id)
      SELECT items.id, p.id, items.resellable_quantity, ${actorId}
      FROM items JOIN customer_order_item original ON original.id = items.order_item_id
      JOIN product p ON p.slug = original.product_slug WHERE items.resellable_quantity > 0
      ON CONFLICT (return_item_id) DO NOTHING RETURNING product_id, quantity
    ), stock AS (
      UPDATE product p SET stock = p.stock + amounts.quantity, updated_at = now()
      FROM (SELECT product_id, sum(quantity)::integer quantity FROM restocks GROUP BY product_id) amounts
      WHERE p.id = amounts.product_id RETURNING p.id
    ) SELECT (SELECT count(*)::integer FROM inspected) changed, (SELECT count(*)::integer FROM stock) restocked
  `)
  const row = result.rows[0]
  // db.execute's single statement has committed before invalidation.
  if (row && row.restocked > 0) invalidateStorefrontProducts()
  return (row?.changed ?? 0) > 0
}

export async function adminReturnRequests(
  orderIds: readonly string[]
): Promise<ReadonlyMap<string, AdminReturnRequest>> {
  if (!canAccessAdmin(await getCurrentSession()))
    throw new Error("Unauthorized return review access.")
  if (orderIds.length === 0) return new Map()
  const requests = await db
    .select({ request: returnRequest, refund: returnRefund })
    .from(returnRequest)
    .leftJoin(returnRefund, eq(returnRefund.returnId, returnRequest.id))
    .where(inArray(returnRequest.orderId, [...orderIds]))
  if (requests.length === 0) return new Map()
  const ids = requests.map(({ request }) => request.id)
  const [items, photos] = await Promise.all([
    db
      .select({ item: returnRequestItem, name: customerOrderItem.name })
      .from(returnRequestItem)
      .innerJoin(
        customerOrderItem,
        eq(customerOrderItem.id, returnRequestItem.orderItemId)
      )
      .where(inArray(returnRequestItem.returnId, ids)),
    db.select().from(returnPhoto).where(inArray(returnPhoto.returnId, ids)),
  ])
  return new Map(
    requests.map(
      ({ request, refund }) =>
        [
          request.orderId,
          {
            id: request.id,
            orderId: request.orderId,
            status: request.status,
            reason: request.reason,
            details: request.details,
            note: request.note,
            items: items
              .filter(({ item }) => item.returnId === request.id)
              .map(({ item, name }) => ({
                id: item.id,
                name,
                quantity: item.quantity,
                receivedQuantity: item.receivedQuantity,
                resellableQuantity: item.resellableQuantity,
              })),
            photos: photos
              .filter((photo) => photo.returnId === request.id)
              .map((photo) => ({
                id: photo.id,
                url: `/api/admin/returns/${request.id}/photos/${photo.id}`,
              })),
            refund: refund
              ? {
                  method: refund.method,
                  status: refund.status,
                  amount: refund.amount,
                  reference: refund.reference,
                  lastError: refund.lastError,
                }
              : null,
          },
        ] as const
    )
  )
}
