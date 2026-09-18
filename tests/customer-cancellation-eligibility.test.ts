import assert from "node:assert/strict"
import test from "node:test"

import {
  canCustomerCancelOrder,
  customerOrderActionVisibility,
} from "../lib/orders/cancellation"
import type { Order } from "../lib/orders/config"

function eligible(
  input: Pick<
    Order,
    "status" | "paymentStatus" | "fulfillmentStatus" | "tracking"
  >
) {
  return canCustomerCancelOrder(input)
}

test("customer cancellation eligibility covers unpaid and paid unshipped orders", () => {
  assert.equal(
    eligible({
      status: "unpaid",
      paymentStatus: "pending",
      fulfillmentStatus: "awaiting_payment",
      tracking: null,
    }),
    true
  )
  assert.equal(
    eligible({
      status: "processing",
      paymentStatus: "paid",
      fulfillmentStatus: "processing",
      tracking: null,
    }),
    true
  )
})

test("customer cancellation eligibility rejects terminal, tracked, and reversed orders", () => {
  for (const candidate of [
    {
      status: "processing",
      paymentStatus: "paid",
      fulfillmentStatus: "processing",
      tracking: "JP123",
    },
    {
      status: "shipped",
      paymentStatus: "paid",
      fulfillmentStatus: "shipped",
      tracking: "JP123",
    },
    {
      status: "completed",
      paymentStatus: "paid",
      fulfillmentStatus: "completed",
      tracking: "JP123",
    },
    {
      status: "cancelled",
      paymentStatus: "cancelled",
      fulfillmentStatus: "cancelled",
      tracking: null,
    },
    {
      status: "cancelled",
      paymentStatus: "refunded",
      fulfillmentStatus: "cancelled",
      tracking: null,
    },
    {
      status: "processing",
      paymentStatus: "partial_refund",
      fulfillmentStatus: "processing",
      tracking: null,
    },
  ] satisfies ReadonlyArray<
    Pick<Order, "status" | "paymentStatus" | "fulfillmentStatus" | "tracking">
  >) {
    assert.equal(eligible(candidate), false)
  }
})

test("an active unpaid cancellation hides cancellation and payment actions", () => {
  assert.deepEqual(
    customerOrderActionVisibility({
      order: {
        status: "unpaid",
        paymentStatus: "pending",
        fulfillmentStatus: "awaiting_payment",
        tracking: null,
        paymentToken: "snap-token",
      },
      hasCancellation: true,
    }),
    {
      showCancellation: false,
      showPayment: false,
      showPrimaryAction: false,
      showCancellationStatus: true,
    }
  )
})
