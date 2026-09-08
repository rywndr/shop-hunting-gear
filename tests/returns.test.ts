import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test, { before, after } from "node:test"
import { eq, inArray, sql } from "drizzle-orm"
import { db } from "../lib/db/client"
import { user } from "../lib/db/schema/auth"
import { product } from "../lib/db/schema/product"
import {
  customerOrder,
  customerOrderItem,
  orderInventoryReservation,
} from "../lib/db/schema/order"
import {
  returnEvent,
  returnPhoto,
  returnRefund,
  returnRequest,
  returnRequestItem,
  returnRestock,
} from "../lib/db/schema/return"
import {
  completeOrderFulfillment,
  confirmOrderReceivedForUser,
} from "../lib/orders/service"
import {
  createReturnRequest,
  customerReturnStates,
  reviewReturn,
} from "../lib/returns/service"
import {
  confirmOfflineRefund,
  reconcileReturnRefunds,
  startReturnRefund,
} from "../lib/returns/refunds"
import { isReturnEligible } from "../lib/returns/eligibility"
import { RETURN_WINDOW_MS } from "../lib/returns/config"
import { confirmedOrderRefundSql } from "../lib/returns/finance"
import {
  matchingProviderRefund,
  onlineRefundSupported,
  returnRefundMethod,
} from "../lib/returns/refund-policy"
import {
  midtransStatusResponseSchema,
  type MidtransStatusResponse,
} from "../lib/payments/midtrans/schema"
import { returnRequestSchema } from "../lib/returns/schema"
import { POST as notifyMidtrans } from "../app/api/payments/midtrans/notifications/route"
import { midtransSignature } from "../lib/payments/midtrans/security"
import { midtransServerConfig } from "../lib/payments/midtrans/config"

const suffix = randomUUID()
const buyerId = `return-buyer-${suffix}`
const adminId = `return-admin-${suffix}`
const productId = `return-product-${suffix}`
const productSlug = `return-test-${suffix}`
const orders: string[] = []

before(async () => {
  await db.insert(user).values([
    {
      id: buyerId,
      name: "Return buyer",
      email: `${buyerId}@example.test`,
      role: "user",
    },
    {
      id: adminId,
      name: "Return admin",
      email: `${adminId}@example.test`,
      role: "admin",
    },
  ])
  await db.insert(product).values({
    id: productId,
    slug: productSlug,
    name: "Return fixture",
    category: "hunting",
    price: 100000,
    stock: 5,
    sold: 10,
    weight: 100,
    description: ["Fixture"],
    images: [
      { id: randomUUID(), objectKey: "test/photo.webp", alt: "Fixture" },
    ],
    variants: [],
    ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    reviews: [],
  })
})
after(async () => {
  if (orders.length) {
    const requests = await db
      .select()
      .from(returnRequest)
      .where(inArray(returnRequest.orderId, orders))
    const ids = requests.map(({ id }) => id)
    if (ids.length) {
      const items = await db
        .select()
        .from(returnRequestItem)
        .where(inArray(returnRequestItem.returnId, ids))
      if (items.length)
        await db.delete(returnRestock).where(
          inArray(
            returnRestock.returnItemId,
            items.map(({ id }) => id)
          )
        )
      await db.delete(returnEvent).where(inArray(returnEvent.returnId, ids))
      await db.delete(returnRefund).where(inArray(returnRefund.returnId, ids))
      await db.delete(returnPhoto).where(inArray(returnPhoto.returnId, ids))
      await db
        .delete(returnRequestItem)
        .where(inArray(returnRequestItem.returnId, ids))
      await db.delete(returnRequest).where(inArray(returnRequest.id, ids))
    }
    await db.delete(customerOrder).where(inArray(customerOrder.id, orders))
  }
  await db.delete(product).where(eq(product.id, productId))
  await db.delete(user).where(inArray(user.id, [buyerId, adminId]))
})

async function fixture({
  online = false,
  completed = true,
}: { online?: boolean; completed?: boolean } = {}) {
  const id = `return-order-${randomUUID()}`
  orders.push(id)
  await db.insert(customerOrder).values({
    id,
    userId: buyerId,
    fulfillmentStatus: completed ? "completed" : "shipped",
    paymentStatus: "paid",
    sourceKind: online ? "product" : "manual",
    midtransCreateIdempotencyKey: online ? randomUUID() : null,
    midtransTransactionId: online ? `tx-${id}` : null,
    midtransPaymentType: online ? "gopay" : null,
    shippingCourier: "manual",
    shippingCourierName: "Manual",
    shippingService: "Courier",
    shippingCost: 10000,
    grossAmount: 210000,
    completedAt: completed ? sql`now()` : null,
    paidAt: new Date(),
    addressSnapshot: {
      recipient: "Buyer",
      phone: "08123456789",
      street: "Street",
      province: "Province",
      city: "City",
      district: "District",
      subdistrict: "Village",
      postalCode: "12345",
    },
  })
  await db.insert(customerOrderItem).values({
    id: randomUUID(),
    orderId: id,
    productSlug,
    name: "Fixture",
    variants: [],
    quantity: 2,
    price: 100000,
  })
  await db.insert(orderInventoryReservation).values({
    id: randomUUID(),
    orderId: id,
    productSlug,
    quantity: 2,
    status: "consumed",
    consumedAt: new Date(),
  })
  return id
}
async function submit(orderId: string, owner = buyerId) {
  return createReturnRequest({
    userId: owner,
    orderId,
    reason: "damaged",
    details: "Rusak saat diterima",
    photos: [
      { id: randomUUID(), objectKey: `returns/test/${randomUUID()}.webp` },
    ],
  })
}
async function requestItems(returnId: string) {
  return db
    .select()
    .from(returnRequestItem)
    .where(eq(returnRequestItem.returnId, returnId))
}
async function inspect(returnId: string, resellableQuantity = 0) {
  const items = await requestItems(returnId)
  return reviewReturn({
    actorId: adminId,
    input: {
      kind: "inspect",
      returnId,
      note: "Barang diterima dan diperiksa",
      items: items.map((item) => ({
        id: item.id,
        receivedQuantity: item.quantity,
        resellableQuantity,
      })),
    },
  })
}
async function readyReturn(online = false) {
  const orderId = await fixture({ online })
  const request = await submit(orderId)
  assert.equal(request.kind, "created")
  if (request.kind !== "created")
    throw new Error("Fixture return was not created.")
  assert.equal(
    await reviewReturn({
      actorId: adminId,
      input: { kind: "approve", returnId: request.id, note: "Approved" },
    }),
    true
  )
  assert.equal(await inspect(request.id), true)
  return { orderId, returnId: request.id }
}
function status(
  orderId: string,
  overrides: Partial<MidtransStatusResponse> = {}
): MidtransStatusResponse {
  return {
    order_id: orderId,
    transaction_id: `tx-${orderId}`,
    transaction_status: "settlement",
    status_code: "200",
    gross_amount: "210000.00",
    payment_type: "gopay",
    ...overrides,
  }
}
async function refundFor(returnId: string) {
  const [row] = await db
    .select()
    .from(returnRefund)
    .where(eq(returnRefund.returnId, returnId))
  assert.ok(row)
  return row
}

test("eligibility uses completion, excludes legacy/future/expired/rejected claims", () => {
  const now = new Date("2026-09-07T00:00:00Z")
  const base = {
    completedAt: new Date(now.getTime() - RETURN_WINDOW_MS + 1),
    fulfillmentStatus: "completed",
    paymentStatus: "paid",
    midtransRefundAmount: null,
    midtransChargebackAmount: null,
    hasRequest: false,
    now,
  } as const
  assert.equal(isReturnEligible(base), true)
  assert.equal(
    isReturnEligible({
      ...base,
      completedAt: new Date(now.getTime() - RETURN_WINDOW_MS),
    }),
    false
  )
  assert.equal(isReturnEligible({ ...base, completedAt: null }), false)
  assert.equal(
    isReturnEligible({ ...base, completedAt: new Date(now.getTime() + 1) }),
    false
  )
  assert.equal(isReturnEligible({ ...base, hasRequest: true }), false)
  assert.equal(
    isReturnEligible({ ...base, fulfillmentStatus: "shipped" }),
    false
  )
  for (const paymentStatus of [
    "partial_refund",
    "refunded",
    "partial_chargeback",
    "chargeback",
  ] as const) {
    assert.equal(isReturnEligible({ ...base, paymentStatus }), false)
  }
  assert.equal(isReturnEligible({ ...base, midtransRefundAmount: 1 }), false)
  assert.equal(
    isReturnEligible({ ...base, midtransChargebackAmount: 1 }),
    false
  )
  assert.equal(
    returnRequestSchema.safeParse({
      orderId: "id",
      reason: "changed_mind",
      details: "details",
    }).success,
    false
  )
  assert.equal(
    returnRequestSchema.safeParse({
      orderId: "id",
      reason: "damaged",
      details: "details",
    }).success,
    true
  )
})

test("provider capability and refund correlation are strict", () => {
  for (const paymentType of [null, undefined, "unrecognized_method"]) {
    assert.equal(
      returnRefundMethod({ paymentType, amount: 100, grossAmount: 110 }),
      "unknown"
    )
  }
  for (const paymentType of [
    "bank_transfer",
    "echannel",
    "cstore",
    "shopeepay",
    "ovo",
  ]) {
    assert.equal(
      returnRefundMethod({ paymentType, amount: 100, grossAmount: 110 }),
      "offline"
    )
  }
  assert.equal(
    returnRefundMethod({ paymentType: "gopay", amount: 100, grossAmount: 110 }),
    "midtrans"
  )
  assert.equal(
    onlineRefundSupported({
      paymentType: "bank_transfer",
      amount: 100,
      grossAmount: 100,
    }),
    false
  )
  assert.equal(
    onlineRefundSupported({
      paymentType: "shopeepay",
      amount: 100,
      grossAmount: 110,
    }),
    false
  )
  assert.equal(
    onlineRefundSupported({
      paymentType: "ovo",
      amount: 100,
      grossAmount: 100,
    }),
    true
  )
  const payment = midtransStatusResponseSchema.parse(
    status("id", {
      transaction_status: "partial_refund",
      refund_amount: "100.00",
      refunds: [
        {
          refund_chargeback_id: "1",
          refund_key: "key",
          refund_amount: "100.00",
          bank_confirmed_at: "2026-09-07 12:00:00",
        },
      ],
    })
  )
  assert.ok(
    matchingProviderRefund({ payment, refundKey: "key", amount: 100 })
      ?.bankConfirmedAt
  )
  assert.equal(
    matchingProviderRefund({ payment, refundKey: "other", amount: 100 }),
    null
  )
  assert.equal(
    matchingProviderRefund({ payment, refundKey: "key", amount: 99 }),
    null
  )
})

test("both completion paths set completed_at once under concurrent repeats", async () => {
  const orderId = await fixture({ completed: false })
  assert.equal(
    (await confirmOrderReceivedForUser({ orderId, userId: adminId })).kind,
    "not-found"
  )
  const results = await Promise.all([
    confirmOrderReceivedForUser({ orderId, userId: buyerId }),
    completeOrderFulfillment(orderId),
  ])
  assert.ok(results.some(({ kind }) => kind === "completed"))
  const [first] = await db
    .select()
    .from(customerOrder)
    .where(eq(customerOrder.id, orderId))
  assert.ok(first.completedAt)
  await completeOrderFulfillment(orderId)
  await confirmOrderReceivedForUser({ orderId, userId: buyerId })
  const [second] = await db
    .select()
    .from(customerOrder)
    .where(eq(customerOrder.id, orderId))
  assert.equal(second.completedAt?.getTime(), first.completedAt.getTime())
})

test("database ownership, legacy eligibility, and duplicate claims are guarded", async () => {
  const orderId = await fixture()
  assert.equal((await submit(orderId, adminId)).kind, "not-eligible")
  const results = await Promise.all([submit(orderId), submit(orderId)])
  assert.equal(results.filter(({ kind }) => kind === "created").length, 1)
  const created = results.find((result) => result.kind === "created")
  assert.ok(created && created.kind === "created")
  const items = await requestItems(created.id)
  assert.equal(items.length, 1)
  assert.equal(items[0].quantity, 2)
  assert.equal(
    await reviewReturn({
      actorId: buyerId,
      input: { kind: "approve", returnId: created.id, note: "Unauthorized" },
    }),
    false
  )
  assert.equal(
    await reviewReturn({
      actorId: adminId,
      input: { kind: "reject", returnId: created.id, note: "Rejected" },
    }),
    true
  )
  assert.equal((await submit(orderId)).kind, "duplicate")
  const legacy = await fixture()
  await db
    .update(customerOrder)
    .set({ completedAt: null })
    .where(eq(customerOrder.id, legacy))
  assert.equal((await submit(legacy)).kind, "not-eligible")
  await db
    .update(customerOrder)
    .set({
      completedAt: sql`now() - interval '7 days 1 second'`,
      updatedAt: new Date(),
    })
    .where(eq(customerOrder.id, legacy))
  assert.equal((await submit(legacy)).kind, "not-eligible")
  assert.equal(
    (await customerReturnStates({ userId: adminId, orderIds: [orderId] })).size,
    0
  )
})

test("restocking is atomic, resellable-only and idempotent without releasing consumed stock", async () => {
  const orderId = await fixture()
  const result = await submit(orderId)
  assert.ok(result.kind === "created")
  assert.equal(await inspect(result.id, 1), false)
  await reviewReturn({
    actorId: adminId,
    input: { kind: "approve", returnId: result.id, note: "Approved" },
  })
  assert.equal(await inspect(result.id, 3), false)
  const items = await requestItems(result.id)
  assert.equal(
    await reviewReturn({
      actorId: adminId,
      input: {
        kind: "inspect",
        returnId: result.id,
        note: "Missing quantity",
        items: items.map(({ id }) => ({
          id,
          receivedQuantity: 1,
          resellableQuantity: 1,
        })),
      },
    }),
    false
  )
  const [beforeStock] = await db
    .select()
    .from(product)
    .where(eq(product.id, productId))
  const inspections = await Promise.all([
    inspect(result.id, 1),
    inspect(result.id, 1),
  ])
  assert.equal(inspections.filter(Boolean).length, 1)
  const [afterStock] = await db
    .select()
    .from(product)
    .where(eq(product.id, productId))
  assert.equal(afterStock.stock, beforeStock.stock + 1)
  assert.equal(afterStock.sold, beforeStock.sold)
  const [reservation] = await db
    .select()
    .from(orderInventoryReservation)
    .where(eq(orderInventoryReservation.orderId, orderId))
  assert.equal(reservation.status, "consumed")
})

test("offline refund uses database merchandise amount and affects finance only when confirmed", async () => {
  const { orderId, returnId } = await readyReturn()
  assert.equal(await startReturnRefund({ returnId, actorId: adminId }), true)
  const refund = await refundFor(returnId)
  assert.equal(refund.amount, 200000)
  assert.equal(refund.method, "offline")
  assert.equal(
    await confirmOfflineRefund({
      returnId,
      actorId: buyerId,
      reference: "fake",
    }),
    false
  )
  const [beforeRefund] = await db
    .select({ amount: confirmedOrderRefundSql() })
    .from(customerOrder)
    .where(eq(customerOrder.id, orderId))
  assert.equal(Number(beforeRefund.amount), 0)
  assert.equal(
    await confirmOfflineRefund({
      returnId,
      actorId: adminId,
      reference: "bank-reference-123",
    }),
    true
  )
  const [afterRefund] = await db
    .select({ amount: confirmedOrderRefundSql() })
    .from(customerOrder)
    .where(eq(customerOrder.id, orderId))
  assert.equal(Number(afterRefund.amount), 200000)
})

test("Midtrans POST success is not confirmation; GET correlates key and bank confirmation", async (t) => {
  const { orderId, returnId } = await readyReturn(true)
  let key = ""
  let payment = status(orderId)
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (!url.includes("midtrans.com")) return originalFetch(input, init)
      if (url.endsWith("/status")) return Response.json(payment)
      assert.ok(url.endsWith(`/tx-${orderId}/refund`))
      const body = JSON.parse(String(init?.body))
      const persisted = await refundFor(returnId)
      key = persisted.refundKey
      assert.equal(body.refund_key, key)
      assert.equal(body.amount, 200000)
      return Response.json({
        ...status(orderId),
        transaction_status: "partial_refund",
        refund_key: key,
        refund_chargeback_id: 42,
        refund_amount: "200000.00",
      })
    }
  )
  assert.equal(await startReturnRefund({ returnId, actorId: adminId }), true)
  assert.equal((await refundFor(returnId)).status, "pending")
  await reconcileReturnRefunds(
    status(orderId, {
      transaction_status: "partial_refund",
      refund_amount: "200000.00",
    })
  )
  const [uncorrelated] = await db
    .select({ amount: confirmedOrderRefundSql() })
    .from(customerOrder)
    .where(eq(customerOrder.id, orderId))
  assert.equal(
    Number(uncorrelated.amount),
    0,
    "cumulative totals alone cannot confirm our pending refund"
  )
  payment = status(orderId, {
    transaction_status: "partial_refund",
    refund_amount: "200000.00",
    refunds: [
      {
        refund_chargeback_id: "42",
        refund_key: key,
        refund_amount: "200000.00",
      },
    ],
  })
  await reconcileReturnRefunds(payment)
  assert.equal((await refundFor(returnId)).status, "pending")
  const [pending] = await db
    .select({ amount: confirmedOrderRefundSql() })
    .from(customerOrder)
    .where(eq(customerOrder.id, orderId))
  assert.equal(Number(pending.amount), 0)
  payment = {
    ...payment,
    refunds: [
      {
        refund_chargeback_id: "42",
        refund_key: key,
        refund_amount: "200000.00",
        bank_confirmed_at: "2026-09-07 12:00:00",
      },
    ],
  }
  await Promise.all([
    reconcileReturnRefunds(payment),
    reconcileReturnRefunds(payment),
  ])
  assert.equal((await refundFor(returnId)).status, "confirmed")
  await reconcileReturnRefunds({
    ...payment,
    refunds: [
      {
        refund_chargeback_id: "42",
        refund_key: key,
        refund_amount: "200000.00",
      },
    ],
  })
  const confirmedBeforeRetry = await refundFor(returnId)
  assert.equal(confirmedBeforeRetry.status, "confirmed")
  assert.equal(confirmedBeforeRetry.blockedReason, null)
  assert.equal(await startReturnRefund({ returnId, actorId: adminId }), true)
  const confirmedAfterRetry = await refundFor(returnId)
  assert.equal(confirmedAfterRetry.status, "confirmed")
  assert.equal(
    confirmedAfterRetry.confirmedAt?.getTime(),
    confirmedBeforeRetry.confirmedAt?.getTime()
  )
  const [confirmed] = await db
    .select({ amount: confirmedOrderRefundSql() })
    .from(customerOrder)
    .where(eq(customerOrder.id, orderId))
  assert.equal(Number(confirmed.amount), 200000)
})

test("timeouts retry the persisted key and stop after the seven-day key window", async (t) => {
  const { orderId, returnId } = await readyReturn(true)
  const keys: string[] = []
  const originalFetch = globalThis.fetch
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      if (String(input).endsWith("/status"))
        return Response.json(status(orderId))
      keys.push(JSON.parse(String(init?.body)).refund_key)
      throw new Error("Connection timed out.")
    }
  )
  await startReturnRefund({ returnId, actorId: adminId })
  await startReturnRefund({ returnId, actorId: adminId })
  assert.equal(keys.length, 2)
  assert.equal(keys[0], keys[1])
  const refund = await refundFor(returnId)
  assert.equal(refund.method, "midtrans")
  await db
    .update(returnRefund)
    .set({ firstAttemptAt: sql`now() - interval '7 days 1 second'` })
    .where(eq(returnRefund.id, refund.id))
  assert.equal(await startReturnRefund({ returnId, actorId: adminId }), false)
  assert.equal(keys.length, 2)
  assert.equal((await refundFor(returnId)).refundKey, keys[0])
})

test("unsupported partial methods prepare an audited offline refund without POST", async (t) => {
  const { orderId, returnId } = await readyReturn(true)
  const originalFetch = globalThis.fetch
  let posts = 0
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      if (init?.method === "POST") posts++
      return Response.json(status(orderId, { payment_type: "shopeepay" }))
    }
  )
  assert.equal(await startReturnRefund({ returnId, actorId: buyerId }), false)
  assert.equal(await startReturnRefund({ returnId, actorId: adminId }), true)
  assert.equal(posts, 0)
  assert.equal((await refundFor(returnId)).method, "offline")
  assert.equal(
    await confirmOfflineRefund({
      returnId,
      actorId: adminId,
      reference: "offline-42",
    }),
    true
  )
  assert.equal(
    await confirmOfflineRefund({
      returnId,
      actorId: adminId,
      reference: "offline-42",
    }),
    true
  )
  const audit = await db
    .select()
    .from(returnEvent)
    .where(eq(returnEvent.returnId, returnId))
  assert.equal(
    audit.filter(({ kind }) => kind === "refund_confirmed_offline").length,
    1
  )
})

test("concurrent refund triggers issue one provider request and duplicate IDs reconcile", async (t) => {
  const { orderId, returnId } = await readyReturn(true)
  const originalFetch = globalThis.fetch
  let posts = 0
  let key = ""
  let afterPost = false
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      if (String(input).endsWith("/status"))
        return Response.json(
          afterPost
            ? status(orderId, {
                transaction_status: "partial_refund",
                refund_amount: "200000.00",
                refunds: [
                  {
                    refund_chargeback_id: "45",
                    refund_key: key,
                    refund_amount: "200000.00",
                    bank_confirmed_at: "2026-09-07 12:00:00",
                  },
                ],
              })
            : status(orderId)
        )
      posts++
      key = JSON.parse(String(init?.body)).refund_key
      afterPost = true
      return Response.json({
        status_code: "406",
        status_message: "Duplicate refund ID",
      })
    }
  )
  await Promise.all([
    startReturnRefund({ returnId, actorId: adminId }),
    startReturnRefund({ returnId, actorId: adminId }),
  ])
  assert.equal(posts, 1)
  assert.equal((await refundFor(returnId)).status, "confirmed")
  await assert.rejects(
    reconcileReturnRefunds(
      status(orderId, {
        transaction_status: "partial_refund",
        refund_amount: "190000.00",
        refunds: [
          {
            refund_chargeback_id: "45",
            refund_key: key,
            refund_amount: "190000.00",
          },
        ],
      })
    ),
    /does not match/
  )
})

test("an explicit first rejection permits offline handling, but an earlier timeout forbids switching", async (t) => {
  const first = await readyReturn(true)
  const uncertain = await readyReturn(true)
  const originalFetch = globalThis.fetch
  let timedOut = false
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (!url.includes("midtrans.com")) return originalFetch(input, init)
      const id = url.includes(uncertain.orderId)
        ? uncertain.orderId
        : first.orderId
      if (url.endsWith("/status")) return Response.json(status(id))
      if (id === uncertain.orderId && !timedOut) {
        timedOut = true
        throw new Error("Timeout.")
      }
      return Response.json({
        status_code: "412",
        status_message: "Merchant cannot modify the status of the transaction",
      })
    }
  )
  await startReturnRefund({ returnId: first.returnId, actorId: adminId })
  assert.equal((await refundFor(first.returnId)).method, "offline")
  await startReturnRefund({ returnId: uncertain.returnId, actorId: adminId })
  await startReturnRefund({ returnId: uncertain.returnId, actorId: adminId })
  const result = await refundFor(uncertain.returnId)
  assert.equal(result.method, "midtrans")
  assert.equal(result.status, "blocked")
})

test("prior reversals block customer eligibility and the database mutation", async () => {
  const reversals = [
    { paymentStatus: "partial_refund" },
    { paymentStatus: "refunded" },
    { paymentStatus: "partial_chargeback" },
    { paymentStatus: "chargeback" },
    { midtransRefundAmount: 1 },
    { midtransChargebackAmount: 1 },
  ] as const
  for (const reversal of reversals) {
    const orderId = await fixture({ online: true })
    await db
      .update(customerOrder)
      .set(reversal)
      .where(eq(customerOrder.id, orderId))
    const states = await customerReturnStates({
      userId: buyerId,
      orderIds: [orderId],
    })
    assert.equal(states.get(orderId)?.kind, "unavailable")
    assert.equal((await submit(orderId)).kind, "not-eligible")
    const requests = await db
      .select()
      .from(returnRequest)
      .where(eq(returnRequest.orderId, orderId))
    assert.equal(requests.length, 0)
  }
})

test("unknown payment methods block first, then recover from authoritative status", async (t) => {
  const originalFetch = globalThis.fetch
  let posts = 0
  const keys: string[] = []
  let payment = status("unassigned")
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      if (init?.method === "POST") {
        posts++
        const body = JSON.parse(String(init?.body)) as { refund_key: string }
        keys.push(body.refund_key)
        payment = status(payment.order_id, {
          transaction_status: "partial_refund",
          refund_amount: "200000.00",
          refunds: [
            {
              refund_chargeback_id: `recovered-${posts}`,
              refund_key: body.refund_key,
              refund_amount: "200000.00",
            },
          ],
        })
        return Response.json({
          ...payment,
          refund_key: body.refund_key,
          refund_chargeback_id: `recovered-${posts}`,
        })
      }
      return Response.json(payment)
    }
  )
  for (const paymentType of [null, undefined, "unrecognized_method"]) {
    const { orderId, returnId } = await readyReturn(true)
    const postsBefore = posts
    // A persisted gopay type cannot override an unidentified fresh status.
    payment = status(orderId, { payment_type: paymentType })
    assert.equal(await startReturnRefund({ returnId, actorId: adminId }), false)
    const refund = await refundFor(returnId)
    assert.equal(refund.status, "blocked")
    assert.equal(refund.method, "midtrans")
    assert.equal(refund.blockedReason, "unknown_payment_method")
    assert.equal(refund.firstAttemptAt, null)
    const refundKey = refund.refundKey
    assert.equal(posts, postsBefore)

    payment = status(orderId)
    await reconcileReturnRefunds(payment)
    const recovered = await refundFor(returnId)
    assert.equal(recovered.status, "ready")
    assert.equal(recovered.method, "midtrans")
    assert.equal(recovered.refundKey, refundKey)
    assert.equal(posts, postsBefore)

    assert.equal(await startReturnRefund({ returnId, actorId: adminId }), true)
    const attempted = await refundFor(returnId)
    assert.equal(attempted.status, "pending")
    assert.equal(attempted.method, "midtrans")
    assert.equal(attempted.refundKey, refundKey)
    assert.equal(keys.at(-1), refundKey)
    assert.equal(posts, postsBefore + 1)
  }
  assert.equal(posts, 3)
  assert.equal(new Set(keys).size, 3)
})

test("unknown payment method recovers to the audited offline path", async (t) => {
  const { orderId, returnId } = await readyReturn(true)
  const originalFetch = globalThis.fetch
  let posts = 0
  let payment = status(orderId, { payment_type: null })
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      if (init?.method === "POST") posts++
      return Response.json(payment)
    }
  )
  assert.equal(await startReturnRefund({ returnId, actorId: adminId }), false)
  const blocked = await refundFor(returnId)
  assert.equal(blocked.status, "blocked")
  assert.equal(blocked.blockedReason, "unknown_payment_method")
  const refundKey = blocked.refundKey

  payment = status(orderId, { payment_type: "bank_transfer" })
  await reconcileReturnRefunds(payment)
  const recovered = await refundFor(returnId)
  assert.equal(recovered.status, "ready")
  assert.equal(recovered.method, "offline")
  assert.equal(recovered.refundKey, refundKey)
  assert.equal(posts, 0)
  assert.equal(await startReturnRefund({ returnId, actorId: adminId }), true)
  assert.equal(posts, 0)
  assert.equal(
    await confirmOfflineRefund({
      returnId,
      actorId: adminId,
      reference: "recovered-offline-42",
    }),
    true
  )
  const events = await db
    .select()
    .from(returnEvent)
    .where(eq(returnEvent.returnId, returnId))
  assert.equal(
    events.filter(({ kind }) => kind === "refund_offline_required").length,
    1
  )
  assert.equal((await refundFor(returnId)).status, "confirmed")
})

test("an attempted refund cannot switch to offline after an unknown method block", async (t) => {
  const { orderId, returnId } = await readyReturn(true)
  const originalFetch = globalThis.fetch
  let posts = 0
  let payment = status(orderId)
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      if (String(input).endsWith("/status")) return Response.json(payment)
      posts++
      throw new Error("Connection timed out.")
    }
  )

  assert.equal(await startReturnRefund({ returnId, actorId: adminId }), true)
  const attempted = await refundFor(returnId)
  assert.equal(attempted.status, "pending")
  assert.ok(attempted.firstAttemptAt)
  assert.equal(posts, 1)
  const refundKey = attempted.refundKey

  payment = status(orderId, { payment_type: null })
  assert.equal(await startReturnRefund({ returnId, actorId: adminId }), false)
  const blocked = await refundFor(returnId)
  assert.equal(blocked.status, "blocked")
  assert.equal(blocked.method, "midtrans")
  assert.equal(blocked.blockedReason, null)
  assert.ok(blocked.firstAttemptAt)
  assert.equal(blocked.refundKey, refundKey)

  payment = status(orderId, { payment_type: "bank_transfer" })
  await reconcileReturnRefunds(payment)
  assert.equal(await startReturnRefund({ returnId, actorId: adminId }), false)
  const final = await refundFor(returnId)
  assert.equal(final.status, "blocked")
  assert.equal(final.method, "midtrans")
  assert.equal(final.blockedReason, null)
  assert.equal(final.refundKey, refundKey)
  assert.equal(posts, 1)
  const events = await db
    .select()
    .from(returnEvent)
    .where(eq(returnEvent.returnId, returnId))
  assert.equal(
    events.filter(({ kind }) => kind === "refund_offline_required").length,
    0
  )
})

test("definitive rejection blocks repeated actions even if reconciliation fails", async (t) => {
  const originalFetch = globalThis.fetch
  let posts = 0
  let payment: MidtransStatusResponse
  let failStatus = false
  let rejectStatus = false
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      if (String(input).endsWith("/status")) {
        if (failStatus) throw new Error("Status unavailable.")
        return Response.json(payment)
      }
      posts++
      failStatus = rejectStatus
      return Response.json(
        { status_code: "401", status_message: "Access denied" },
        { status: 401 }
      )
    }
  )
  for (const unavailable of [false, true]) {
    const { orderId, returnId } = await readyReturn(true)
    payment = status(orderId)
    rejectStatus = unavailable
    failStatus = false
    if (unavailable) {
      await assert.rejects(startReturnRefund({ returnId, actorId: adminId }))
    } else {
      await startReturnRefund({ returnId, actorId: adminId })
    }
    const refund = await refundFor(returnId)
    assert.equal(refund.status, "blocked")
    assert.equal(refund.blockedReason, null)
    failStatus = false
    const previousPosts = posts
    await startReturnRefund({ returnId, actorId: adminId })
    await startReturnRefund({ returnId, actorId: adminId })
    assert.equal(posts, previousPosts)
    assert.equal((await refundFor(returnId)).status, "blocked")
    assert.equal((await refundFor(returnId)).refundKey, refund.refundKey)
    // Blocking POSTs must not prevent authoritative reconciliation.
    await reconcileReturnRefunds(
      status(orderId, {
        transaction_status: "partial_refund",
        refund_amount: "200000.00",
        refunds: [
          {
            refund_chargeback_id: "verified-after-block",
            refund_key: refund.refundKey,
            refund_amount: "200000.00",
            bank_confirmed_at: "2026-09-07 12:00:00",
          },
        ],
      })
    )
    assert.equal((await refundFor(returnId)).status, "confirmed")
  }
  assert.equal(posts, 2)
})

test("webhook acknowledges committed refunds despite private revalidation errors", async (t) => {
  const { orderId, returnId } = await readyReturn(true)
  const originalFetch = globalThis.fetch
  let payment = status(orderId)
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes("midtrans.com"))
        return originalFetch(input, init)
      return Response.json(payment)
    }
  )
  await startReturnRefund({ returnId, actorId: adminId })
  const refund = await refundFor(returnId)
  payment = status(orderId, {
    transaction_status: "partial_refund",
    refund_amount: "200000.00",
    refunds: [
      {
        refund_chargeback_id: "webhook-confirmed",
        refund_key: refund.refundKey,
        refund_amount: "200000.00",
        bank_confirmed_at: "2026-09-07 12:00:00",
      },
    ],
  })
  const errors = t.mock.method(console, "error", () => {})
  const response = await notifyMidtrans(
    new Request("http://localhost/api/payments/midtrans/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payment,
        signature_key: midtransSignature({
          orderId,
          statusCode: payment.status_code,
          grossAmount: payment.gross_amount,
          serverKey: midtransServerConfig().serverKey,
        }),
      }),
    })
  )
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { received: true })
  assert.equal((await refundFor(returnId)).status, "confirmed")
  // Real Next revalidation has no request store in this test and throws.
  const failedPaths = errors.mock.calls.flatMap(({ arguments: args }) => {
    const detail: unknown = args[1]
    return detail &&
      typeof detail === "object" &&
      "event" in detail &&
      detail.event === "returns.private_invalidation_failed" &&
      "path" in detail
      ? [detail.path]
      : []
  })
  assert.deepEqual(failedPaths, ["/orders", "/admin/orders", "/admin/finance"])
})
