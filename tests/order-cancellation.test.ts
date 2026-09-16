import assert from "node:assert/strict"
import test from "node:test"

import {
  canCancelOrder,
  isActiveCancellationStatus,
} from "../lib/orders/cancellation"

test("awaiting-payment and unshipped processing orders are cancellable", () => {
  assert.equal(
    canCancelOrder({ fulfillmentStatus: "awaiting_payment", tracking: null }),
    true
  )
  assert.equal(
    canCancelOrder({ fulfillmentStatus: "processing", tracking: null }),
    true
  )
})

test("shipment and terminal fulfillment states reject cancellation", () => {
  assert.equal(
    canCancelOrder({
      fulfillmentStatus: "processing",
      tracking: "JP1234567890",
    }),
    false
  )

  for (const fulfillmentStatus of [
    "shipped",
    "completed",
    "cancelled",
  ] as const) {
    assert.equal(canCancelOrder({ fulfillmentStatus, tracking: null }), false)
  }
})

test("retryable states block shipment and failed means abandoned", () => {
  for (const status of [
    "requested",
    "provider_operation_pending",
    "refund_pending",
    "manual_refund_required",
  ] as const) {
    assert.equal(isActiveCancellationStatus(status), true)
  }

  assert.equal(isActiveCancellationStatus("completed"), false)
  // Callers may use `failed` only after an explicit terminal decision. Provider
  // timeouts and ambiguous responses remain in one of the active states above.
  assert.equal(isActiveCancellationStatus("failed"), false)
})
