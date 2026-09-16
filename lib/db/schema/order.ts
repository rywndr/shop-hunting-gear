import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import type { CartVariant } from "@/lib/cart/config"
import type {
  FulfillmentStatus,
  OrderSourceKind,
  PaymentStatus,
} from "@/lib/orders/config"
import type {
  OrderCancellationActorType,
  OrderCancellationFinancialAction,
  OrderCancellationReconciliationStatus,
  OrderCancellationStatus,
} from "@/lib/orders/cancellation"
import type { ShippingCourierCode } from "@/lib/shipping/config"

import { user } from "./auth"
import { cartItem } from "./cart"
import { product } from "./product"

export type OrderAddressSnapshot = {
  readonly recipient: string
  readonly phone: string
  readonly street: string
  readonly province: string
  readonly city: string
  readonly district: string
  readonly subdistrict: string
  readonly postalCode: string
}

export const customerOrder = pgTable(
  "customer_order",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fulfillmentStatus: text("fulfillment_status")
      .$type<FulfillmentStatus>()
      .default("awaiting_payment")
      .notNull(),
    paymentStatus: text("payment_status")
      .$type<PaymentStatus>()
      .default("pending")
      .notNull(),
    paymentInitStatus: text("payment_init_status")
      .$type<"pending" | "creating" | "ready" | "failed">()
      .default("pending")
      .notNull(),
    checkoutKey: text("checkout_key"),
    // Manual orders do not use Midtrans idempotency keys.
    midtransCreateIdempotencyKey: text("midtrans_create_idempotency_key"),
    sourceKind: text("source_kind").$type<OrderSourceKind>().notNull(),
    customerNote: text("customer_note"),
    adminNote: text("admin_note"),
    shippingCourier: text("shipping_courier")
      .$type<ShippingCourierCode>()
      .notNull(),
    shippingCourierName: text("shipping_courier_name").notNull(),
    shippingService: text("shipping_service").notNull(),
    shippingCost: integer("shipping_cost").notNull(),
    grossAmount: integer("gross_amount").notNull(),
    tracking: text("tracking"),
    addressSnapshot: jsonb("address_snapshot")
      .$type<OrderAddressSnapshot>()
      .notNull(),
    snapToken: text("snap_token"),
    snapRedirectUrl: text("snap_redirect_url"),
    paymentSessionExpiresAt: timestamp("payment_session_expires_at", {
      withTimezone: true,
    }),
    midtransPaymentType: text("midtrans_payment_type"),
    midtransTransactionId: text("midtrans_transaction_id"),
    midtransTransactionStatus: text("midtrans_transaction_status"),
    midtransStatusCode: text("midtrans_status_code"),
    midtransFraudStatus: text("midtrans_fraud_status"),
    midtransRefundAmount: integer("midtrans_refund_amount"),
    midtransChargebackAmount: integer("midtrans_chargeback_amount"),
    midtransTransactionTime: timestamp("midtrans_transaction_time", {
      withTimezone: true,
    }),
    midtransSettlementTime: timestamp("midtrans_settlement_time", {
      withTimezone: true,
    }),
    placedAt: timestamp("placed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationRequestedAt: timestamp("cancellation_requested_at", {
      withTimezone: true,
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("customerOrder_userId_placedAt_idx").on(table.userId, table.placedAt),
    index("customerOrder_fulfillmentStatus_placedAt_idx").on(
      table.fulfillmentStatus,
      table.placedAt
    ),
    index("customerOrder_paymentStatus_placedAt_idx").on(
      table.paymentStatus,
      table.placedAt
    ),
    index("customerOrder_paymentSessionExpiresAt_idx").on(
      table.paymentSessionExpiresAt,
      table.fulfillmentStatus,
      table.paymentStatus
    ),
    uniqueIndex("customerOrder_checkoutKey_uidx").on(table.checkoutKey),
    check(
      "customerOrder_fulfillment_status_valid",
      sql`${table.fulfillmentStatus} in ('awaiting_payment', 'processing', 'shipped', 'completed', 'cancelled')`
    ),
    check(
      "customerOrder_payment_status_valid",
      sql`${table.paymentStatus} in ('pending', 'authorized', 'paid', 'failed', 'denied', 'cancelled', 'expired', 'partial_refund', 'refunded', 'partial_chargeback', 'chargeback')`
    ),
    check(
      "customerOrder_payment_init_status_valid",
      sql`${table.paymentInitStatus} in ('pending', 'creating', 'ready', 'failed')`
    ),
    check(
      "customerOrder_refund_amount_nonnegative",
      sql`${table.midtransRefundAmount} is null or ${table.midtransRefundAmount} >= 0`
    ),
    check(
      "customerOrder_chargeback_amount_nonnegative",
      sql`${table.midtransChargebackAmount} is null or ${table.midtransChargebackAmount} >= 0`
    ),
    check(
      "customerOrder_source_kind_valid",
      sql`${table.sourceKind} in ('cart', 'product', 'manual')`
    ),
    check(
      "customerOrder_create_idempotency_key_required",
      sql`${table.sourceKind} = 'manual' or ${table.midtransCreateIdempotencyKey} is not null`
    ),
    check(
      "customerOrder_shipping_cost_nonnegative",
      sql`${table.shippingCost} >= 0`
    ),
    check("customerOrder_gross_amount_positive", sql`${table.grossAmount} > 0`),
  ]
)

export const customerOrderItem = pgTable(
  "customer_order_item",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => customerOrder.id, { onDelete: "cascade" }),
    productSlug: text("product_slug").notNull(),
    name: text("name").notNull(),
    variants: jsonb("variants").$type<readonly CartVariant[]>().notNull(),
    quantity: integer("quantity").notNull(),
    price: integer("price").notNull(),
    cartItemId: text("cart_item_id").references(() => cartItem.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("customerOrderItem_orderId_idx").on(table.orderId),
    index("customerOrderItem_cartItemId_idx").on(table.cartItemId),
    check("customerOrderItem_quantity_positive", sql`${table.quantity} > 0`),
    check("customerOrderItem_price_positive", sql`${table.price} > 0`),
  ]
)

export const orderCancellation = pgTable(
  "order_cancellation",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => customerOrder.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    actorType: text("actor_type").$type<OrderCancellationActorType>().notNull(),
    reason: text("reason").notNull(),
    status: text("status")
      .$type<OrderCancellationStatus>()
      .default("requested")
      .notNull(),
    financialAction: text("financial_action")
      .$type<OrderCancellationFinancialAction>()
      .default("undetermined")
      .notNull(),
    refundAmount: integer("refund_amount"),
    providerIdempotencyKey: text("provider_idempotency_key"),
    providerTransactionReference: text("provider_transaction_reference"),
    reconciliationStatus: text("reconciliation_status")
      .$type<OrderCancellationReconciliationStatus>()
      .default("not_required")
      .notNull(),
    lastError: text("last_error"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("orderCancellation_orderId_uidx").on(table.orderId),
    uniqueIndex("orderCancellation_providerIdempotencyKey_uidx").on(
      table.providerIdempotencyKey
    ),
    index("orderCancellation_status_requestedAt_idx").on(
      table.status,
      table.requestedAt
    ),
    check(
      "orderCancellation_actor_type_valid",
      sql`${table.actorType} in ('customer', 'admin')`
    ),
    check(
      "orderCancellation_status_valid",
      sql`${table.status} in ('requested', 'provider_operation_pending', 'refund_pending', 'manual_refund_required', 'completed', 'failed')`
    ),
    check(
      "orderCancellation_financial_action_valid",
      sql`${table.financialAction} in ('undetermined', 'none', 'cancel_payment', 'refund', 'manual_refund')`
    ),
    check(
      "orderCancellation_refund_amount_valid",
      sql`(${table.financialAction} in ('refund', 'manual_refund') and ${table.refundAmount} > 0) or (${table.financialAction} in ('undetermined', 'none', 'cancel_payment') and ${table.refundAmount} is null)`
    ),
    check(
      "orderCancellation_provider_key_valid",
      sql`(${table.financialAction} in ('cancel_payment', 'refund') and ${table.providerIdempotencyKey} is not null) or (${table.financialAction} in ('undetermined', 'none', 'manual_refund') and ${table.providerIdempotencyKey} is null)`
    ),
    check(
      "orderCancellation_reconciliation_status_valid",
      sql`${table.reconciliationStatus} in ('not_required', 'pending', 'reconciled', 'failed')`
    ),
    check(
      "orderCancellation_completion_valid",
      sql`(${table.status} = 'completed') = (${table.completedAt} is not null)`
    ),
  ]
)

export type InventoryReservationStatus = "reserved" | "consumed" | "released"

export const orderInventoryReservation = pgTable(
  "order_inventory_reservation",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => customerOrder.id, { onDelete: "cascade" }),
    productSlug: text("product_slug")
      .notNull()
      .references(() => product.slug),
    quantity: integer("quantity").notNull(),
    status: text("status")
      .$type<InventoryReservationStatus>()
      .default("reserved")
      .notNull(),
    reservedAt: timestamp("reserved_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("orderInventoryReservation_orderId_productSlug_uidx").on(
      table.orderId,
      table.productSlug
    ),
    index("orderInventoryReservation_orderId_status_idx").on(
      table.orderId,
      table.status
    ),
    check(
      "orderInventoryReservation_quantity_positive",
      sql`${table.quantity} > 0`
    ),
    check(
      "orderInventoryReservation_status_valid",
      sql`${table.status} in ('reserved', 'consumed', 'released')`
    ),
  ]
)
