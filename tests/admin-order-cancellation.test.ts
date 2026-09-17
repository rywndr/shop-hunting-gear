import "dotenv/config"

import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test, { after, before } from "node:test"

import { eq } from "drizzle-orm"

import { db } from "../lib/db/client"
import { user } from "../lib/db/schema/auth"
import {
  customerOrder,
  orderCancellation,
  orderInventoryReservation,
} from "../lib/db/schema/order"
import { product, productListing } from "../lib/db/schema/product"
import type { ManualOrderInput } from "../lib/admin/manual-order"
import { canCancelUnpaidOrder } from "../lib/admin/orders"
import {
  requestOrderCancellation,
  selectCancellationProviderAction,
} from "../lib/orders/cancellation-service"
import {
  createManualOrderRecord,
  recordOrderShipment,
  settleManualOrderPayment,
} from "../lib/orders/service"
import {
  cancelMidtransOrderForUser,
  executeAdminUnpaidCancellation,
  reconcileExpiredSnapSessionReservations,
} from "../lib/payments/midtrans/service"

const suffix = randomUUID().slice(0, 8)
const ADMIN_ID = `cancel-admin-${suffix}`
const CUSTOMER_ID = `cancel-customer-${suffix}`
const PRODUCT_ID = `cancel-product-${suffix}`
const PRODUCT_SLUG = `cancel-product-${suffix}`
const PRICE = 375_000
const QUANTITY = 2
const INITIAL_STOCK = 80
const createdOrderIds: string[] = []

const ORDER_INPUT = {
  customerId: CUSTOMER_ID,
  productSlug: PRODUCT_SLUG,
  variant: "Ukuran: Standar",
  quantity: QUANTITY,
  recipient: "Pelanggan Uji",
  phone: "081234567890",
  address: "",
  deliveryMethod: "pickup",
  shippingCost: 0,
  note: "Pesanan uji pembatalan.",
} satisfies ManualOrderInput

async function createOrder({
  providerBacked = false,
  snapToken = null,
  paymentInitStatus = "pending",
}: {
  readonly providerBacked?: boolean
  readonly snapToken?: string | null
  readonly paymentInitStatus?: "pending" | "creating" | "ready" | "failed"
} = {}) {
  const result = await createManualOrderRecord(ORDER_INPUT)
  assert.equal(result.kind, "created")
  if (result.kind !== "created") throw new Error("Order fixture failed.")
  createdOrderIds.push(result.orderId)

  if (providerBacked) {
    await db
      .update(customerOrder)
      .set({
        sourceKind: "product",
        midtransCreateIdempotencyKey: `create-${result.orderId}`,
        snapToken,
        paymentInitStatus,
        paymentSessionExpiresAt: snapToken
          ? new Date(Date.now() + 60 * 60 * 1000)
          : null,
      })
      .where(eq(customerOrder.id, result.orderId))
  }

  return result.orderId
}

async function requestAsAdmin(orderId: string) {
  const result = await requestOrderCancellation({
    orderId,
    actorId: ADMIN_ID,
    actorType: "admin",
    reason: "Pesanan belum dibayar dan dibatalkan admin.",
  })
  assert.ok(result.kind === "created" || result.kind === "existing")
  if (result.kind !== "created" && result.kind !== "existing") {
    throw new Error("Cancellation fixture failed.")
  }
  return result.cancellation
}

async function cancelAsAdmin(orderId: string) {
  await requestAsAdmin(orderId)
  return executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID })
}

async function orderState(orderId: string) {
  const [row] = await db
    .select({
      paymentStatus: customerOrder.paymentStatus,
      fulfillmentStatus: customerOrder.fulfillmentStatus,
      cancellationRequestedAt: customerOrder.cancellationRequestedAt,
    })
    .from(customerOrder)
    .where(eq(customerOrder.id, orderId))
  assert.ok(row)
  return row
}

async function cancellationState(orderId: string) {
  const [row] = await db
    .select()
    .from(orderCancellation)
    .where(eq(orderCancellation.orderId, orderId))
  assert.ok(row)
  return row
}

async function inventoryState(orderId: string) {
  const [reservation] = await db
    .select()
    .from(orderInventoryReservation)
    .where(eq(orderInventoryReservation.orderId, orderId))
  const [item] = await db
    .select({ stock: product.stock })
    .from(product)
    .where(eq(product.id, PRODUCT_ID))
  assert.ok(reservation)
  assert.ok(item)
  return { reservation, stock: item.stock }
}

function midtransStatus(
  orderId: string,
  transactionStatus: string,
  transactionId = `tx-${orderId}`
) {
  return {
    order_id: orderId,
    status_code: "200",
    gross_amount: String(PRICE * QUANTITY),
    transaction_status: transactionStatus,
    transaction_id: transactionId,
  }
}

function midtransNotFound() {
  return Response.json({ status_code: "404" }, { status: 404 })
}

before(async () => {
  await db.insert(user).values([
    {
      id: ADMIN_ID,
      name: `Admin Pembatalan ${suffix}`,
      email: `cancel-admin-${suffix}@example.test`,
      role: "admin",
    },
    {
      id: CUSTOMER_ID,
      name: `Pelanggan Pembatalan ${suffix}`,
      email: `cancel-customer-${suffix}@example.test`,
      role: "user",
    },
  ])
  await db.insert(product).values({
    id: PRODUCT_ID,
    slug: PRODUCT_SLUG,
    name: `Produk Pembatalan ${suffix}`,
    category: "hunting",
    description: ["Produk uji pembatalan admin."],
    images: [
      {
        id: `cancel-image-${suffix}`,
        objectKey: `tests/${PRODUCT_ID}/original.png`,
        thumbnailObjectKey: `tests/${PRODUCT_ID}/thumbnail.webp`,
        detailObjectKey: `tests/${PRODUCT_ID}/detail.webp`,
        alt: "Foto produk uji pembatalan",
      },
    ],
    variants: [
      {
        label: "Ukuran",
        options: [
          { value: "Standar", price: PRICE, weight: 1000, imageId: null },
        ],
      },
    ],
    price: PRICE,
    compareAtPrice: null,
    stock: INITIAL_STOCK,
    sold: 0,
    weight: 1000,
    ratings: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
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
  await db.delete(user).where(eq(user.id, ADMIN_ID))
})

test("admin cancellation authorization rejects a customer actor", async () => {
  const orderId = await createOrder()
  assert.deepEqual(
    await requestOrderCancellation({
      orderId,
      actorId: CUSTOMER_ID,
      actorType: "admin",
      reason: "Mencoba membatalkan sebagai admin.",
    }),
    { kind: "not-found" }
  )
})

test("manual unpaid cancellation completes and releases inventory once", async (t) => {
  const originalFetch = globalThis.fetch
  let providerRequests = 0
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes("midtrans.com")) providerRequests++
      return originalFetch(input, init)
    }
  )
  const before = await inventoryState(await createOrder())
  const orderId = before.reservation.orderId

  assert.deepEqual(await cancelAsAdmin(orderId), { kind: "completed" })
  const first = await inventoryState(orderId)
  const firstCancellation = await cancellationState(orderId)
  assert.equal(first.reservation.status, "released")
  assert.equal(first.stock, before.stock + QUANTITY)
  assert.equal(providerRequests, 0)
  await requestAsAdmin(orderId)
  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "completed" }
  )
  const duplicate = await inventoryState(orderId)
  assert.equal(duplicate.stock, first.stock)
  const duplicateCancellation = await cancellationState(orderId)
  assert.equal(duplicateCancellation.status, "completed")
  assert.equal(duplicateCancellation.financialAction, "none")
  assert.deepEqual(
    duplicateCancellation.completedAt,
    firstCancellation.completedAt
  )
  assert.deepEqual(await orderState(orderId), {
    paymentStatus: "cancelled",
    fulfillmentStatus: "cancelled",
    cancellationRequestedAt: (await orderState(orderId))
      .cancellationRequestedAt,
  })
})

test("provider-backed unpaid order without a transaction cancels locally", async (t) => {
  const orderId = await createOrder({ providerBacked: true })
  const originalFetch = globalThis.fetch
  let requests = 0
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      requests++
      return midtransNotFound()
    }
  )

  assert.deepEqual(await cancelAsAdmin(orderId), { kind: "completed" })
  assert.equal(requests, 1)
  assert.equal((await cancellationState(orderId)).financialAction, "none")
})

test("an unpaid Snap session uses session cancellation and reconciles", async (t) => {
  const orderId = await createOrder({
    providerBacked: true,
    snapToken: `snap-${suffix}-${randomUUID()}`,
    paymentInitStatus: "ready",
  })
  const originalFetch = globalThis.fetch
  const methods: string[] = []
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      methods.push(init?.method ?? "GET")
      if (init?.method === "POST") {
        return Response.json({ canceled_at: new Date().toISOString() })
      }
      return midtransNotFound()
    }
  )

  assert.deepEqual(await cancelAsAdmin(orderId), { kind: "completed" })
  assert.deepEqual(methods, ["GET", "POST", "GET"])
  const cancellation = await cancellationState(orderId)
  assert.equal(cancellation.financialAction, "cancel_payment")
  assert.ok(cancellation.providerIdempotencyKey)
})

test("an active pending transaction uses Cancel then a fresh GET", async (t) => {
  const orderId = await createOrder({ providerBacked: true })
  const originalFetch = globalThis.fetch
  const methods: string[] = []
  let cancelled = false
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      methods.push(init?.method ?? "GET")
      if (init?.method === "POST") {
        cancelled = true
        return Response.json(midtransStatus(orderId, "cancel"))
      }
      return Response.json(
        midtransStatus(orderId, cancelled ? "cancel" : "pending")
      )
    }
  )

  assert.deepEqual(await cancelAsAdmin(orderId), { kind: "completed" })
  assert.deepEqual(methods, ["GET", "POST", "GET"])
  assert.equal(
    (await cancellationState(orderId)).reconciliationStatus,
    "reconciled"
  )
})

test("fresh provider pending overrides a local terminal unpaid state", async (t) => {
  const orderId = await createOrder({ providerBacked: true })
  await db
    .update(customerOrder)
    .set({ paymentStatus: "cancelled" })
    .where(eq(customerOrder.id, orderId))

  const originalFetch = globalThis.fetch
  let posts = 0
  let cancelled = false
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com")) {
        return originalFetch(input, init)
      }
      if (init?.method === "POST") {
        posts++
        cancelled = true
        return Response.json(midtransStatus(orderId, "cancel"))
      }
      return Response.json(
        midtransStatus(orderId, cancelled ? "cancel" : "pending")
      )
    }
  )

  assert.deepEqual(await cancelAsAdmin(orderId), { kind: "completed" })
  assert.equal(posts, 1)
  assert.equal(
    (await cancellationState(orderId)).financialAction,
    "cancel_payment"
  )
})

test("provider cancel after local payment keeps the cancellation active", async (t) => {
  const orderId = await createOrder({ providerBacked: true })
  const cancellation = await requestAsAdmin(orderId)
  const selected = await selectCancellationProviderAction({
    cancellationId: cancellation.id,
    actorId: ADMIN_ID,
    providerIdempotencyKey: `cancel-${orderId}`,
    providerTransactionReference: `tx-${orderId}`,
  })
  assert.ok(selected)

  await db
    .update(customerOrder)
    .set({ paymentStatus: "paid", fulfillmentStatus: "processing" })
    .where(eq(customerOrder.id, orderId))

  const originalFetch = globalThis.fetch
  let posts = 0
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com")) {
        return originalFetch(input, init)
      }
      if (init?.method === "POST") posts++
      return Response.json(midtransStatus(orderId, "cancel"))
    }
  )

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "paid" }
  )
  assert.equal(posts, 0)
  const afterCancellation = await cancellationState(orderId)
  assert.equal(afterCancellation.status, "provider_operation_pending")
  assert.notEqual(afterCancellation.status, "failed")
  assert.ok((await orderState(orderId)).cancellationRequestedAt)
})

test("legacy customer cancellation stops when reconciliation observes revenue", async (t) => {
  const orderId = await createOrder({ providerBacked: true })
  const originalFetch = globalThis.fetch
  let posts = 0
  let racedToPaid = false
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com")) {
        return originalFetch(input, init)
      }
      if (init?.method === "POST") {
        posts++
        return Response.json(midtransStatus(orderId, "cancel"))
      }
      if (!racedToPaid) {
        racedToPaid = true
        await db
          .update(customerOrder)
          .set({ paymentStatus: "paid", fulfillmentStatus: "processing" })
          .where(eq(customerOrder.id, orderId))
      }
      return Response.json(midtransStatus(orderId, "pending"))
    }
  )

  assert.deepEqual(
    await cancelMidtransOrderForUser({ userId: CUSTOMER_ID, orderId }),
    { kind: "paid" }
  )
  assert.equal(posts, 0)
  assert.equal((await orderState(orderId)).paymentStatus, "paid")
})

test("expired-session cleanup stops when reconciliation observes revenue", async (t) => {
  const orderId = await createOrder({
    providerBacked: true,
    snapToken: `expired-snap-${suffix}-${randomUUID()}`,
    paymentInitStatus: "ready",
  })
  await db
    .update(customerOrder)
    .set({ paymentSessionExpiresAt: new Date(Date.now() - 60_000) })
    .where(eq(customerOrder.id, orderId))

  const originalFetch = globalThis.fetch
  let posts = 0
  let racedToPaid = false
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com")) {
        return originalFetch(input, init)
      }
      if (init?.method === "POST") {
        posts++
        return Response.json({ canceled_at: new Date().toISOString() })
      }
      if (!racedToPaid) {
        racedToPaid = true
        await db
          .update(customerOrder)
          .set({ paymentStatus: "paid", fulfillmentStatus: "processing" })
          .where(eq(customerOrder.id, orderId))
      }
      return Response.json(midtransStatus(orderId, "pending"))
    }
  )

  await reconcileExpiredSnapSessionReservations({
    productSlugs: [PRODUCT_SLUG],
  })

  assert.equal(posts, 0)
  assert.equal((await orderState(orderId)).paymentStatus, "paid")
})

test("provider terminal unpaid states finish locally without POST", async (t) => {
  for (const transactionStatus of ["cancel", "expire", "deny", "failure"]) {
    const orderId = await createOrder({ providerBacked: true })
    const originalFetch = globalThis.fetch
    let posts = 0
    t.mock.method(
      globalThis,
      "fetch",
      async (input: string | URL | Request, init?: RequestInit) => {
        if (!String(input).includes("midtrans.com"))
          return originalFetch(input, init)
        if (init?.method === "POST") posts++
        return Response.json(midtransStatus(orderId, transactionStatus))
      }
    )

    assert.deepEqual(await cancelAsAdmin(orderId), { kind: "completed" })
    assert.equal(posts, 0)
    assert.equal((await cancellationState(orderId)).financialAction, "none")
    t.mock.restoreAll()
  }
})

test("ambiguous Cancel completes only after fresh reconciliation", async (t) => {
  const orderId = await createOrder({ providerBacked: true })
  const originalFetch = globalThis.fetch
  let statusReads = 0
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      if (init?.method === "POST") throw new TypeError("timeout")
      statusReads++
      return Response.json(
        midtransStatus(orderId, statusReads === 1 ? "pending" : "cancel")
      )
    }
  )

  assert.deepEqual(await cancelAsAdmin(orderId), { kind: "completed" })
  assert.equal(statusReads, 2)
})

test("unresolved provider state keeps the hold and stable key across retries", async (t) => {
  const orderId = await createOrder({ providerBacked: true })
  const originalFetch = globalThis.fetch
  const keys: string[] = []
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      if (init?.method === "POST") {
        keys.push(new Headers(init.headers).get("Idempotency-Key") ?? "")
        throw new TypeError("timeout")
      }
      return Response.json(midtransStatus(orderId, "pending"))
    }
  )

  await requestAsAdmin(orderId)
  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "pending" }
  )
  const first = await cancellationState(orderId)
  assert.equal(first.status, "provider_operation_pending")
  assert.equal(first.reconciliationStatus, "failed")
  assert.ok((await orderState(orderId)).cancellationRequestedAt)
  assert.deepEqual(
    await recordOrderShipment({ orderId, tracking: "JP1234567890" }),
    {
      kind: "not-eligible",
    }
  )

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "pending" }
  )
  const second = await cancellationState(orderId)
  assert.equal(second.providerIdempotencyKey, first.providerIdempotencyKey)
  assert.deepEqual(keys, [
    first.providerIdempotencyKey,
    first.providerIdempotencyKey,
  ])
  assert.equal((await inventoryState(orderId)).reservation.status, "reserved")
})

test("paid, shipped, and completed orders are rejected", async () => {
  const paidOrderId = await createOrder()
  assert.equal((await settleManualOrderPayment(paidOrderId)).kind, "settled")
  await requestAsAdmin(paidOrderId)
  assert.deepEqual(
    await executeAdminUnpaidCancellation({
      orderId: paidOrderId,
      actorId: ADMIN_ID,
    }),
    { kind: "paid" }
  )
  assert.equal((await cancellationState(paidOrderId)).status, "failed")
  assert.equal((await orderState(paidOrderId)).cancellationRequestedAt, null)

  for (const fulfillmentStatus of ["shipped", "completed"] as const) {
    const orderId = await createOrder()
    await db
      .update(customerOrder)
      .set({
        fulfillmentStatus,
        tracking: fulfillmentStatus === "shipped" ? "JP1234567890" : null,
      })
      .where(eq(customerOrder.id, orderId))
    assert.deepEqual(
      await requestOrderCancellation({
        orderId,
        actorId: ADMIN_ID,
        actorType: "admin",
        reason: "Tidak lagi memenuhi syarat.",
      }),
      { kind: "not-eligible" }
    )
  }
})

test("admin row eligibility exposes only unpaid awaiting-payment orders", () => {
  assert.equal(
    canCancelUnpaidOrder({
      paymentStatus: "pending",
      fulfillmentStatus: "awaiting_payment",
      tracking: null,
    }),
    true
  )
  for (const candidate of [
    { paymentStatus: "paid", fulfillmentStatus: "processing", tracking: null },
    {
      paymentStatus: "pending",
      fulfillmentStatus: "shipped",
      tracking: "JP1234567890",
    },
    {
      paymentStatus: "pending",
      fulfillmentStatus: "completed",
      tracking: null,
    },
  ] as const) {
    assert.equal(canCancelUnpaidOrder(candidate), false)
  }
})
