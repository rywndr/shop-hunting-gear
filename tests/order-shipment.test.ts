import assert from "node:assert/strict"
import test from "node:test"

import {
  canPrintShippingLabel,
  canShipOrder,
  shippingLabelHref,
} from "../lib/admin/orders"
import { normalizeTracking, trackingSchema } from "../lib/admin/shipment"

const PAID_TO_SHIP = {
  paymentStatus: "paid",
  fulfillmentStatus: "processing",
  tracking: null,
} as const

test("a paid order that is still processing may be shipped", () => {
  assert.equal(canShipOrder(PAID_TO_SHIP), true)
  assert.equal(
    canShipOrder({ ...PAID_TO_SHIP, paymentStatus: "partial_refund" }),
    true
  )
})

test("an unpaid order may never be shipped", () => {
  for (const paymentStatus of ["pending", "authorized", "expired"] as const) {
    assert.equal(canShipOrder({ ...PAID_TO_SHIP, paymentStatus }), false)
  }
  assert.equal(
    canShipOrder({
      paymentStatus: "pending",
      fulfillmentStatus: "awaiting_payment",
      tracking: null,
    }),
    false
  )
})

test("only an open fulfillment without a resi may be shipped", () => {
  for (const fulfillmentStatus of [
    "shipped",
    "completed",
    "cancelled",
  ] as const) {
    assert.equal(canShipOrder({ ...PAID_TO_SHIP, fulfillmentStatus }), false)
  }
  assert.equal(
    canShipOrder({ ...PAID_TO_SHIP, tracking: "JP1234567890" }),
    false
  )
})

test("a label needs a stored resi on a shipped or completed order", () => {
  assert.equal(
    canPrintShippingLabel({
      fulfillmentStatus: "shipped",
      tracking: "JP1234567890",
    }),
    true
  )
  assert.equal(
    canPrintShippingLabel({
      fulfillmentStatus: "completed",
      tracking: "JP1234567890",
    }),
    true
  )
  assert.equal(
    canPrintShippingLabel({ fulfillmentStatus: "shipped", tracking: null }),
    false
  )
  assert.equal(
    canPrintShippingLabel({
      fulfillmentStatus: "processing",
      tracking: "JP1234567890",
    }),
    false
  )
})

test("the label route is derived from the order id", () => {
  assert.equal(shippingLabelHref("HG-9d0b"), "/admin/pesanan/HG-9d0b/label")
  assert.equal(
    shippingLabelHref("INV/2026/HG/0212"),
    "/admin/pesanan/INV%2F2026%2FHG%2F0212/label"
  )
})

test("a resi keeps courier punctuation and loses surrounding whitespace", () => {
  for (const tracking of ["JP1234567890", "JNE-123456789", "001234567890"]) {
    const parsed = trackingSchema.safeParse(`  ${tracking} `)

    assert.equal(parsed.success, true)
    assert.equal(parsed.data, tracking)
  }
})

test("a blank or malformed resi is rejected", () => {
  for (const tracking of ["", "   ", "JP12", "JP123456789!", "<script>"]) {
    assert.equal(trackingSchema.safeParse(tracking).success, false)
  }
  assert.equal(trackingSchema.safeParse("J".repeat(41)).success, false)
})

test("internal whitespace collapses to a single space", () => {
  assert.equal(normalizeTracking(" JP 1234   567890 "), "JP 1234 567890")
})
