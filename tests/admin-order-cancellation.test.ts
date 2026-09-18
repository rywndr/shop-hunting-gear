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
  executeOrderCancellation,
  reconcileMidtransPayment,
  reconcileExpiredSnapSessionReservations,
} from "../lib/payments/midtrans/service"

const suffix = randomUUID().slice(0, 8)
const ADMIN_ID = `cancel-admin-${suffix}`
const CUSTOMER_ID = `cancel-customer-${suffix}`
const OTHER_CUSTOMER_ID = `cancel-other-customer-${suffix}`
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

async function requestAsCustomer(orderId: string) {
  const result = await requestOrderCancellation({
    orderId,
    actorId: CUSTOMER_ID,
    actorType: "customer",
    reason: "Dibatalkan oleh pelanggan.",
  })
  assert.ok(result.kind === "created" || result.kind === "existing")
  if (result.kind !== "created" && result.kind !== "existing") {
    throw new Error("Customer cancellation fixture failed.")
  }
  return result.cancellation
}

async function cancelAsAdmin(orderId: string) {
  await requestAsAdmin(orderId)
  return executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID })
}

async function createPaidOrder({ providerBacked = false } = {}) {
  const orderId = await createOrder()
  assert.equal((await settleManualOrderPayment(orderId)).kind, "settled")
  if (providerBacked) {
    await db
      .update(customerOrder)
      .set({
        sourceKind: "product",
        midtransTransactionId: `tx-${orderId}`,
        midtransCreateIdempotencyKey: `create-${orderId}`,
        paymentInitStatus: "ready",
      })
      .where(eq(customerOrder.id, orderId))
  }
  return orderId
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
    .select({ stock: product.stock, sold: product.sold })
    .from(product)
    .where(eq(product.id, PRODUCT_ID))
  assert.ok(reservation)
  assert.ok(item)
  return { reservation, stock: item.stock, sold: item.sold }
}

function midtransStatus(
  orderId: string,
  transactionStatus: string,
  transactionId = `tx-${orderId}`,
  paymentType?: string
) {
  return {
    order_id: orderId,
    status_code: "200",
    gross_amount: String(PRICE * QUANTITY),
    transaction_status: transactionStatus,
    transaction_id: transactionId,
    ...(paymentType ? { payment_type: paymentType } : {}),
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
    {
      id: OTHER_CUSTOMER_ID,
      name: `Pelanggan Lain ${suffix}`,
      email: `cancel-other-${suffix}@example.test`,
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
  await db.delete(user).where(eq(user.id, OTHER_CUSTOMER_ID))
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

test("owning customer can request and execute persisted cancellation", async () => {
  const orderId = await createOrder()
  const requested = await requestOrderCancellation({
    orderId,
    actorId: CUSTOMER_ID,
    actorType: "customer",
    reason: "Pesanan dibuat dua kali.",
  })
  assert.equal(requested.kind, "created")
  assert.deepEqual(
    await executeOrderCancellation({
      orderId,
      actorId: CUSTOMER_ID,
      actorType: "customer",
    }),
    { kind: "completed" }
  )
  const cancellation = await cancellationState(orderId)
  assert.equal(cancellation.actorId, CUSTOMER_ID)
  assert.equal(cancellation.actorType, "customer")
  assert.equal(cancellation.reason, "Pesanan dibuat dua kali.")
})

test("another customer cannot request or execute an existing cancellation", async (t) => {
  const orderId = await createPaidOrder({ providerBacked: true })
  await requestAsAdmin(orderId)
  const cancellation = await cancellationState(orderId)
  const inventory = await inventoryState(orderId)
  let providerPosts = 0
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes("midtrans.com") && init?.method === "POST")
        providerPosts++
      return originalFetch(input, init)
    }
  )

  assert.deepEqual(
    await requestOrderCancellation({
      orderId,
      actorId: OTHER_CUSTOMER_ID,
      actorType: "customer",
      reason: "Bukan pesanan saya.",
    }),
    { kind: "not-found" }
  )
  assert.deepEqual(
    await executeOrderCancellation({
      orderId,
      actorId: OTHER_CUSTOMER_ID,
      actorType: "customer",
    }),
    { kind: "not-found" }
  )
  const after = await cancellationState(orderId)
  const afterInventory = await inventoryState(orderId)
  assert.equal(providerPosts, 0)
  assert.equal(after.status, cancellation.status)
  assert.equal(after.updatedAt.getTime(), cancellation.updatedAt.getTime())
  assert.equal(afterInventory.reservation.status, inventory.reservation.status)
  assert.equal(afterInventory.stock, inventory.stock)
})

test("admin can resume a customer request without rewriting requester audit fields", async () => {
  const orderId = await createOrder()
  const requested = await requestOrderCancellation({
    orderId,
    actorId: CUSTOMER_ID,
    actorType: "customer",
    reason: "Alamat pengiriman salah.",
  })
  assert.equal(requested.kind, "created")
  assert.deepEqual(
    await executeOrderCancellation({
      orderId,
      actorId: ADMIN_ID,
      actorType: "admin",
    }),
    { kind: "completed" }
  )
  const cancellation = await cancellationState(orderId)
  assert.equal(cancellation.actorId, CUSTOMER_ID)
  assert.equal(cancellation.actorType, "customer")
  assert.equal(cancellation.reason, "Alamat pengiriman salah.")
})

test("customer paid capture uses intentional Cancel and restores inventory once", async (t) => {
  const orderId = await createPaidOrder({ providerBacked: true })
  const before = await inventoryState(orderId)
  await requestAsCustomer(orderId)
  let cancelled = false
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      if (init?.method === "POST") cancelled = true
      return Response.json(
        midtransStatus(
          orderId,
          cancelled ? "cancel" : "capture",
          undefined,
          "credit_card"
        )
      )
    }
  )

  assert.deepEqual(
    await executeOrderCancellation({
      orderId,
      actorId: CUSTOMER_ID,
      actorType: "customer",
    }),
    { kind: "completed" }
  )
  const order = await orderState(orderId)
  const inventory = await inventoryState(orderId)
  assert.equal(order.paymentStatus, "cancelled")
  assert.equal(order.fulfillmentStatus, "cancelled")
  assert.equal(inventory.reservation.status, "cancelled")
  assert.equal(inventory.stock, before.stock + QUANTITY)
})

test("customer manual paid cancellation requires manual refund without Midtrans", async (t) => {
  const orderId = await createPaidOrder()
  await requestAsCustomer(orderId)
  let providerRequests = 0
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes("midtrans.com")) providerRequests++
      return originalFetch(input, init)
    }
  )

  assert.deepEqual(
    await executeOrderCancellation({
      orderId,
      actorId: CUSTOMER_ID,
      actorType: "customer",
    }),
    { kind: "manual_refund_required" }
  )
  assert.equal(providerRequests, 0)
  assert.equal(
    (await cancellationState(orderId)).status,
    "manual_refund_required"
  )
  assert.equal((await orderState(orderId)).fulfillmentStatus, "cancelled")
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

test("Snap cancellation racing credit-card settlement enters the full refund path", async (t) => {
  const orderId = await createOrder({
    providerBacked: true,
    snapToken: `snap-race-online-${suffix}-${randomUUID()}`,
    paymentInitStatus: "ready",
  })
  const before = await inventoryState(orderId)
  await requestAsAdmin(orderId)
  let statusReads = 0
  let snapCancelPosts = 0
  let refundPosts = 0
  let refundKey = ""
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (!url.includes("midtrans.com")) return originalFetch(input, init)
      if (init?.method === "POST" && url.endsWith("/refund")) {
        refundPosts++
        const body: unknown = JSON.parse(String(init.body))
        if (
          typeof body !== "object" ||
          body === null ||
          !("refund_key" in body)
        ) {
          throw new Error("Invalid refund body.")
        }
        refundKey = String(body.refund_key)
        return Response.json({
          ...midtransStatus(orderId, "refund", undefined, "credit_card"),
          refund_key: refundKey,
          refund_chargeback_id: "snap-race-online",
        })
      }
      if (init?.method === "POST") {
        snapCancelPosts++
        return Response.json({ canceled_at: new Date().toISOString() })
      }
      statusReads++
      if (statusReads === 1) return midtransNotFound()
      if (!refundKey) {
        return Response.json(
          midtransStatus(orderId, "settlement", undefined, "credit_card")
        )
      }
      return Response.json({
        ...midtransStatus(orderId, "refund", undefined, "credit_card"),
        refund_amount: String(PRICE * QUANTITY),
        refunds: [
          {
            refund_chargeback_id: "snap-race-online",
            refund_amount: String(PRICE * QUANTITY),
            refund_key: refundKey,
            bank_confirmed_at: "2026-09-18 12:00:00",
          },
        ],
      })
    }
  )

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "completed" }
  )
  const cancellation = await cancellationState(orderId)
  const inventory = await inventoryState(orderId)
  assert.equal(snapCancelPosts, 1)
  assert.equal(refundPosts, 1)
  assert.equal(cancellation.financialAction, "refund")
  assert.equal(cancellation.providerSelectedStatus, "snap_session")
  assert.equal(cancellation.providerTransactionReference, `tx-${orderId}`)
  assert.equal(cancellation.providerIdempotencyKey, refundKey)
  assert.equal(inventory.reservation.status, "cancelled")
  assert.equal(inventory.stock, before.stock + QUANTITY)
  assert.ok((await orderState(orderId)).cancellationRequestedAt)

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "completed" }
  )
  assert.equal((await inventoryState(orderId)).stock, inventory.stock)
  assert.equal(refundPosts, 1)
})

test("Snap cancellation racing bank-transfer settlement requires manual refund", async (t) => {
  const orderId = await createOrder({
    providerBacked: true,
    snapToken: `snap-race-offline-${suffix}-${randomUUID()}`,
    paymentInitStatus: "ready",
  })
  const before = await inventoryState(orderId)
  await requestAsAdmin(orderId)
  let statusReads = 0
  let snapCancelPosts = 0
  let refundPosts = 0
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (!url.includes("midtrans.com")) return originalFetch(input, init)
      if (init?.method === "POST" && url.endsWith("/refund")) {
        refundPosts++
        throw new Error("Offline settlement must not use Refund.")
      }
      if (init?.method === "POST") {
        snapCancelPosts++
        return Response.json({ canceled_at: new Date().toISOString() })
      }
      statusReads++
      if (statusReads === 1) return midtransNotFound()
      return Response.json(
        midtransStatus(orderId, "settlement", undefined, "bank_transfer")
      )
    }
  )

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "manual_refund_required" }
  )
  const cancellation = await cancellationState(orderId)
  const inventory = await inventoryState(orderId)
  assert.equal(snapCancelPosts, 1)
  assert.equal(refundPosts, 0)
  assert.equal(cancellation.financialAction, "manual_refund")
  assert.equal(cancellation.providerSelectedStatus, "snap_session")
  assert.equal(cancellation.providerTransactionReference, `tx-${orderId}`)
  assert.equal(cancellation.providerIdempotencyKey, null)
  assert.equal(inventory.reservation.status, "cancelled")
  assert.equal(inventory.stock, before.stock + QUANTITY)
  assert.ok((await orderState(orderId)).cancellationRequestedAt)

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "manual_refund_required" }
  )
  assert.equal((await inventoryState(orderId)).stock, inventory.stock)
  assert.equal(refundPosts, 0)
})

test("Snap cancellation promotes a newly bound transaction before Cancel", async (t) => {
  for (const transactionStatus of [
    "pending",
    "authorize",
    "capture",
  ] as const) {
    const orderId = await createOrder({
      providerBacked: true,
      snapToken: `snap-cancellable-${transactionStatus}-${suffix}-${randomUUID()}`,
      paymentInitStatus: "ready",
    })
    const before = await inventoryState(orderId)
    await requestAsAdmin(orderId)

    let statusReads = 0
    const postIdempotencyKeys: (string | null)[] = []
    const originalFetch = globalThis.fetch
    const cancellableStatus = {
      ...midtransStatus(orderId, transactionStatus),
      ...(transactionStatus === "capture" ? { fraud_status: "accept" } : {}),
    }

    t.mock.method(
      globalThis,
      "fetch",
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        if (!url.includes("midtrans.com")) return originalFetch(input, init)

        if (init?.method === "POST") {
          postIdempotencyKeys.push(
            new Headers(init.headers).get("Idempotency-Key")
          )
          return postIdempotencyKeys.length === 1
            ? Response.json({ canceled_at: new Date().toISOString() })
            : Response.json(midtransStatus(orderId, "cancel"))
        }

        statusReads++
        if (statusReads === 1) return midtransNotFound()
        if (postIdempotencyKeys.length === 1) {
          return Response.json(cancellableStatus)
        }
        return Response.json(midtransStatus(orderId, "cancel"))
      }
    )

    try {
      assert.deepEqual(
        await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
        { kind: "completed" }
      )
      const cancellation = await cancellationState(orderId)
      const inventory = await inventoryState(orderId)
      assert.equal(statusReads, transactionStatus === "capture" ? 4 : 3)
      assert.equal(postIdempotencyKeys.length, 2)
      assert.equal(postIdempotencyKeys[0], null)
      assert.equal(postIdempotencyKeys[1], cancellation.providerIdempotencyKey)
      assert.equal(cancellation.status, "completed")
      assert.equal(cancellation.financialAction, "cancel_payment")
      assert.equal(cancellation.providerSelectedStatus, transactionStatus)
      assert.equal(cancellation.providerTransactionReference, `tx-${orderId}`)
      assert.equal((await orderState(orderId)).paymentStatus, "cancelled")
      assert.equal((await orderState(orderId)).fulfillmentStatus, "cancelled")
      assert.equal(inventory.stock, before.stock + QUANTITY)
      assert.equal(
        inventory.reservation.status,
        transactionStatus === "capture" ? "cancelled" : "released"
      )

      assert.deepEqual(
        await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
        { kind: "completed" }
      )
      assert.equal((await inventoryState(orderId)).stock, inventory.stock)
      assert.equal(postIdempotencyKeys.length, 2)
      assert.equal(statusReads, transactionStatus === "capture" ? 4 : 3)
    } finally {
      t.mock.restoreAll()
    }
  }
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

test("an unrelated provider cancel cannot regress a paid order", async (t) => {
  const orderId = await createOrder({ providerBacked: true })
  const cancellation = await requestAsAdmin(orderId)
  const selected = await selectCancellationProviderAction({
    cancellationId: cancellation.id,
    actorId: ADMIN_ID,
    actorType: "admin",
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
    { kind: "pending" }
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

test("customer ambiguous unpaid Cancel remains active and shipping-blocked", async (t) => {
  const orderId = await createOrder({ providerBacked: true })
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      if (init?.method === "POST") throw new TypeError("timeout")
      return Response.json(midtransStatus(orderId, "pending"))
    }
  )

  await requestAsCustomer(orderId)
  assert.deepEqual(
    await executeOrderCancellation({
      orderId,
      actorId: CUSTOMER_ID,
      actorType: "customer",
    }),
    { kind: "pending" }
  )
  const cancellation = await cancellationState(orderId)
  assert.equal(cancellation.status, "provider_operation_pending")
  assert.ok((await orderState(orderId)).cancellationRequestedAt)
  assert.deepEqual(
    await recordOrderShipment({ orderId, tracking: "JP1234567890" }),
    { kind: "not-eligible" }
  )
})

test("manual paid order requires a manual refund while shipped and completed reject", async () => {
  const paidOrderId = await createOrder()
  assert.equal((await settleManualOrderPayment(paidOrderId)).kind, "settled")
  await requestAsAdmin(paidOrderId)
  assert.deepEqual(
    await executeAdminUnpaidCancellation({
      orderId: paidOrderId,
      actorId: ADMIN_ID,
    }),
    { kind: "manual_refund_required" }
  )
  assert.equal(
    (await cancellationState(paidOrderId)).status,
    "manual_refund_required"
  )
  assert.ok((await orderState(paidOrderId)).cancellationRequestedAt)

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

test("paid capture is intentionally voided and inventory is restored once", async (t) => {
  const orderId = await createPaidOrder({ providerBacked: true })
  const before = await inventoryState(orderId)
  await requestAsAdmin(orderId)
  let cancelled = false
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      if (init?.method === "POST") cancelled = true
      return Response.json(
        midtransStatus(
          orderId,
          cancelled ? "cancel" : "capture",
          undefined,
          "credit_card"
        )
      )
    }
  )

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "completed" }
  )
  const first = await inventoryState(orderId)
  assert.equal(first.reservation.status, "cancelled")
  assert.equal(first.stock, before.stock + QUANTITY)
  assert.equal(first.sold, before.sold - QUANTITY)
  assert.equal((await orderState(orderId)).paymentStatus, "cancelled")
  assert.equal(
    (await cancellationState(orderId)).providerSelectedStatus,
    "capture"
  )

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "completed" }
  )
  assert.equal((await inventoryState(orderId)).stock, first.stock)
})

test("unpaid cancellation continues through a capture race without clearing its hold", async (t) => {
  const orderId = await createOrder({ providerBacked: true })
  await requestAsAdmin(orderId)
  let statusReads = 0
  let cancelPosts = 0
  let cancelled = false
  let shipmentDuringRace: Awaited<
    ReturnType<typeof recordOrderShipment>
  > | null = null
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      if (init?.method === "POST") {
        cancelPosts++
        cancelled = true
        return Response.json(
          midtransStatus(orderId, "cancel", undefined, "credit_card")
        )
      }
      statusReads++
      if (cancelled) {
        return Response.json(
          midtransStatus(orderId, "cancel", undefined, "credit_card")
        )
      }
      if (statusReads === 1) {
        const response = Response.json(
          midtransStatus(orderId, "capture", undefined, "credit_card")
        )
        shipmentDuringRace = await recordOrderShipment({
          orderId,
          tracking: "JP1234567890",
        })
        return response
      }
      return Response.json(
        midtransStatus(orderId, "capture", undefined, "credit_card")
      )
    }
  )

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "completed" }
  )
  assert.deepEqual(shipmentDuringRace, { kind: "not-eligible" })
  assert.equal(cancelPosts, 1)
  assert.ok((await orderState(orderId)).cancellationRequestedAt)
  assert.notEqual((await cancellationState(orderId)).status, "failed")
})

test("capture Cancel racing settlement replaces the Cancel key with one stable refund key", async (t) => {
  const orderId = await createPaidOrder({ providerBacked: true })
  const cancellation = await requestAsAdmin(orderId)
  const refundKeys: string[] = []
  let statusReads = 0
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (!url.includes("midtrans.com")) return originalFetch(input, init)
      if (init?.method === "POST" && url.endsWith("/cancel")) {
        return Response.json(
          midtransStatus(orderId, "capture", undefined, "credit_card")
        )
      }
      if (init?.method === "POST" && url.endsWith("/refund")) {
        const body: unknown = JSON.parse(String(init.body))
        if (
          typeof body !== "object" ||
          body === null ||
          !("refund_key" in body)
        ) {
          throw new Error("Invalid refund body.")
        }
        refundKeys.push(String(body.refund_key))
        return Response.json({
          ...midtransStatus(orderId, "refund", undefined, "credit_card"),
          refund_key: String(body.refund_key),
          refund_chargeback_id: "refund-race",
        })
      }
      statusReads++
      if (statusReads === 1) {
        return Response.json(
          midtransStatus(orderId, "capture", undefined, "credit_card")
        )
      }
      if (statusReads === 2) {
        return Response.json(
          midtransStatus(orderId, "settlement", undefined, "credit_card")
        )
      }
      return Response.json({
        ...midtransStatus(orderId, "refund", undefined, "credit_card"),
        refund_amount: String(PRICE * QUANTITY),
        refunds: [
          {
            refund_chargeback_id: "refund-race",
            refund_amount: String(PRICE * QUANTITY),
            refund_key: refundKeys[0],
            bank_confirmed_at: "2026-09-18 12:00:00",
          },
        ],
      })
    }
  )

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "completed" }
  )
  const after = await cancellationState(orderId)
  assert.deepEqual(refundKeys, [`cancellation_${cancellation.id}`])
  assert.equal(after.providerIdempotencyKey, refundKeys[0])
  assert.equal(after.providerSelectedStatus, "capture")
  assert.equal(after.financialAction, "refund")
})

test("capture Cancel racing an offline settlement becomes manual_refund_required", async (t) => {
  const orderId = await createPaidOrder({ providerBacked: true })
  const before = await inventoryState(orderId)
  await requestAsAdmin(orderId)
  let statusReads = 0
  let cancelPosts = 0
  let refundPosts = 0
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (!url.includes("midtrans.com")) return originalFetch(input, init)
      if (init?.method === "POST" && url.endsWith("/cancel")) {
        cancelPosts++
        return Response.json(
          midtransStatus(orderId, "capture", undefined, "credit_card")
        )
      }
      if (init?.method === "POST") {
        refundPosts++
        throw new Error("Offline settlement must not use Refund.")
      }
      statusReads++
      return Response.json(
        midtransStatus(
          orderId,
          statusReads === 1 ? "capture" : "settlement",
          undefined,
          statusReads === 1 ? "credit_card" : "bank_transfer"
        )
      )
    }
  )

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "manual_refund_required" }
  )
  const cancellation = await cancellationState(orderId)
  const firstInventory = await inventoryState(orderId)
  assert.equal(cancelPosts, 1)
  assert.equal(refundPosts, 0)
  assert.equal(cancellation.financialAction, "manual_refund")
  assert.equal(cancellation.providerIdempotencyKey, null)
  assert.equal(cancellation.providerSelectedStatus, "capture")
  assert.equal(cancellation.status, "manual_refund_required")
  assert.equal(firstInventory.reservation.status, "cancelled")
  assert.equal(firstInventory.stock, before.stock + QUANTITY)
  assert.ok((await orderState(orderId)).cancellationRequestedAt)

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "manual_refund_required" }
  )
  assert.equal((await inventoryState(orderId)).stock, firstInventory.stock)
  assert.equal(refundPosts, 0)
})

test("unpaid cancellation continues through settlement into refund_pending", async (t) => {
  const orderId = await createOrder({ providerBacked: true })
  await requestAsAdmin(orderId)
  const refundKeys: string[] = []
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      if (init?.method === "POST") {
        const body: unknown = JSON.parse(String(init.body))
        if (
          typeof body !== "object" ||
          body === null ||
          !("refund_key" in body)
        ) {
          throw new Error("Invalid refund body.")
        }
        refundKeys.push(String(body.refund_key))
        throw new TypeError("timeout")
      }
      return Response.json(
        midtransStatus(orderId, "settlement", undefined, "credit_card")
      )
    }
  )

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "pending" }
  )
  const cancellation = await cancellationState(orderId)
  assert.equal(cancellation.status, "refund_pending")
  assert.deepEqual(refundKeys, [cancellation.providerIdempotencyKey])
  assert.ok((await orderState(orderId)).cancellationRequestedAt)
  assert.deepEqual(
    await recordOrderShipment({ orderId, tracking: "JP1234567890" }),
    { kind: "not-eligible" }
  )
})

test("settlement starts one full correlated refund and restores inventory", async (t) => {
  const orderId = await createPaidOrder({ providerBacked: true })
  const before = await inventoryState(orderId)
  await requestAsAdmin(orderId)
  let refundKey = ""
  let posted = false
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      if (init?.method === "POST") {
        const body: unknown = JSON.parse(String(init.body))
        if (typeof body !== "object" || body === null) {
          throw new Error("Invalid refund body.")
        }
        if (!("refund_key" in body) || !("amount" in body)) {
          throw new Error("Invalid refund body.")
        }
        refundKey = String(body.refund_key)
        assert.equal(body.amount, PRICE * QUANTITY)
        posted = true
        return Response.json({
          ...midtransStatus(orderId, "refund", undefined, "credit_card"),
          refund_key: refundKey,
          refund_chargeback_id: "refund-accepted",
        })
      }
      if (!posted) {
        return Response.json(
          midtransStatus(orderId, "settlement", undefined, "credit_card")
        )
      }
      return Response.json({
        ...midtransStatus(orderId, "refund", undefined, "credit_card"),
        refund_amount: String(PRICE * QUANTITY),
        refunds: [
          {
            refund_chargeback_id: "refund-accepted",
            refund_amount: String(PRICE * QUANTITY),
            refund_key: refundKey,
            bank_confirmed_at: "2026-09-18 12:00:00",
          },
        ],
      })
    }
  )

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "completed" }
  )
  const cancellation = await cancellationState(orderId)
  assert.equal(cancellation.financialAction, "refund")
  assert.equal(cancellation.refundAmount, PRICE * QUANTITY)
  assert.equal(cancellation.providerIdempotencyKey, refundKey)
  const inventory = await inventoryState(orderId)
  assert.equal(inventory.reservation.status, "cancelled")
  assert.equal(inventory.stock, before.stock + QUANTITY)
  assert.equal(inventory.sold, before.sold - QUANTITY)
})

test("a fully refunded provider transaction completes without another refund", async (t) => {
  const orderId = await createPaidOrder({ providerBacked: true })
  const before = await inventoryState(orderId)
  await requestAsAdmin(orderId)
  let statusReads = 0
  let refundPosts = 0
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (!url.includes("midtrans.com")) return originalFetch(input, init)
      if (init?.method === "POST") {
        if (url.endsWith("/refund")) refundPosts++
        throw new Error(
          "A fully refunded transaction must not be posted again."
        )
      }
      statusReads++
      return Response.json({
        ...midtransStatus(orderId, "refund", undefined, "credit_card"),
        refund_amount: String(PRICE * QUANTITY),
        refunds: [
          {
            refund_chargeback_id: "unrelated-refund",
            refund_amount: String(PRICE * QUANTITY),
            refund_key: "unrelated-refund",
            bank_confirmed_at: "2026-09-18 12:00:00",
          },
        ],
      })
    }
  )

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "completed" }
  )
  const cancellation = await cancellationState(orderId)
  const inventory = await inventoryState(orderId)
  assert.equal(statusReads, 1)
  assert.equal(refundPosts, 0)
  assert.equal(cancellation.status, "completed")
  assert.equal(cancellation.financialAction, "none")
  assert.equal(cancellation.refundAmount, null)
  assert.equal(cancellation.providerIdempotencyKey, null)
  assert.equal(cancellation.providerTransactionReference, `tx-${orderId}`)
  assert.equal((await orderState(orderId)).paymentStatus, "refunded")
  assert.equal((await orderState(orderId)).fulfillmentStatus, "cancelled")
  assert.equal(inventory.reservation.status, "cancelled")
  assert.equal(inventory.stock, before.stock + QUANTITY)
  assert.equal(inventory.sold, before.sold - QUANTITY)

  const reconciliation = await reconcileMidtransPayment(orderId)
  assert.equal(reconciliation.applied.kind, "ignored")
  assert.equal(reconciliation.applied.paymentStatus, "refunded")
  assert.equal((await orderState(orderId)).paymentStatus, "refunded")

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "completed" }
  )
  assert.equal(statusReads, 2)
  assert.equal(refundPosts, 0)
  assert.equal((await inventoryState(orderId)).stock, inventory.stock)
})

test("an unrelated partial provider refund stays unresolved", async (t) => {
  const orderId = await createPaidOrder({ providerBacked: true })
  const before = await inventoryState(orderId)
  await requestAsAdmin(orderId)
  let statusReads = 0
  let refundPosts = 0
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (!url.includes("midtrans.com")) return originalFetch(input, init)
      if (init?.method === "POST") {
        if (url.endsWith("/refund")) refundPosts++
        throw new Error("An unrelated partial refund must not be posted again.")
      }
      statusReads++
      return Response.json({
        ...midtransStatus(orderId, "partial_refund", undefined, "credit_card"),
        refund_amount: String(PRICE),
        refunds: [
          {
            refund_chargeback_id: "unrelated-partial-refund",
            refund_amount: String(PRICE),
            refund_key: "unrelated-partial-refund",
            bank_confirmed_at: null,
          },
        ],
      })
    }
  )

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "pending" }
  )
  const firstCancellation = await cancellationState(orderId)
  const firstInventory = await inventoryState(orderId)
  assert.equal(statusReads, 1)
  assert.equal(refundPosts, 0)
  assert.equal(firstCancellation.status, "requested")
  assert.equal(firstCancellation.reconciliationStatus, "failed")
  assert.equal(firstCancellation.financialAction, "undetermined")
  assert.equal(firstCancellation.providerIdempotencyKey, null)
  assert.equal(firstInventory.reservation.status, "consumed")
  assert.equal(firstInventory.stock, before.stock)
  assert.equal(firstInventory.sold, before.sold)

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "pending" }
  )
  assert.equal(statusReads, 2)
  assert.equal(refundPosts, 0)
  assert.equal((await inventoryState(orderId)).stock, firstInventory.stock)
})

test("a prior terminal unpaid failure is reactivated on the same paid cancellation", async () => {
  const orderId = await createPaidOrder()
  const cancellation = await requestAsAdmin(orderId)
  await db
    .update(orderCancellation)
    .set({
      status: "failed",
      reconciliationStatus: "reconciled",
      lastError: "Order became paid in the old unpaid workflow.",
    })
    .where(eq(orderCancellation.id, cancellation.id))
  await db
    .update(customerOrder)
    .set({ cancellationRequestedAt: null })
    .where(eq(customerOrder.id, orderId))

  assert.deepEqual(
    await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
    { kind: "manual_refund_required" }
  )
  const after = await cancellationState(orderId)
  assert.equal(after.id, cancellation.id)
  assert.equal(after.status, "manual_refund_required")
  assert.equal(after.lastError, null)
  assert.ok((await orderState(orderId)).cancellationRequestedAt)
})

test("shipping and paid cancellation cannot both commit", async () => {
  const orderId = await createPaidOrder()
  const [requested, shipped] = await Promise.all([
    requestOrderCancellation({
      orderId,
      actorId: ADMIN_ID,
      actorType: "admin",
      reason: "Uji serialisasi pembatalan dan pengiriman.",
    }),
    recordOrderShipment({ orderId, tracking: "JP1234567890" }),
  ])
  const cancelled =
    requested.kind === "created" || requested.kind === "existing"
      ? await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID })
      : null
  assert.equal(
    shipped.kind === "shipped" &&
      cancelled !== null &&
      ["completed", "refund_pending", "manual_refund_required"].includes(
        cancelled.kind
      ),
    false
  )
})

test("offline and unknown settlement methods take different safe paths", async (t) => {
  for (const [paymentType, expected] of [
    ["bank_transfer", "manual_refund_required"],
    ["future_wallet", "pending"],
  ] as const) {
    const orderId = await createPaidOrder({ providerBacked: true })
    await requestAsAdmin(orderId)
    const originalFetch = globalThis.fetch
    t.mock.method(
      globalThis,
      "fetch",
      async (input: string | URL | Request, init?: RequestInit) => {
        if (!String(input).includes("midtrans.com"))
          return originalFetch(input, init)
        assert.notEqual(init?.method, "POST")
        return Response.json(
          midtransStatus(orderId, "settlement", undefined, paymentType)
        )
      }
    )
    assert.deepEqual(
      await executeAdminUnpaidCancellation({ orderId, actorId: ADMIN_ID }),
      { kind: expected }
    )
    const inventory = await inventoryState(orderId)
    assert.equal(
      inventory.reservation.status,
      expected === "manual_refund_required" ? "cancelled" : "consumed"
    )
    t.mock.restoreAll()
  }
})

test("admin row eligibility includes paid unshipped processing orders", () => {
  assert.equal(
    canCancelUnpaidOrder({
      paymentStatus: "pending",
      fulfillmentStatus: "awaiting_payment",
      tracking: null,
    }),
    true
  )
  assert.equal(
    canCancelUnpaidOrder({
      paymentStatus: "paid",
      fulfillmentStatus: "processing",
      tracking: null,
    }),
    true
  )
  for (const candidate of [
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
