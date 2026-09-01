import "server-only"

import { createHash, randomUUID } from "node:crypto"

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm"

import { canAccessAdmin, getCurrentSession } from "@/lib/auth/session"
import type { CartItem } from "@/lib/cart/config"
import type { CheckoutSource } from "@/lib/checkout/config"
import { db } from "@/lib/db/client"
import {
  customerOrder,
  customerOrderItem,
  type OrderAddressSnapshot,
} from "@/lib/db/schema/order"
import { user } from "@/lib/db/schema/auth"
import type { Address } from "@/lib/account/types"
import { ALL_FILTER } from "@/lib/admin/config"
import type {
  OrderQueue,
  OrderQueueFilter,
  SalesOrder,
} from "@/lib/admin/orders"
import type { Transaction } from "@/lib/admin/finance"
import type {
  MidtransStatusResponse,
  SnapTransaction,
} from "@/lib/payments/midtrans/schema"
import {
  grossAmountMatches,
  classifyMidtransPayment,
  isRevenuePaymentStatus,
  paymentTransition,
} from "@/lib/payments/midtrans/reconciliation"
import { midtransIdempotencyKey } from "@/lib/payments/midtrans/client"
import { snapSessionExpiresAt } from "@/lib/payments/midtrans/config"
import type { ShippingCourierCode } from "@/lib/shipping/config"

import {
  type Order,
  type OrderItem,
  type OrderStatus,
  type PaymentStatus,
} from "./config"

export class UnknownOrderError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} does not exist.`)
    this.name = "UnknownOrderError"
  }
}

export class InvalidPaymentError extends Error {
  constructor(message = "Midtrans payment does not match the order.") {
    super(message)
    this.name = "InvalidPaymentError"
  }
}

export class InventoryUnavailableError extends Error {
  constructor() {
    super("The requested inventory is unavailable.")
    this.name = "InventoryUnavailableError"
  }
}

type CreateOrderItem = Pick<CartItem, "id" | "quantity" | "variants"> & {
  readonly product: Pick<CartItem["product"], "name" | "price" | "slug">
}

type CreateUnpaidOrderInput = {
  readonly userId: string
  readonly addressId: string
  readonly source: CheckoutSource
  readonly items: readonly CreateOrderItem[]
  readonly shipping: {
    readonly courier: ShippingCourierCode
    readonly courierName: string
    readonly service: string
    readonly cost: number
  }
  readonly address: Address
}

type OrderRow = typeof customerOrder.$inferSelect
type OrderItemRow = typeof customerOrderItem.$inferSelect

type PaymentOrder = Pick<
  OrderRow,
  | "id"
  | "userId"
  | "grossAmount"
  | "paymentStatus"
  | "paymentInitStatus"
  | "fulfillmentStatus"
  | "sourceKind"
  | "snapToken"
  | "snapRedirectUrl"
  | "paymentSessionExpiresAt"
  | "midtransCreateIdempotencyKey"
>

type JoinedOrderRow = {
  readonly order: OrderRow
  readonly item: OrderItemRow
  readonly buyer?: string
}

const REVENUE_PAYMENT_STATUSES: PaymentStatus[] = [
  "paid",
  "partial_refund",
  "refunded",
  "partial_chargeback",
  "chargeback",
]

function revenuePaymentStatusValues() {
  return sql.join(
    REVENUE_PAYMENT_STATUSES.map((status) => sql`${status}`),
    sql`, `
  )
}

function isUniqueViolation(error: unknown) {
  let current = error

  for (let depth = 0; depth < 4; depth += 1) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      current.code === "23505"
    ) {
      return true
    }

    if (!(current instanceof Error)) {
      return false
    }

    current = current.cause
  }

  return false
}

function variantLabel(variants: readonly { label: string; value: string }[]) {
  return variants.map(({ label, value }) => `${label}: ${value}`).join(", ")
}

function orderItemFromRow(row: OrderItemRow): OrderItem {
  return {
    name: row.name,
    variant: variantLabel(row.variants),
    quantity: row.quantity,
    price: row.price,
  }
}

function orderStatusForState({
  fulfillmentStatus,
  paymentStatus,
}: {
  readonly fulfillmentStatus: OrderRow["fulfillmentStatus"]
  readonly paymentStatus: OrderRow["paymentStatus"]
}): OrderStatus {
  switch (fulfillmentStatus) {
    case "awaiting_payment":
      return isRevenuePaymentStatus(paymentStatus)
        ? "processing"
        : paymentStatus === "failed" ||
            paymentStatus === "denied" ||
            paymentStatus === "cancelled" ||
            paymentStatus === "expired"
          ? "cancelled"
          : "unpaid"
    case "processing":
      return "processing"
    case "shipped":
      return "shipped"
    case "completed":
      return "completed"
    case "cancelled":
      return "cancelled"
    default: {
      const _exhaustive: never = fulfillmentStatus
      return _exhaustive
    }
  }
}

function orderStatusFromRow(row: OrderRow): OrderStatus {
  return orderStatusForState({
    fulfillmentStatus: row.fulfillmentStatus,
    paymentStatus: row.paymentStatus,
  })
}

function orderFromRow({
  order,
  items,
}: {
  readonly order: OrderRow
  readonly items: readonly OrderItemRow[]
}): Order {
  const status = orderStatusFromRow(order)

  return {
    id: order.id,
    status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    placedAt: order.placedAt.toISOString(),
    courier: `${order.shippingCourierName} ${order.shippingService}`,
    shipping: order.shippingCost,
    tracking: order.tracking,
    paymentToken:
      status === "unpaid" &&
      order.paymentInitStatus === "ready" &&
      (order.paymentSessionExpiresAt === null ||
        order.paymentSessionExpiresAt.getTime() > Date.now())
        ? order.snapToken
        : null,
    items: items.map(orderItemFromRow),
  }
}

function addressSnapshot(address: Address): OrderAddressSnapshot {
  return {
    recipient: address.recipient,
    phone: address.phone,
    street: address.street,
    province: address.province,
    city: address.city,
    district: address.district,
    subdistrict: address.subdistrict,
    postalCode: address.postalCode,
  }
}

function providerDate(value: string | null | undefined) {
  if (!value) return null

  const withTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value
    : `${value}+07:00`
  const date = new Date(withTimeZone)

  return Number.isNaN(date.getTime()) ? null : date
}

function safeIdrInteger(value: string | null | undefined) {
  if (value === undefined || value === null) return null

  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim())
  if (!match || (match[2] !== undefined && /[^0]/.test(match[2]))) {
    return null
  }
  const whole = match[1]

  try {
    const parsed = BigInt(whole)
    return parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : null
  } catch {
    return null
  }
}

function groupOrders(rows: readonly JoinedOrderRow[]): readonly SalesOrder[] {
  const grouped = new Map<
    string,
    {
      readonly order: OrderRow
      readonly buyer: string
      readonly items: OrderItemRow[]
    }
  >()

  for (const row of rows) {
    const existing = grouped.get(row.order.id)

    if (existing) {
      existing.items.push(row.item)
      continue
    }

    grouped.set(row.order.id, {
      order: row.order,
      buyer: row.buyer ?? "Pembeli",
      items: [row.item],
    })
  }

  return [...grouped.values()].map(({ buyer, order, items }) => ({
    buyer,
    order: orderFromRow({ order, items }),
  }))
}

function hasOrderItems(
  items: readonly OrderItem[]
): items is readonly [OrderItem, ...OrderItem[]] {
  return items.length > 0
}

function fulfillmentForStatus(status: OrderStatus): Transaction["fulfillment"] {
  switch (status) {
    case "processing":
      return "awaitingCompletion"
    case "shipped":
      return "inTransit"
    case "completed":
      return "completed"
    case "unpaid":
    case "cancelled":
      return "awaitingCompletion"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function checkoutFingerprint({
  userId,
  addressId,
  source,
  items,
  shipping,
  address,
}: CreateUnpaidOrderInput) {
  const canonical = {
    userId,
    addressId,
    source,
    items: items.map((item) => ({
      cartItemId: source.kind === "cart" ? item.id : null,
      productSlug: item.product.slug,
      quantity: item.quantity,
      price: item.product.price,
      variants: item.variants,
    })),
    shipping,
    address: addressSnapshot(address),
  }

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}

export function checkoutKeyForOrder(input: CreateUnpaidOrderInput) {
  return checkoutFingerprint(input)
}

function requestedProductValues(items: readonly CreateOrderItem[]) {
  const quantities = new Map<string, number>()

  for (const item of items) {
    quantities.set(
      item.product.slug,
      (quantities.get(item.product.slug) ?? 0) + item.quantity
    )
  }

  return [...quantities.entries()]
}

async function insertLocalOrder({
  orderId,
  checkoutKey,
  createIdempotencyKey,
  userId,
  source,
  items,
  shipping,
  address,
  grossAmount,
}: CreateUnpaidOrderInput & {
  readonly orderId: string
  readonly checkoutKey: string
  readonly createIdempotencyKey: string
  readonly grossAmount: number
}) {
  const requestedProducts = requestedProductValues(items)
  const productValues = sql.join(
    requestedProducts.map(
      ([productSlug, quantity]) => sql`(${productSlug}, ${quantity}::integer)`
    ),
    sql`, `
  )
  const itemValues = sql.join(
    items.map((item) => {
      const itemId = randomUUID()
      const cartItemId = source.kind === "cart" ? item.id : null

      return sql`(
        ${itemId},
        ${orderId},
        ${item.product.slug},
        ${item.product.name},
        ${JSON.stringify(item.variants)}::jsonb,
        ${item.quantity}::integer,
        ${item.product.price}::integer,
        ${cartItemId}
      )`
    }),
    sql`, `
  )
  const result = await db.execute<{ id: string }>(sql`
    WITH requested(product_slug, quantity) AS (
      VALUES ${productValues}
    ),
    locked_products AS (
      SELECT product.slug, product.stock
      FROM product
      INNER JOIN requested
        ON requested.product_slug = product.slug
      FOR UPDATE
    ),
    available AS (
      SELECT requested.product_slug, requested.quantity
      FROM requested
      INNER JOIN locked_products
        ON locked_products.slug = requested.product_slug
      WHERE locked_products.stock >= requested.quantity
    ),
    ready AS (
      SELECT 1 AS ok
      WHERE (
        SELECT count(*) FROM available
      ) = (
        SELECT count(*) FROM requested
      )
    ),
    created_order AS (
      INSERT INTO customer_order (
        id,
        user_id,
        fulfillment_status,
        payment_status,
        payment_init_status,
        checkout_key,
        midtrans_create_idempotency_key,
        source_kind,
        shipping_courier,
        shipping_courier_name,
        shipping_service,
        shipping_cost,
        gross_amount,
        address_snapshot
      )
      SELECT
        ${orderId},
        ${userId},
        'awaiting_payment',
        'pending',
        'pending',
        ${checkoutKey},
        ${createIdempotencyKey},
        ${source.kind},
        ${shipping.courier},
        ${shipping.courierName},
        ${shipping.service},
        ${shipping.cost},
        ${grossAmount},
        ${JSON.stringify(addressSnapshot(address))}::jsonb
      FROM ready
      RETURNING id
    ),
    created_items AS (
      INSERT INTO customer_order_item (
        id,
        order_id,
        product_slug,
        name,
        variants,
        quantity,
        price,
        cart_item_id
      )
      SELECT item.id, item.order_id, item.product_slug, item.name,
        item.variants, item.quantity, item.price, item.cart_item_id
      FROM (
        VALUES ${itemValues}
      ) AS item(
        id,
        order_id,
        product_slug,
        name,
        variants,
        quantity,
        price,
        cart_item_id
      )
      INNER JOIN created_order ON created_order.id = item.order_id
      RETURNING id
    ),
    reserved_stock AS (
      UPDATE product
      SET stock = product.stock - requested.quantity,
          updated_at = now()
      FROM requested
      INNER JOIN created_order ON true
      WHERE product.slug = requested.product_slug
      RETURNING product.slug
    ),
    created_reservations AS (
      INSERT INTO order_inventory_reservation (
        id,
        order_id,
        product_slug,
        quantity,
        status
      )
      SELECT md5(created_order.id || ':' || requested.product_slug),
        created_order.id,
        requested.product_slug,
        requested.quantity,
        'reserved'
      FROM requested
      INNER JOIN created_order ON true
      RETURNING id
    )
    SELECT created_order.id
    FROM created_order
    WHERE (
      SELECT count(*) FROM created_items
    ) = ${items.length}
      AND (
        SELECT count(*) FROM reserved_stock
      ) = (
        SELECT count(*) FROM requested
      )
      AND (
        SELECT count(*) FROM created_reservations
      ) = (
        SELECT count(*) FROM requested
      )
  `)

  const [row] = result.rows

  if (!row) {
    throw new InventoryUnavailableError()
  }

  return row.id
}

export async function paymentOrderForId(
  orderId: string
): Promise<PaymentOrder | null> {
  const [row] = await db
    .select({ order: customerOrder })
    .from(customerOrder)
    .where(eq(customerOrder.id, orderId))
    .limit(1)

  return row?.order ?? null
}

export async function paymentOrderForUser({
  userId,
  orderId,
}: {
  readonly userId: string
  readonly orderId: string
}): Promise<PaymentOrder | null> {
  const [row] = await db
    .select({ order: customerOrder })
    .from(customerOrder)
    .where(and(eq(customerOrder.id, orderId), eq(customerOrder.userId, userId)))
    .limit(1)

  return row?.order ?? null
}

const EXPIRED_SNAP_SESSION_BATCH_SIZE = 50

export async function expiredSnapSessionOrders({
  limit = EXPIRED_SNAP_SESSION_BATCH_SIZE,
  productSlugs,
}: {
  readonly limit?: number
  readonly productSlugs?: readonly string[]
} = {}): Promise<readonly PaymentOrder[]> {
  const safeLimit = Math.max(1, Math.floor(limit))
  const productCondition =
    productSlugs && productSlugs.length > 0
      ? sql`exists (
          select 1
          from order_inventory_reservation as reservation
          where reservation.order_id = ${customerOrder.id}
            and reservation.status = 'reserved'
            and reservation.product_slug in (${sql.join(
              productSlugs.map((productSlug) => sql`${productSlug}`),
              sql`, `
            )})
        )`
      : undefined
  const rows = await db
    .select({ order: customerOrder })
    .from(customerOrder)
    .where(
      and(
        eq(customerOrder.fulfillmentStatus, "awaiting_payment"),
        inArray(customerOrder.paymentStatus, ["pending", "authorized"]),
        isNotNull(customerOrder.snapToken),
        isNotNull(customerOrder.paymentSessionExpiresAt),
        lte(customerOrder.paymentSessionExpiresAt, new Date()),
        productCondition
      )
    )
    .orderBy(
      asc(customerOrder.paymentSessionExpiresAt),
      asc(customerOrder.placedAt)
    )
    .limit(safeLimit)

  return rows.map(({ order }) => order)
}

async function reusablePaymentOrder({
  userId,
  checkoutKey,
}: {
  readonly userId: string
  readonly checkoutKey: string
}) {
  const [row] = await db
    .select({ order: customerOrder })
    .from(customerOrder)
    .where(
      and(
        eq(customerOrder.userId, userId),
        eq(customerOrder.checkoutKey, checkoutKey),
        eq(customerOrder.fulfillmentStatus, "awaiting_payment"),
        notInArray(customerOrder.paymentStatus, REVENUE_PAYMENT_STATUSES)
      )
    )
    .limit(1)

  return row?.order ?? null
}

export async function createOrResumeUnpaidOrder(
  input: CreateUnpaidOrderInput
): Promise<PaymentOrder> {
  const checkoutKey = checkoutFingerprint(input)
  const existing = await reusablePaymentOrder({
    userId: input.userId,
    checkoutKey,
  })

  if (existing) return existing

  const orderId = `HG-${randomUUID()}`
  const grossAmount =
    input.items.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    ) + input.shipping.cost
  const createIdempotencyKey = midtransIdempotencyKey(orderId, "create")

  try {
    await insertLocalOrder({
      ...input,
      orderId,
      checkoutKey,
      createIdempotencyKey,
      grossAmount,
    })
  } catch (error) {
    if (!isUniqueViolation(error)) throw error

    const raced = await reusablePaymentOrder({
      userId: input.userId,
      checkoutKey,
    })

    if (!raced) throw error
    return raced
  }

  const created = await paymentOrderForId(orderId)

  if (!created) {
    throw new Error("Created order could not be loaded.")
  }

  return created
}

export async function saveSnapTransactionForOrder({
  userId,
  orderId,
  payment,
}: {
  readonly userId: string
  readonly orderId: string
  readonly payment: SnapTransaction
}): Promise<{
  readonly token: string
  readonly redirectUrl: string | null
} | null> {
  const paymentSessionExpiresAt = snapSessionExpiresAt(new Date())
  const [updated] = await db
    .update(customerOrder)
    .set({
      snapToken: payment.token,
      snapRedirectUrl: payment.redirect_url,
      paymentSessionExpiresAt: sql`coalesce(
        ${customerOrder.paymentSessionExpiresAt},
        ${paymentSessionExpiresAt}
      )`,
      paymentInitStatus: "ready",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(customerOrder.id, orderId),
        eq(customerOrder.userId, userId),
        eq(customerOrder.fulfillmentStatus, "awaiting_payment"),
        notInArray(customerOrder.paymentStatus, REVENUE_PAYMENT_STATUSES),
        sql`${customerOrder.snapToken} is null or ${customerOrder.snapToken} = ${payment.token}`
      )
    )
    .returning({
      token: customerOrder.snapToken,
      redirectUrl: customerOrder.snapRedirectUrl,
    })

  if (updated?.token) {
    return {
      token: updated.token,
      redirectUrl: updated.redirectUrl,
    }
  }

  const current = await paymentOrderForUser({ userId, orderId })

  if (!current) throw new UnknownOrderError(orderId)
  if (
    current.snapToken &&
    current.fulfillmentStatus === "awaiting_payment" &&
    !isRevenuePaymentStatus(current.paymentStatus)
  ) {
    return {
      token: current.snapToken,
      redirectUrl: current.snapRedirectUrl,
    }
  }

  return null
}

export async function markPaymentInitializationStarted({
  userId,
  orderId,
}: {
  readonly userId: string
  readonly orderId: string
}) {
  await db
    .update(customerOrder)
    .set({
      paymentInitStatus: "creating",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(customerOrder.id, orderId),
        eq(customerOrder.userId, userId),
        eq(customerOrder.fulfillmentStatus, "awaiting_payment"),
        notInArray(customerOrder.paymentStatus, REVENUE_PAYMENT_STATUSES),
        sql`${customerOrder.snapToken} is null`,
        inArray(customerOrder.paymentInitStatus, ["pending", "creating"])
      )
    )
}

// A retryable create response is ambiguous. Midtrans may have created a
// transaction even when this request did not return its token.
export async function markPaymentInitializationRetryableFailure({
  userId,
  orderId,
}: {
  readonly userId: string
  readonly orderId: string
}) {
  await db
    .update(customerOrder)
    .set({
      paymentInitStatus: "creating",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(customerOrder.id, orderId),
        eq(customerOrder.userId, userId),
        eq(customerOrder.fulfillmentStatus, "awaiting_payment"),
        notInArray(customerOrder.paymentStatus, REVENUE_PAYMENT_STATUSES),
        sql`${customerOrder.snapToken} is null`,
        inArray(customerOrder.paymentInitStatus, ["pending", "creating"])
      )
    )
}

type AtomicPaymentMutationResult = {
  readonly transitioned: number
  readonly payment_status: PaymentStatus | null
}

function atomicPaymentMutationResult(
  rows: readonly AtomicPaymentMutationResult[]
): AtomicPaymentMutationResult {
  const [row] = rows

  return (
    row ?? {
      transitioned: 0,
      payment_status: null,
    }
  )
}

async function releaseOrderInventory({
  userId,
  orderId,
  paymentStatus,
  paymentInitStatus,
  expectedPaymentStatus,
  expectedPaymentInitStatus,
  onlyWithoutSnapToken,
}: {
  readonly userId: string | null
  readonly orderId: string
  readonly paymentStatus: "failed" | "denied" | "cancelled" | "expired"
  readonly paymentInitStatus: "failed" | null
  readonly expectedPaymentStatus?: PaymentStatus
  readonly expectedPaymentInitStatus?: "pending" | "creating" | "failed"
  readonly onlyWithoutSnapToken?: boolean
}): Promise<AtomicPaymentMutationResult> {
  const userCondition = userId === null ? sql`` : sql`and user_id = ${userId}`
  const paymentInitAssignment =
    paymentInitStatus === null
      ? sql``
      : sql`payment_init_status = ${paymentInitStatus},`
  const expectedPaymentCondition =
    expectedPaymentStatus === undefined
      ? sql``
      : sql`and locked_order.payment_status = ${expectedPaymentStatus}`
  const expectedPaymentInitCondition =
    expectedPaymentInitStatus === undefined
      ? sql``
      : sql`and locked_order.payment_init_status = ${expectedPaymentInitStatus}`
  const snapTokenCondition = onlyWithoutSnapToken
    ? sql`and locked_order.snap_token is null`
    : sql``

  const result = await db.execute<AtomicPaymentMutationResult>(sql`
    WITH locked_order AS MATERIALIZED (
      SELECT
        id,
        payment_status,
        payment_init_status,
        fulfillment_status,
        snap_token
      FROM customer_order
      WHERE id = ${orderId}
        ${userCondition}
      FOR UPDATE
    ),
    transitioned AS (
      UPDATE customer_order AS current_order
      SET
        ${paymentInitAssignment}
        payment_status = ${paymentStatus},
        fulfillment_status = 'cancelled',
        cancelled_at = now(),
        checkout_key = null,
        updated_at = now()
      FROM locked_order
      WHERE current_order.id = locked_order.id
        AND locked_order.fulfillment_status = 'awaiting_payment'
        AND locked_order.payment_status NOT IN (${revenuePaymentStatusValues()})
        ${expectedPaymentCondition}
        ${expectedPaymentInitCondition}
        ${snapTokenCondition}
      RETURNING current_order.id
    ),
    released_stock AS (
      UPDATE product AS current_product
      SET
        stock = current_product.stock + reservation.quantity,
        updated_at = now()
      FROM order_inventory_reservation AS reservation
      INNER JOIN transitioned
        ON transitioned.id = reservation.order_id
      WHERE reservation.status = 'reserved'
        AND current_product.slug = reservation.product_slug
      RETURNING reservation.id
    ),
    released_reservations AS (
      UPDATE order_inventory_reservation AS reservation
      SET
        status = 'released',
        released_at = now()
      FROM transitioned
      WHERE transitioned.id = reservation.order_id
        AND reservation.status = 'reserved'
      RETURNING reservation.id
    )
    SELECT
      (SELECT count(*)::integer FROM transitioned) AS transitioned,
      (SELECT payment_status FROM locked_order) AS payment_status
  `)

  return atomicPaymentMutationResult(result.rows)
}

export async function failPaymentInitialization({
  userId,
  orderId,
}: {
  readonly userId: string
  readonly orderId: string
}) {
  await releaseOrderInventory({
    userId,
    orderId,
    paymentStatus: "failed",
    paymentInitStatus: "failed",
    expectedPaymentInitStatus: "creating",
    onlyWithoutSnapToken: true,
  })
}

function paymentFields(payment: MidtransStatusResponse) {
  return {
    midtransPaymentType: payment.payment_type ?? null,
    midtransTransactionId: payment.transaction_id ?? null,
    midtransTransactionStatus: payment.transaction_status,
    midtransStatusCode: payment.status_code,
    midtransFraudStatus: payment.fraud_status ?? null,
    midtransRefundAmount: safeIdrInteger(payment.refund_amount),
    midtransChargebackAmount: safeIdrInteger(payment.chargeback_amount),
    midtransTransactionTime: providerDate(payment.transaction_time),
    midtransSettlementTime: providerDate(payment.settlement_time),
    updatedAt: new Date(),
  }
}

function paymentColumnAssignments(payment: MidtransStatusResponse) {
  const fields = paymentFields(payment)

  return sql`
    midtrans_payment_type = ${fields.midtransPaymentType},
    midtrans_transaction_id = ${fields.midtransTransactionId},
    midtrans_transaction_status = ${fields.midtransTransactionStatus},
    midtrans_status_code = ${fields.midtransStatusCode},
    midtrans_fraud_status = ${fields.midtransFraudStatus},
    midtrans_refund_amount = ${fields.midtransRefundAmount},
    midtrans_chargeback_amount = ${fields.midtransChargebackAmount},
    midtrans_transaction_time = ${fields.midtransTransactionTime},
    midtrans_settlement_time = ${fields.midtransSettlementTime},
    updated_at = now()
  `
}

async function settlePaymentAtomically({
  payment,
}: {
  readonly payment: MidtransStatusResponse
}): Promise<AtomicPaymentMutationResult> {
  const paidAt =
    providerDate(payment.settlement_time) ??
    providerDate(payment.transaction_time) ??
    new Date()

  const result = await db.execute<AtomicPaymentMutationResult>(sql`
    WITH locked_order AS MATERIALIZED (
      SELECT id, user_id, payment_status, fulfillment_status
      FROM customer_order
      WHERE id = ${payment.order_id}
      FOR UPDATE
    ),
    released_totals AS MATERIALIZED (
      SELECT
        reservation.product_slug,
        sum(reservation.quantity)::integer AS quantity
      FROM order_inventory_reservation AS reservation
      INNER JOIN locked_order
        ON locked_order.id = reservation.order_id
      WHERE reservation.status = 'released'
      GROUP BY reservation.product_slug
    ),
    locked_products AS MATERIALIZED (
      SELECT current_product.slug, current_product.stock, released.quantity
      FROM product AS current_product
      INNER JOIN released_totals AS released
        ON released.product_slug = current_product.slug
      FOR UPDATE OF current_product
    ),
    settlement_candidate AS (
      SELECT locked_order.id, locked_order.user_id
      FROM locked_order
      WHERE locked_order.payment_status NOT IN (${revenuePaymentStatusValues()})
        AND NOT EXISTS (
          SELECT 1
          FROM released_totals AS released
          LEFT JOIN locked_products
            ON locked_products.slug = released.product_slug
          WHERE locked_products.slug IS NULL
            OR locked_products.stock < released.quantity
        )
    ),
    transitioned AS (
      UPDATE customer_order AS current_order
      SET
        ${paymentColumnAssignments(payment)},
        payment_status = 'paid',
        fulfillment_status = CASE
          WHEN current_order.fulfillment_status IN ('awaiting_payment', 'cancelled')
            THEN 'processing'
          ELSE current_order.fulfillment_status
        END,
        paid_at = coalesce(current_order.paid_at, ${paidAt}),
        cancelled_at = null,
        checkout_key = null
      FROM settlement_candidate
      WHERE current_order.id = settlement_candidate.id
      RETURNING current_order.id, current_order.user_id
    ),
    released_inventory AS (
      UPDATE order_inventory_reservation AS reservation
      SET
        status = 'consumed',
        consumed_at = now(),
        released_at = null
      FROM transitioned
      WHERE transitioned.id = reservation.order_id
        AND reservation.status = 'released'
      RETURNING reservation.product_slug, reservation.quantity
    ),
    reserved_inventory AS (
      UPDATE order_inventory_reservation AS reservation
      SET
        status = 'consumed',
        consumed_at = now(),
        released_at = null
      FROM transitioned
      WHERE transitioned.id = reservation.order_id
        AND reservation.status = 'reserved'
      RETURNING reservation.product_slug, reservation.quantity
    ),
    consumed_inventory AS (
      SELECT product_slug, quantity, true AS was_released
      FROM released_inventory
      UNION ALL
      SELECT product_slug, quantity, false AS was_released
      FROM reserved_inventory
    ),
    consumed_totals AS (
      SELECT
        product_slug,
        sum(quantity)::integer AS quantity,
        sum(
          CASE WHEN was_released THEN quantity ELSE 0 END
        )::integer AS released_quantity
      FROM consumed_inventory
      GROUP BY product_slug
    ),
    updated_inventory AS (
      UPDATE product AS current_product
      SET
        stock = current_product.stock - consumed.released_quantity,
        sold = current_product.sold + consumed.quantity,
        updated_at = now()
      FROM consumed_totals AS consumed
      WHERE current_product.slug = consumed.product_slug
      RETURNING current_product.slug
    ),
    cart_decrement AS (
      UPDATE cart_item AS current_cart
      SET
        quantity = current_cart.quantity - item.quantity,
        updated_at = now()
      FROM customer_order_item AS item
      INNER JOIN transitioned
        ON transitioned.id = item.order_id
      WHERE current_cart.id = item.cart_item_id
        AND current_cart.user_id = transitioned.user_id
        AND current_cart.quantity > item.quantity
      RETURNING current_cart.id
    ),
    cart_remove AS (
      DELETE FROM cart_item AS current_cart
      USING customer_order_item AS item, transitioned
      WHERE current_cart.id = item.cart_item_id
        AND current_cart.user_id = transitioned.user_id
        AND current_cart.quantity <= item.quantity
      RETURNING current_cart.id
    )
    SELECT
      (SELECT count(*)::integer FROM transitioned) AS transitioned,
      (SELECT payment_status FROM locked_order) AS payment_status
  `)

  return atomicPaymentMutationResult(result.rows)
}

async function recordPaymentAtomically({
  payment,
  paymentStatus,
  expectedPaymentStatus,
}: {
  readonly payment: MidtransStatusResponse
  readonly paymentStatus: PaymentStatus
  readonly expectedPaymentStatus: PaymentStatus
}): Promise<AtomicPaymentMutationResult> {
  const result = await db.execute<AtomicPaymentMutationResult>(sql`
    WITH locked_order AS MATERIALIZED (
      SELECT id, payment_status
      FROM customer_order
      WHERE id = ${payment.order_id}
      FOR UPDATE
    ),
    transitioned AS (
      UPDATE customer_order AS current_order
      SET
        ${paymentColumnAssignments(payment)},
        payment_status = ${paymentStatus}
      FROM locked_order
      WHERE current_order.id = locked_order.id
        AND locked_order.payment_status = ${expectedPaymentStatus}
      RETURNING current_order.id
    )
    SELECT
      (SELECT count(*)::integer FROM transitioned) AS transitioned,
      (SELECT payment_status FROM locked_order) AS payment_status
  `)

  return atomicPaymentMutationResult(result.rows)
}

export type PaymentUpdateResult =
  | { readonly kind: "settled"; readonly paymentStatus: "paid" }
  | {
      readonly kind: "released"
      readonly paymentStatus: "failed" | "denied" | "cancelled" | "expired"
    }
  | { readonly kind: "recorded"; readonly paymentStatus: PaymentStatus }
  | { readonly kind: "ignored"; readonly paymentStatus: PaymentStatus }
  | {
      readonly kind: "unknown"
      readonly paymentStatus: PaymentStatus
      readonly transactionStatus: string
    }

export async function applyMidtransPaymentUpdate(
  payment: MidtransStatusResponse
): Promise<PaymentUpdateResult> {
  const existing = await paymentOrderForId(payment.order_id)

  if (!existing) throw new UnknownOrderError(payment.order_id)
  if (
    (payment.status_code !== "200" && payment.status_code !== "201") ||
    !grossAmountMatches(payment.gross_amount, existing.grossAmount)
  ) {
    throw new InvalidPaymentError()
  }

  const incoming = classifyMidtransPayment({
    transactionStatus: payment.transaction_status,
    fraudStatus: payment.fraud_status ?? null,
  })
  const transition = paymentTransition({
    current: existing.paymentStatus,
    incoming,
  })

  if (transition.kind === "ignore") {
    return { kind: "ignored", paymentStatus: transition.paymentStatus }
  }

  if (transition.kind === "unknown") {
    console.error(
      JSON.stringify({
        event: "payments.midtrans_unknown_transaction_status",
        orderId: payment.order_id,
        currentPaymentStatus: existing.paymentStatus,
        transactionStatus: transition.transactionStatus,
        providerStatusCode: payment.status_code,
      })
    )

    return {
      kind: "unknown",
      paymentStatus: transition.paymentStatus,
      transactionStatus: transition.transactionStatus,
    }
  }

  if (transition.kind === "settle") {
    const mutation = await settlePaymentAtomically({ payment })

    if (mutation.transitioned === 0) {
      if (mutation.payment_status === null) {
        throw new UnknownOrderError(payment.order_id)
      }

      if (isRevenuePaymentStatus(mutation.payment_status)) {
        return {
          kind: "ignored",
          paymentStatus: mutation.payment_status,
        }
      }

      throw new InventoryUnavailableError()
    }

    return { kind: "settled", paymentStatus: "paid" }
  }

  if (transition.kind === "release") {
    const mutation = await releaseOrderInventory({
      userId: null,
      orderId: payment.order_id,
      paymentStatus: transition.paymentStatus,
      paymentInitStatus: null,
      expectedPaymentStatus: existing.paymentStatus,
    })

    if (mutation.transitioned === 0) {
      if (mutation.payment_status === null) {
        throw new UnknownOrderError(payment.order_id)
      }

      return {
        kind: "ignored",
        paymentStatus: mutation.payment_status,
      }
    }

    return {
      kind: "released",
      paymentStatus: transition.paymentStatus,
    }
  }

  const mutation = await recordPaymentAtomically({
    payment,
    paymentStatus: transition.paymentStatus,
    expectedPaymentStatus: existing.paymentStatus,
  })

  if (mutation.transitioned > 0) {
    return {
      kind: "recorded",
      paymentStatus: transition.paymentStatus,
    }
  }

  if (mutation.payment_status === null) {
    throw new UnknownOrderError(payment.order_id)
  }

  return {
    kind: "ignored",
    paymentStatus: mutation.payment_status,
  }
}

export type LocalOrderCancellationResult =
  | { readonly kind: "cancelled" }
  | { readonly kind: "paid" }
  | { readonly kind: "not-cancellable" }

export async function cancelUnpaidOrderLocally({
  userId,
  orderId,
  expectedPaymentInitStatus,
  onlyWithoutSnapToken = false,
}: {
  readonly userId: string
  readonly orderId: string
  readonly expectedPaymentInitStatus?: "pending" | "failed"
  readonly onlyWithoutSnapToken?: boolean
}): Promise<LocalOrderCancellationResult> {
  await releaseOrderInventory({
    userId,
    orderId,
    paymentStatus: "cancelled",
    paymentInitStatus: null,
    expectedPaymentInitStatus,
    onlyWithoutSnapToken,
  })

  const current = await paymentOrderForUser({ userId, orderId })

  if (!current) return { kind: "not-cancellable" }
  if (current.paymentStatus === "cancelled") return { kind: "cancelled" }
  if (isRevenuePaymentStatus(current.paymentStatus)) {
    return { kind: "paid" }
  }

  return { kind: "not-cancellable" }
}

export async function paymentDetailsForUserOrder({
  userId,
  orderId,
}: {
  readonly userId: string
  readonly orderId: string
}) {
  return paymentOrderForUser({ userId, orderId })
}

function userOrderFilter(status: OrderStatus | null) {
  switch (status) {
    case null:
      return undefined
    case "unpaid":
      return and(
        eq(customerOrder.fulfillmentStatus, "awaiting_payment"),
        inArray(customerOrder.paymentStatus, ["pending", "authorized"])
      )
    case "processing":
      return eq(customerOrder.fulfillmentStatus, "processing")
    case "shipped":
      return eq(customerOrder.fulfillmentStatus, "shipped")
    case "completed":
      return eq(customerOrder.fulfillmentStatus, "completed")
    case "cancelled":
      return or(
        eq(customerOrder.fulfillmentStatus, "cancelled"),
        and(
          eq(customerOrder.fulfillmentStatus, "awaiting_payment"),
          inArray(customerOrder.paymentStatus, [
            "failed",
            "denied",
            "cancelled",
            "expired",
          ])
        )
      )
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function emptyOrderStatusCounts() {
  return {
    unpaid: 0,
    processing: 0,
    shipped: 0,
    completed: 0,
    cancelled: 0,
  } satisfies Record<OrderStatus, number>
}

export type UserOrderPage = {
  readonly orders: readonly Order[]
  readonly counts: Readonly<Record<OrderStatus, number>>
  readonly total: number
}

export async function ordersForUserPage({
  userId,
  status,
  page,
  pageSize,
}: {
  readonly userId: string
  readonly status: OrderStatus | null
  readonly page: number
  readonly pageSize: number
}): Promise<UserOrderPage> {
  const statusCondition = userOrderFilter(status)
  const where = and(eq(customerOrder.userId, userId), statusCondition)
  const safePage = Math.max(1, Math.floor(page))
  const safePageSize = Math.max(1, Math.floor(pageSize))
  const [totalRows, countRows, orderRows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)` })
      .from(customerOrder)
      .where(where),
    db
      .select({
        fulfillmentStatus: customerOrder.fulfillmentStatus,
        paymentStatus: customerOrder.paymentStatus,
        total: sql<number>`count(*)`,
      })
      .from(customerOrder)
      .where(eq(customerOrder.userId, userId))
      .groupBy(customerOrder.fulfillmentStatus, customerOrder.paymentStatus),
    db
      .select({ order: customerOrder })
      .from(customerOrder)
      .where(where)
      .orderBy(desc(customerOrder.placedAt), asc(customerOrder.id))
      .limit(safePageSize)
      .offset((safePage - 1) * safePageSize),
  ])
  const counts = emptyOrderStatusCounts()

  for (const row of countRows) {
    counts[orderStatusForState(row)] += Number(row.total)
  }

  const orders = orderRows.map(({ order }) => order)

  if (orders.length === 0) {
    return {
      orders: [],
      counts,
      total: Number(totalRows[0]?.total ?? 0),
    }
  }

  const rows = await db
    .select({ order: customerOrder, item: customerOrderItem })
    .from(customerOrder)
    .innerJoin(
      customerOrderItem,
      eq(customerOrderItem.orderId, customerOrder.id)
    )
    .where(
      inArray(
        customerOrder.id,
        orders.map(({ id }) => id)
      )
    )
    .orderBy(desc(customerOrder.placedAt), asc(customerOrder.id))

  return {
    orders: groupOrders(rows).map(({ order }) => order),
    counts,
    total: Number(totalRows[0]?.total ?? 0),
  }
}

export async function ordersForUser(userId: string): Promise<readonly Order[]> {
  const page = await ordersForUserPage({
    userId,
    status: null,
    page: 1,
    pageSize: Number.MAX_SAFE_INTEGER,
  })

  return page.orders
}

async function assertAdminAccess() {
  if (!canAccessAdmin(await getCurrentSession())) {
    throw new Error("Unauthorized admin order access.")
  }
}

function salesOrderQueueForRow({
  fulfillmentStatus,
  paymentStatus,
}: {
  readonly fulfillmentStatus: OrderRow["fulfillmentStatus"]
  readonly paymentStatus: OrderRow["paymentStatus"]
}): OrderQueue {
  switch (fulfillmentStatus) {
    case "awaiting_payment":
      return paymentStatus === "pending" || paymentStatus === "authorized"
        ? "unpaid"
        : "returns"
    case "processing":
      return "toShip"
    case "shipped":
      return "shipped"
    case "completed":
      return "completed"
    case "cancelled":
      return "returns"
    default: {
      const _exhaustive: never = fulfillmentStatus
      return _exhaustive
    }
  }
}

function salesOrderFilter({
  queue,
  search,
}: {
  readonly queue: OrderQueueFilter
  readonly search: string
}) {
  const queueCondition =
    queue === ALL_FILTER
      ? undefined
      : queue === "unpaid"
        ? and(
            eq(customerOrder.fulfillmentStatus, "awaiting_payment"),
            inArray(customerOrder.paymentStatus, ["pending", "authorized"])
          )
        : queue === "toShip"
          ? eq(customerOrder.fulfillmentStatus, "processing")
          : queue === "shipped"
            ? eq(customerOrder.fulfillmentStatus, "shipped")
            : queue === "completed"
              ? eq(customerOrder.fulfillmentStatus, "completed")
              : or(
                  eq(customerOrder.fulfillmentStatus, "cancelled"),
                  and(
                    eq(customerOrder.fulfillmentStatus, "awaiting_payment"),
                    inArray(customerOrder.paymentStatus, [
                      "failed",
                      "denied",
                      "cancelled",
                      "expired",
                    ])
                  )
                )
  const normalizedSearch = search.trim()
  const searchCondition = normalizedSearch
    ? or(
        ilike(customerOrder.id, `%${normalizedSearch}%`),
        ilike(user.name, `%${normalizedSearch}%`),
        ilike(customerOrderItem.name, `%${normalizedSearch}%`)
      )
    : undefined

  return and(queueCondition, searchCondition)
}

function emptyOrderQueueCounts() {
  return {
    unpaid: 0,
    toShip: 0,
    shipped: 0,
    completed: 0,
    returns: 0,
  } satisfies Record<OrderQueue, number>
}

export type SalesOrderPage = {
  readonly orders: readonly SalesOrder[]
  readonly counts: Readonly<Record<OrderQueue, number>>
  readonly total: number
}

export async function salesOrderPage({
  queue,
  search,
  page,
  pageSize,
}: {
  readonly queue: OrderQueueFilter
  readonly search: string
  readonly page: number
  readonly pageSize: number
}): Promise<SalesOrderPage> {
  await assertAdminAccess()

  const where = salesOrderFilter({ queue, search })
  const safePage = Math.max(1, Math.floor(page))
  const safePageSize = Math.max(1, Math.floor(pageSize))
  const [totalRows, countRows, idRows] = await Promise.all([
    db
      .select({ total: sql<number>`count(distinct ${customerOrder.id})` })
      .from(customerOrder)
      .innerJoin(user, eq(user.id, customerOrder.userId))
      .innerJoin(
        customerOrderItem,
        eq(customerOrderItem.orderId, customerOrder.id)
      )
      .where(where),
    db
      .select({
        fulfillmentStatus: customerOrder.fulfillmentStatus,
        paymentStatus: customerOrder.paymentStatus,
        total: sql<number>`count(*)`,
      })
      .from(customerOrder)
      .groupBy(customerOrder.fulfillmentStatus, customerOrder.paymentStatus),
    db
      .select({ id: customerOrder.id })
      .from(customerOrder)
      .innerJoin(user, eq(user.id, customerOrder.userId))
      .innerJoin(
        customerOrderItem,
        eq(customerOrderItem.orderId, customerOrder.id)
      )
      .where(where)
      .groupBy(customerOrder.id, customerOrder.placedAt)
      .orderBy(desc(customerOrder.placedAt), asc(customerOrder.id))
      .limit(safePageSize)
      .offset((safePage - 1) * safePageSize),
  ])
  const counts = emptyOrderQueueCounts()

  for (const row of countRows) {
    counts[salesOrderQueueForRow(row)] += Number(row.total)
  }

  const total = Number(totalRows[0]?.total ?? 0)
  const ids = idRows.map((row) => row.id)

  if (ids.length === 0) {
    return { orders: [], counts, total }
  }

  const rows = await db
    .select({ order: customerOrder, item: customerOrderItem, buyer: user.name })
    .from(customerOrder)
    .innerJoin(
      customerOrderItem,
      eq(customerOrderItem.orderId, customerOrder.id)
    )
    .innerJoin(user, eq(user.id, customerOrder.userId))
    .where(inArray(customerOrder.id, ids))
    .orderBy(desc(customerOrder.placedAt), asc(customerOrder.id))

  return { orders: groupOrders(rows), counts, total }
}

export async function salesOrderBuyers(): Promise<readonly string[]> {
  await assertAdminAccess()

  const rows = await db
    .select({ buyer: user.name })
    .from(user)
    .innerJoin(customerOrder, eq(customerOrder.userId, user.id))
    .groupBy(user.name)
    .orderBy(asc(user.name))

  return rows.map(({ buyer }) => buyer)
}

export async function salesOrders(): Promise<readonly SalesOrder[]> {
  const page = await salesOrderPage({
    queue: ALL_FILTER,
    search: "",
    page: 1,
    pageSize: Number.MAX_SAFE_INTEGER,
  })

  return page.orders
}

function transactionFromRows({
  order,
  items,
}: {
  readonly order: OrderRow
  readonly items: readonly OrderItemRow[]
}): Transaction | null {
  const paidAt = order.paidAt
  const orderView = orderFromRow({ order, items })

  if (!paidAt || !hasOrderItems(orderView.items)) return null

  return {
    orderId: order.id,
    settledAt: (
      order.midtransSettlementTime ??
      order.midtransTransactionTime ??
      paidAt
    ).toISOString(),
    method: "midtrans",
    items: orderView.items,
    shipping: order.shippingCost,
    discount: 0,
    fulfillment: fulfillmentForStatus(orderView.status),
    paymentStatus: order.paymentStatus,
    refundAmount: order.midtransRefundAmount ?? 0,
    chargebackAmount: order.midtransChargebackAmount ?? 0,
  }
}

export type PaidTransactionPage = {
  readonly transactions: readonly Transaction[]
  readonly total: number
}

export async function paidTransactionPage({
  page,
  pageSize,
}: {
  readonly page: number
  readonly pageSize: number
}): Promise<PaidTransactionPage> {
  await assertAdminAccess()

  const safePage = Math.max(1, Math.floor(page))
  const safePageSize = Math.max(1, Math.floor(pageSize))
  const [totalRows, orderRows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)` })
      .from(customerOrder)
      .where(inArray(customerOrder.paymentStatus, REVENUE_PAYMENT_STATUSES)),
    db
      .select({ order: customerOrder })
      .from(customerOrder)
      .where(inArray(customerOrder.paymentStatus, REVENUE_PAYMENT_STATUSES))
      .orderBy(desc(customerOrder.paidAt), desc(customerOrder.placedAt))
      .limit(safePageSize)
      .offset((safePage - 1) * safePageSize),
  ])
  const orders = orderRows.map(({ order }) => order)

  if (orders.length === 0) {
    return { transactions: [], total: Number(totalRows[0]?.total ?? 0) }
  }

  const rows = await db
    .select({ order: customerOrder, item: customerOrderItem })
    .from(customerOrder)
    .innerJoin(
      customerOrderItem,
      eq(customerOrderItem.orderId, customerOrder.id)
    )
    .where(
      inArray(
        customerOrder.id,
        orders.map(({ id }) => id)
      )
    )
    .orderBy(desc(customerOrder.paidAt), desc(customerOrder.placedAt))
  const grouped = new Map<string, { order: OrderRow; items: OrderItemRow[] }>()

  for (const row of rows) {
    const current = grouped.get(row.order.id)
    if (current) {
      current.items.push(row.item)
    } else {
      grouped.set(row.order.id, { order: row.order, items: [row.item] })
    }
  }

  return {
    transactions: [...grouped.values()].flatMap((group) => {
      const transaction = transactionFromRows(group)
      return transaction ? [transaction] : []
    }),
    total: Number(totalRows[0]?.total ?? 0),
  }
}

export async function financeSummary() {
  await assertAdminAccess()

  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(
        case
          when ${customerOrder.paymentStatus} = 'refunded'
            then ${customerOrder.grossAmount} - coalesce(${customerOrder.midtransRefundAmount}, ${customerOrder.grossAmount})
          when ${customerOrder.paymentStatus} = 'chargeback'
            then ${customerOrder.grossAmount} - coalesce(${customerOrder.midtransChargebackAmount}, ${customerOrder.grossAmount})
          when ${customerOrder.paymentStatus} = 'partial_refund'
            then ${customerOrder.grossAmount} - coalesce(${customerOrder.midtransRefundAmount}, 0)
          when ${customerOrder.paymentStatus} = 'partial_chargeback'
            then ${customerOrder.grossAmount} - coalesce(${customerOrder.midtransChargebackAmount}, 0)
          else ${customerOrder.grossAmount}
        end - ${customerOrder.shippingCost}
      ), 0)`,
    })
    .from(customerOrder)
    .where(inArray(customerOrder.paymentStatus, REVENUE_PAYMENT_STATUSES))

  return Number(row?.total ?? 0)
}

export async function paidTransactions(): Promise<readonly Transaction[]> {
  const page = await paidTransactionPage({
    page: 1,
    pageSize: Number.MAX_SAFE_INTEGER,
  })

  return page.transactions
}
