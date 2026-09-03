import assert from "node:assert/strict"
import test from "node:test"

import {
  canPrintShippingLabel,
  canShipOrder,
  canTrackOrder,
  shippingLabelHref,
} from "../lib/admin/orders"
import { normalizeTracking, trackingSchema } from "../lib/admin/shipment"

const NORMAL_SHIPPING = {
  courier: "jne",
  service: "REG",
} as const

const PAID_TO_SHIP = {
  paymentStatus: "paid",
  fulfillmentStatus: "processing",
  tracking: null,
  shipping: NORMAL_SHIPPING,
} as const

test("shipment eligibility allows only paid shipment payments", () => {
  assert.equal(canShipOrder(PAID_TO_SHIP), true)
  assert.equal(
    canShipOrder({ ...PAID_TO_SHIP, paymentStatus: "partial_refund" }),
    true
  )
  assert.equal(
    canShipOrder({
      ...PAID_TO_SHIP,
      shipping: { courier: "manual", service: "Manual" },
    }),
    true
  )
})

test("shipment eligibility rejects blocked payment statuses", () => {
  for (const paymentStatus of [
    "pending",
    "authorized",
    "failed",
    "denied",
    "cancelled",
    "expired",
    "refunded",
    "partial_chargeback",
    "chargeback",
  ] as const) {
    assert.equal(canShipOrder({ ...PAID_TO_SHIP, paymentStatus }), false)
  }
})

test("a pickup order cannot be shipped", () => {
  assert.equal(
    canShipOrder({
      ...PAID_TO_SHIP,
      shipping: { courier: "manual", service: "Pickup" },
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

test("tracking is shown only for shipped supported-courier orders", () => {
  assert.equal(
    canTrackOrder({
      fulfillmentStatus: "shipped",
      tracking: "JP1234567890",
      shipping: NORMAL_SHIPPING,
    }),
    true
  )
  assert.equal(
    canTrackOrder({
      fulfillmentStatus: "completed",
      tracking: "JP1234567890",
      shipping: NORMAL_SHIPPING,
    }),
    true
  )
  assert.equal(
    canTrackOrder({
      fulfillmentStatus: "processing",
      tracking: "JP1234567890",
      shipping: NORMAL_SHIPPING,
    }),
    false
  )
  assert.equal(
    canTrackOrder({
      fulfillmentStatus: "shipped",
      tracking: "JP1234567890",
      shipping: { courier: "sicepat", service: "REG" },
    }),
    false
  )
  assert.equal(
    canTrackOrder({
      fulfillmentStatus: "shipped",
      tracking: "JP1234567890",
      shipping: { courier: "manual", service: "Pickup" },
    }),
    false
  )
  assert.equal(
    canTrackOrder({
      fulfillmentStatus: "shipped",
      tracking: "bad",
      shipping: NORMAL_SHIPPING,
    }),
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
