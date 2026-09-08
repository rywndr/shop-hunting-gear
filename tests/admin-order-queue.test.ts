import "dotenv/config"

import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test, { after, before } from "node:test"

import { inArray, sql } from "drizzle-orm"

import type {
  AdminReturnRequest,
  RefundStatus,
  ReturnStatus,
} from "../lib/returns/config"
import { hasActionableReturnSql } from "../lib/returns/queue-sql"
import { db } from "../lib/db/client"
import { user } from "../lib/db/schema/auth"
import { customerOrder, customerOrderItem } from "../lib/db/schema/order"
import { returnRefund, returnRequest } from "../lib/db/schema/return"
import { salesOrderQueue, type SalesOrder } from "../lib/admin/orders"

const suffix = randomUUID().slice(0, 8)
const buyerId = `queue-buyer-${suffix}`
const adminId = `queue-admin-${suffix}`

const SQL_CASES = [
  { name: "requested", status: "requested", refundStatus: null },
  { name: "approved", status: "approved", refundStatus: null },
  { name: "inspected", status: "inspected", refundStatus: null },
  { name: "ready", status: "inspected", refundStatus: "ready" },
  { name: "pending", status: "inspected", refundStatus: "pending" },
  { name: "blocked", status: "inspected", refundStatus: "blocked" },
  { name: "rejected", status: "rejected", refundStatus: null },
  { name: "confirmed", status: "inspected", refundStatus: "confirmed" },
] as const satisfies readonly {
  readonly name: string
  readonly status: ReturnStatus
  readonly refundStatus: RefundStatus | null
}[]

const orderIds = SQL_CASES.map(({ name }) => `queue-order-${suffix}-${name}`)
const returnIds = SQL_CASES.map(({ name }) => `queue-return-${suffix}-${name}`)

const baseSalesOrder = {
  buyer: "Pembeli uji",
  order: {
    id: "queue-ts-order",
    status: "completed",
    paymentStatus: "paid",
    fulfillmentStatus: "completed",
    sourceKind: "manual",
    customerNote: null,
    placedAt: "2026-01-01T00:00:00.000Z",
    courier: "Manual",
    shippingCourier: "manual",
    shipping: 0,
    tracking: null,
    paymentToken: null,
    items: [
      {
        id: "queue-ts-item",
        productSlug: "queue-fixture",
        name: "Produk uji",
        variant: "",
        quantity: 1,
        price: 100,
        reviewed: false,
      },
    ],
  },
  shipping: { courier: "manual", service: "Pickup" },
} satisfies SalesOrder

function adminReturnRequest(
  status: ReturnStatus,
  refundStatus: RefundStatus | null
): AdminReturnRequest {
  const refund: AdminReturnRequest["refund"] =
    refundStatus === null
      ? null
      : {
          method: "offline",
          status: refundStatus,
          amount: 100,
          reference:
            refundStatus === "confirmed" ? "confirmed-reference" : null,
          lastError: null,
        }

  return {
    id: "queue-ts-return",
    orderId: baseSalesOrder.order.id,
    status,
    reason: "damaged",
    details: "Produk uji rusak.",
    note: null,
    photos: [],
    items: [],
    refund,
  }
}

before(async () => {
  await db.insert(user).values([
    {
      id: buyerId,
      name: "Pembeli queue",
      email: `${buyerId}@example.test`,
      role: "user",
    },
    {
      id: adminId,
      name: "Admin queue",
      email: `${adminId}@example.test`,
      role: "admin",
    },
  ])

  for (const [index, fixture] of SQL_CASES.entries()) {
    const orderId = orderIds[index]
    const returnId = returnIds[index]
    const inspected = fixture.status === "inspected"

    await db.insert(customerOrder).values({
      id: orderId,
      userId: buyerId,
      fulfillmentStatus: "completed",
      paymentStatus: "paid",
      sourceKind: "manual",
      shippingCourier: "manual",
      shippingCourierName: "Manual",
      shippingService: "Pickup",
      shippingCost: 0,
      grossAmount: 100,
      addressSnapshot: {
        recipient: "Pembeli",
        phone: "08123456789",
        street: "Jalan Uji",
        province: "Jawa Barat",
        city: "Bandung",
        district: "Coblong",
        subdistrict: "Dago",
        postalCode: "40135",
      },
      paidAt: new Date(),
      completedAt: new Date(),
    })
    await db.insert(customerOrderItem).values({
      id: `queue-item-${suffix}-${fixture.name}`,
      orderId,
      productSlug: "queue-fixture",
      name: "Produk uji",
      variants: [],
      quantity: 1,
      price: 100,
    })
    await db.insert(returnRequest).values({
      id: returnId,
      orderId,
      reason: "damaged",
      details: "Produk uji rusak.",
      status: fixture.status,
      inspectedAt: inspected ? new Date() : null,
      inspectedBy: inspected ? adminId : null,
    })

    if (fixture.refundStatus !== null) {
      await db.insert(returnRefund).values({
        id: `queue-refund-${suffix}-${fixture.name}`,
        returnId,
        method: "offline",
        status: fixture.refundStatus,
        amount: 100,
        refundKey: `queue-refund-key-${suffix}-${fixture.name}`,
        actorId: adminId,
        confirmedAt: fixture.refundStatus === "confirmed" ? new Date() : null,
        reference:
          fixture.refundStatus === "confirmed" ? "confirmed-reference" : null,
      })
    }
  }
})

after(async () => {
  await db.delete(returnRefund).where(inArray(returnRefund.returnId, returnIds))
  await db.delete(returnRequest).where(inArray(returnRequest.id, returnIds))
  await db.delete(customerOrder).where(inArray(customerOrder.id, orderIds))
  await db.delete(user).where(inArray(user.id, [buyerId, adminId]))
})

test("TypeScript queue classification keeps terminal return history on the order", () => {
  const cases = [
    ["requested", "requested", null, "returns"],
    ["approved", "approved", null, "returns"],
    ["inspected without refund", "inspected", null, "returns"],
    ["pending refund", "inspected", "pending", "returns"],
    ["blocked refund", "inspected", "blocked", "returns"],
    ["rejected", "rejected", null, "completed"],
    ["confirmed refund", "inspected", "confirmed", "completed"],
  ] as const satisfies readonly [
    string,
    ReturnStatus,
    RefundStatus | null,
    "returns" | "completed",
  ][]

  for (const [label, status, refundStatus, expected] of cases) {
    assert.equal(
      salesOrderQueue({
        ...baseSalesOrder,
        returnRequest: adminReturnRequest(status, refundStatus),
      }),
      expected,
      label
    )
  }
})

test("SQL queue and counts only include actionable returns", async () => {
  const ids = sql.join(
    orderIds.map((orderId) => sql`${orderId}`),
    sql`, `
  )
  const actionable = hasActionableReturnSql(sql`orders.id`)
  const queue = sql<string>`CASE
    WHEN ${actionable} THEN 'returns'
    WHEN orders.fulfillment_status = 'awaiting_payment'
      AND orders.payment_status IN ('pending', 'authorized') THEN 'unpaid'
    WHEN orders.fulfillment_status = 'processing' THEN 'toShip'
    WHEN orders.fulfillment_status = 'shipped' THEN 'shipped'
    WHEN orders.fulfillment_status = 'completed' THEN 'completed'
    ELSE 'cancelled'
  END`

  const rows = await db.execute<{ id: string; queue: string }>(sql`
    SELECT orders.id, ${queue} AS queue
    FROM customer_order orders
    WHERE orders.id IN (${ids})
    ORDER BY orders.id
  `)

  const queues = new Map(rows.rows.map((row) => [row.id, row.queue]))
  for (const [index, fixture] of SQL_CASES.entries()) {
    assert.equal(
      queues.get(orderIds[index]),
      fixture.refundStatus === "confirmed" || fixture.status === "rejected"
        ? "completed"
        : "returns",
      fixture.name
    )
  }

  const orderQueueRows = db
    .select({
      fulfillmentStatus: customerOrder.fulfillmentStatus,
      paymentStatus: customerOrder.paymentStatus,
      hasActionableReturn: hasActionableReturnSql().as(
        "has_actionable_return"
      ),
    })
    .from(customerOrder)
    .where(inArray(customerOrder.id, orderIds))
    .as("order_queue")
  const countRows = await db
    .select({
      hasActionableReturn: orderQueueRows.hasActionableReturn,
      total: sql<number>`count(*)`,
    })
    .from(orderQueueRows)
    .groupBy(orderQueueRows.hasActionableReturn)

  assert.deepEqual(
    Object.fromEntries(
      countRows.map(({ hasActionableReturn, total }) => [
        hasActionableReturn ? "returns" : "completed",
        Number(total),
      ])
    ),
    { completed: 2, returns: 6 }
  )
})
