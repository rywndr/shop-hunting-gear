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
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
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
