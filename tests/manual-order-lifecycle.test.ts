import "dotenv/config"

import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test, { after, before } from "node:test"

import { eq, sql } from "drizzle-orm"

import { db } from "../lib/db/client"
import { customerOrder, customerOrderItem } from "../lib/db/schema/order"
import { product, productListing } from "../lib/db/schema/product"
import { user } from "../lib/db/schema/auth"
import {
  completeOrderFulfillment,
  createManualOrderRecord,
  recordOrderShipment,
  settleManualOrderPayment,
  shippingLabelRecord,
} from "../lib/orders/service"
import type { ManualOrderInput } from "../lib/admin/manual-order"

const suffix = randomUUID().slice(0, 8)
const CUSTOMER_ID = `test-customer-${suffix}`
const PRODUCT_ID = `test-product-${suffix}`
const PRODUCT_SLUG = `test-senapan-${suffix}`
const INITIAL_STOCK = 40
const INITIAL_SOLD = 3
const PRICE = 1_250_000

const EMPTY_RATINGS = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as const

const PICKUP_ORDER = {
  customerId: CUSTOMER_ID,
  productSlug: PRODUCT_SLUG,
  variant: "Kaliber: 4.5 mm",
  quantity: 2,
  recipient: "Budi",
  phone: "081234567890",
  address: "",
  deliveryMethod: "pickup",
  shippingCost: 0,
  note: "Diambil sore ini.",
} satisfies ManualOrderInput

const createdOrderIds: string[] = []

async function productRow() {
  const [row] = await db
    .select({ stock: product.stock, sold: product.sold })
    .from(product)
    .where(eq(product.id, PRODUCT_ID))
    .limit(1)

  assert.ok(row, "fixture product missing")
  return row
}

async function orderRow(orderId: string) {
  const [row] = await db
    .select({
      paymentStatus: customerOrder.paymentStatus,
      fulfillmentStatus: customerOrder.fulfillmentStatus,
      sourceKind: customerOrder.sourceKind,
      grossAmount: customerOrder.grossAmount,
      shippingCost: customerOrder.shippingCost,
      shippingCourier: customerOrder.shippingCourier,
      tracking: customerOrder.tracking,
      shippingService: customerOrder.shippingService,
      adminNote: customerOrder.adminNote,
      addressSnapshot: customerOrder.addressSnapshot,
      paidAt: customerOrder.paidAt,
      snapToken: customerOrder.snapToken,
      idempotencyKey: customerOrder.midtransCreateIdempotencyKey,
    })
    .from(customerOrder)
    .where(eq(customerOrder.id, orderId))
    .limit(1)

  assert.ok(row, `order ${orderId} missing`)
  return row
}

async function reservationStatuses(orderId: string) {
  const rows = await db.execute<{ status: string; quantity: number }>(sql`
    select status, quantity
    from order_inventory_reservation
    where order_id = ${orderId}
  `)

  return rows.rows
}

async function createOrder(
  overrides: Partial<ManualOrderInput> = {}
): Promise<string> {
  const result = await createManualOrderRecord({
    ...PICKUP_ORDER,
    ...overrides,
  })

  assert.equal(result.kind, "created")
  if (result.kind !== "created") throw new Error("unreachable")

  createdOrderIds.push(result.orderId)
  return result.orderId
}

before(async () => {
  await db.insert(user).values({
    id: CUSTOMER_ID,
    name: `Pelanggan Uji ${suffix}`,
    email: `pelanggan-${suffix}@example.test`,
    role: "user",
  })
  await db.insert(product).values({
    id: PRODUCT_ID,
    slug: PRODUCT_SLUG,
    name: `Senapan Uji ${suffix}`,
    category: "hunting",
    description: ["Produk uji untuk pesanan manual."],
    images: [
      {
        id: `image-${suffix}`,
        objectKey: `products/${PRODUCT_ID}/original.png`,
        thumbnailObjectKey: `products/${PRODUCT_ID}/thumbnail.webp`,
        detailObjectKey: `products/${PRODUCT_ID}/detail.webp`,
        alt: "Foto produk uji",
      },
    ],
    variants: [
      {
        label: "Kaliber",
        options: [
          { value: "4.5 mm", price: PRICE, weight: 3000, imageId: null },
        ],
      },
    ],
    price: PRICE,
    compareAtPrice: null,
    stock: INITIAL_STOCK,
    sold: INITIAL_SOLD,
    weight: 3000,
    ratings: EMPTY_RATINGS,
    reviews: [],
  })
  await db
    .insert(productListing)
    .values({ productId: PRODUCT_ID, state: "active" })
})

after(async () => {
  for (const orderId of createdOrderIds) {
    await db.delete(customerOrder).where(eq(customerOrder.id, orderId))
  }
  await db
    .delete(productListing)
    .where(eq(productListing.productId, PRODUCT_ID))
  await db.delete(product).where(eq(product.id, PRODUCT_ID))
  await db.delete(user).where(eq(user.id, CUSTOMER_ID))
})

test("a manual pickup order reserves stock without recognizing revenue", async () => {
  const before = await productRow()
  const orderId = await createOrder()
  const order = await orderRow(orderId)

  assert.equal(order.sourceKind, "manual")
  assert.equal(order.paymentStatus, "pending")
  assert.equal(order.fulfillmentStatus, "awaiting_payment")
  assert.equal(order.paidAt, null)
  assert.equal(order.snapToken, null)
  assert.equal(order.idempotencyKey, null)
  assert.equal(order.shippingCourier, "manual")
  assert.equal(order.shippingService, "Pickup")
  assert.equal(order.shippingCost, 0)
  assert.equal(order.grossAmount, PRICE * PICKUP_ORDER.quantity)
  assert.equal(order.adminNote, PICKUP_ORDER.note)
  assert.equal(order.addressSnapshot.street, "Ambil di toko")

  const [item] = await db
    .select()
    .from(customerOrderItem)
    .where(eq(customerOrderItem.orderId, orderId))

  assert.equal(item?.quantity, PICKUP_ORDER.quantity)
  assert.equal(item?.price, PRICE)
  assert.deepEqual(item?.variants, [{ label: "Kaliber", value: "4.5 mm" }])
  assert.equal(item?.cartItemId, null)

  assert.deepEqual(await reservationStatuses(orderId), [
    { status: "reserved", quantity: PICKUP_ORDER.quantity },
  ])

  const after = await productRow()
  assert.equal(after.stock, before.stock - PICKUP_ORDER.quantity)
  assert.equal(after.sold, before.sold)
})

test("a pickup order ignores a client-supplied shipping cost", async () => {
  const orderId = await createOrder({ shippingCost: 0 })
  const order = await orderRow(orderId)

  assert.equal(order.shippingCost, 0)
  assert.equal(order.grossAmount, PRICE * PICKUP_ORDER.quantity)
})

test("marking a manual order paid consumes the reservation once", async () => {
  const orderId = await createOrder()
  const reserved = await productRow()

  assert.equal(await settle(orderId), "settled")

  const order = await orderRow(orderId)
  assert.equal(order.paymentStatus, "paid")
  assert.equal(order.fulfillmentStatus, "processing")
  assert.ok(order.paidAt)

  assert.deepEqual(await reservationStatuses(orderId), [
    { status: "consumed", quantity: PICKUP_ORDER.quantity },
  ])

  const paid = await productRow()
  assert.equal(paid.stock, reserved.stock)
  assert.equal(paid.sold, reserved.sold + PICKUP_ORDER.quantity)

  assert.equal(await settle(orderId), "already-paid")

  const repeated = await productRow()
  assert.equal(repeated.stock, paid.stock)
  assert.equal(repeated.sold, paid.sold)
  assert.deepEqual(await reservationStatuses(orderId), [
    { status: "consumed", quantity: PICKUP_ORDER.quantity },
  ])
})

async function settle(orderId: string) {
  const result = await settleManualOrderPayment(orderId)
  return result.kind
}

test("a paid pickup order completes and stays idempotent", async () => {
  const orderId = await createOrder()
  assert.equal(await settle(orderId), "settled")

  const paid = await productRow()
  const first = await completeOrderFulfillment(orderId)
  assert.equal(first.kind, "completed")
  assert.equal((await orderRow(orderId)).fulfillmentStatus, "completed")

  const second = await completeOrderFulfillment(orderId)
  assert.equal(second.kind, "already-completed")

  const completed = await productRow()
  assert.equal(completed.stock, paid.stock)
  assert.equal(completed.sold, paid.sold)
  assert.deepEqual(await reservationStatuses(orderId), [
    { status: "consumed", quantity: PICKUP_ORDER.quantity },
  ])
})

test("an unpaid order cannot be completed", async () => {
  const orderId = await createOrder()
  const result = await completeOrderFulfillment(orderId)

  assert.equal(result.kind, "not-eligible")
  assert.equal((await orderRow(orderId)).fulfillmentStatus, "awaiting_payment")
})

test("a provider-backed order is never settled manually", async () => {
  const orderId = await createOrder()
  await db
    .update(customerOrder)
    .set({ sourceKind: "product", midtransCreateIdempotencyKey: "test-key" })
    .where(eq(customerOrder.id, orderId))

  assert.equal(await settle(orderId), "not-manual")
  assert.equal((await orderRow(orderId)).paymentStatus, "pending")
})

test("a courier order stores the address and the confirmed shipping cost", async () => {
  const orderId = await createOrder({
    deliveryMethod: "jne",
    address: "Jalan Merdeka 10, Bandung, Jawa Barat 40111",
    shippingCost: 25_000,
  })
  const order = await orderRow(orderId)

  assert.equal(order.shippingCourier, "jne")
  assert.equal(order.shippingCost, 25_000)
  assert.equal(order.grossAmount, PRICE * PICKUP_ORDER.quantity + 25_000)
  assert.equal(
    order.addressSnapshot.street,
    "Jalan Merdeka 10, Bandung, Jawa Barat 40111"
  )
})

test("stock beyond the available quantity is rejected", async () => {
  const before = await productRow()
  const result = await createManualOrderRecord({
    ...PICKUP_ORDER,
    quantity: before.stock + 1,
  })

  assert.deepEqual(result, {
    kind: "rejected",
    reason: "insufficient-stock",
  })

  const after = await productRow()
  assert.equal(after.stock, before.stock)
  assert.equal(after.sold, before.sold)
})

test("an unknown customer or variant is rejected", async () => {
  assert.deepEqual(
    await createManualOrderRecord({
      ...PICKUP_ORDER,
      customerId: "missing-customer",
    }),
    { kind: "rejected", reason: "unknown-customer" }
  )
  assert.deepEqual(
    await createManualOrderRecord({
      ...PICKUP_ORDER,
      variant: "Kaliber: 9 mm",
    }),
    { kind: "rejected", reason: "unknown-variant" }
  )
})

const TRACKING = "JP1234567890"

test("saving a resi moves a paid order from processing to shipped", async () => {
  const orderId = await createOrder({
    deliveryMethod: "jne",
    address: "Jalan Merdeka 10, Bandung, Jawa Barat 40111",
    shippingCost: 25_000,
  })
  assert.equal(await settle(orderId), "settled")

  const shipped = await recordOrderShipment({
    orderId,
    tracking: ` ${TRACKING} `,
  })
  assert.equal(shipped.kind, "shipped")

  const order = await orderRow(orderId)
  assert.equal(order.fulfillmentStatus, "shipped")
  assert.equal(order.tracking, TRACKING)
})

test("a stale second submission never overwrites a saved resi", async () => {
  const orderId = await createOrder()
  assert.equal(await settle(orderId), "settled")
  assert.equal(
    (await recordOrderShipment({ orderId, tracking: TRACKING })).kind,
    "shipped"
  )

  const stale = await recordOrderShipment({
    orderId,
    tracking: "JNE-999999999",
  })

  assert.equal(stale.kind, "already-shipped")
  assert.equal((await orderRow(orderId)).tracking, TRACKING)
})

test("an unpaid order is never shipped", async () => {
  const orderId = await createOrder()
  const result = await recordOrderShipment({ orderId, tracking: TRACKING })

  assert.equal(result.kind, "not-eligible")

  const order = await orderRow(orderId)
  assert.equal(order.fulfillmentStatus, "awaiting_payment")
  assert.equal(order.tracking, null)
})

test("an invalid resi is rejected before the order is touched", async () => {
  const orderId = await createOrder()
  assert.equal(await settle(orderId), "settled")

  const result = await recordOrderShipment({ orderId, tracking: "  " })

  assert.equal(result.kind, "invalid-tracking")

  const order = await orderRow(orderId)
  assert.equal(order.fulfillmentStatus, "processing")
  assert.equal(order.tracking, null)
})

test("a completed order keeps its resi and cannot be shipped again", async () => {
  const orderId = await createOrder()
  assert.equal(await settle(orderId), "settled")
  assert.equal(
    (await recordOrderShipment({ orderId, tracking: TRACKING })).kind,
    "shipped"
  )
  assert.equal((await completeOrderFulfillment(orderId)).kind, "completed")

  const result = await recordOrderShipment({
    orderId,
    tracking: "JNE-999999999",
  })

  assert.equal(result.kind, "already-shipped")
  assert.equal((await orderRow(orderId)).tracking, TRACKING)
})

test("the label query reads the stored address snapshot and items", async () => {
  const orderId = await createOrder({
    deliveryMethod: "jne",
    address: "Jalan Merdeka 10, Bandung, Jawa Barat 40111",
    shippingCost: 25_000,
    recipient: "Budi Santoso",
    phone: "081234567890",
  })
  assert.equal(await settle(orderId), "settled")
  assert.equal(
    (await recordOrderShipment({ orderId, tracking: TRACKING })).kind,
    "shipped"
  )

  const label = await shippingLabelRecord(orderId)

  assert.ok(label)
  assert.equal(label.id, orderId)
  assert.equal(label.tracking, TRACKING)
  assert.equal(label.fulfillmentStatus, "shipped")
  assert.equal(label.courier, "jne")
  assert.equal(label.courierName, "JNE")
  assert.equal(label.address.recipient, "Budi Santoso")
  assert.equal(label.address.phone, "081234567890")
  assert.equal(
    label.address.street,
    "Jalan Merdeka 10, Bandung, Jawa Barat 40111"
  )
  assert.deepEqual(label.items, [
    {
      name: `Senapan Uji ${suffix}`,
      variant: "Kaliber: 4.5 mm",
      quantity: PICKUP_ORDER.quantity,
    },
  ])
})

test("an unknown order has no shipping label", async () => {
  assert.equal(await shippingLabelRecord(`missing-${suffix}`), null)
})
