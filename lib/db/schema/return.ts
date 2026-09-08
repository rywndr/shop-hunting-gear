import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import type {
  RefundStatus,
  ReturnReason,
  ReturnStatus,
} from "@/lib/returns/config"

export type RefundBlockedReason = "unknown_payment_method"
import { customerOrder, customerOrderItem } from "./order"
import { product } from "./product"
import { user } from "./auth"

export const returnRequest = pgTable(
  "return_request",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => customerOrder.id),
    reason: text("reason").$type<ReturnReason>().notNull(),
    details: text("details").notNull(),
    status: text("status").$type<ReturnStatus>().default("requested").notNull(),
    note: text("note"),
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    inspectedBy: text("inspected_by").references(() => user.id),
    inspectedAt: timestamp("inspected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("returnRequest_orderId_uidx").on(t.orderId),
    index("returnRequest_status_createdAt_idx").on(t.status, t.createdAt),
    check(
      "returnRequest_status_valid",
      sql`${t.status} in ('requested','approved','rejected','inspected')`
    ),
    check(
      "returnRequest_reason_valid",
      sql`${t.reason} in ('damaged','defective','wrong_item','not_as_described')`
    ),
    check(
      "returnRequest_inspection_required",
      sql`${t.status} <> 'inspected' or (${t.inspectedAt} is not null and ${t.inspectedBy} is not null)`
    ),
  ]
)

export const returnEvent = pgTable(
  "return_event",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    returnId: text("return_id")
      .notNull()
      .references(() => returnRequest.id),
    actorId: text("actor_id").references(() => user.id),
    kind: text("kind").notNull(),
    detail: text("detail").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("returnEvent_returnId_createdAt_idx").on(t.returnId, t.createdAt),
  ]
)

export const returnRequestItem = pgTable(
  "return_request_item",
  {
    id: text("id").primaryKey(),
    returnId: text("return_id")
      .notNull()
      .references(() => returnRequest.id),
    orderItemId: text("order_item_id")
      .notNull()
      .references(() => customerOrderItem.id),
    quantity: integer("quantity").notNull(),
    receivedQuantity: integer("received_quantity"),
    resellableQuantity: integer("resellable_quantity"),
  },
  (t) => [
    uniqueIndex("returnRequestItem_orderItemId_uidx").on(t.orderItemId),
    index("returnRequestItem_returnId_idx").on(t.returnId),
    check(
      "returnRequestItem_quantities_valid",
      sql`${t.quantity} > 0 and (${t.receivedQuantity} is null or ${t.receivedQuantity} between 0 and ${t.quantity}) and (${t.resellableQuantity} is null or (${t.receivedQuantity} is not null and ${t.resellableQuantity} between 0 and ${t.receivedQuantity}))`
    ),
  ]
)

export const returnPhoto = pgTable(
  "return_photo",
  {
    id: text("id").primaryKey(),
    returnId: text("return_id")
      .notNull()
      .references(() => returnRequest.id),
    objectKey: text("object_key").notNull(),
  },
  (t) => [index("returnPhoto_returnId_idx").on(t.returnId)]
)

// A new post-sale stock event, never a reversal of the consumed reservation.
export const returnRestock = pgTable(
  "return_restock",
  {
    returnItemId: text("return_item_id")
      .primaryKey()
      .references(() => returnRequestItem.id),
    productId: text("product_id")
      .notNull()
      .references(() => product.id),
    quantity: integer("quantity").notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [check("returnRestock_quantity_positive", sql`${t.quantity} > 0`)]
)

export const returnRefund = pgTable(
  "return_refund",
  {
    id: text("id").primaryKey(),
    returnId: text("return_id")
      .notNull()
      .references(() => returnRequest.id),
    method: text("method").$type<"midtrans" | "offline">().notNull(),
    status: text("status").$type<RefundStatus>().default("ready").notNull(),
    amount: integer("amount").notNull(),
    // Persisted before any provider POST. Never rotate after an ambiguous result.
    refundKey: text("refund_key").notNull(),
    firstAttemptAt: timestamp("first_attempt_at", { withTimezone: true }),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    leaseToken: text("lease_token"),
    providerRefundId: text("provider_refund_id"),
    providerObservedAmount: integer("provider_observed_amount")
      .default(0)
      .notNull(),
    bankConfirmedAt: timestamp("bank_confirmed_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    reference: text("reference"),
    blockedReason: text("blocked_reason").$type<RefundBlockedReason | null>(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("returnRefund_returnId_uidx").on(t.returnId),
    uniqueIndex("returnRefund_refundKey_uidx").on(t.refundKey),
    check(
      "returnRefund_method_valid",
      sql`${t.method} in ('midtrans','offline')`
    ),
    check(
      "returnRefund_status_valid",
      sql`${t.status} in ('ready','pending','blocked','confirmed')`
    ),
    check(
      "returnRefund_blockedReason_valid",
      sql`${t.blockedReason} is null or (${t.blockedReason} = 'unknown_payment_method' and ${t.status} = 'blocked' and ${t.method} = 'midtrans')`
    ),
    check(
      "returnRefund_amount_valid",
      sql`${t.amount} > 0 and ${t.providerObservedAmount} between 0 and ${t.amount}`
    ),
    check(
      "returnRefund_confirmation_valid",
      sql`(${t.status} = 'confirmed') = (${t.confirmedAt} is not null) and (${t.status} <> 'confirmed' or (${t.method} = 'midtrans' and ${t.bankConfirmedAt} is not null) or (${t.method} = 'offline' and ${t.reference} is not null and length(trim(${t.reference})) > 0))`
    ),
  ]
)
