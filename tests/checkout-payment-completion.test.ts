import assert from "node:assert/strict"
import test from "node:test"

import {
  ORDER_CREATED_CLEANUP_ERROR_MESSAGE,
  completePaymentNavigation,
  normalizeOrderCreated,
  type OrderCreatedResult,
} from "../lib/checkout/order-created"

test("rejected order cleanup becomes a typed error result", async () => {
  const result = await normalizeOrderCreated(async () => {
    throw new Error("cleanup failed")
  })

  assert.deepEqual(result, {
    kind: "error",
    message: ORDER_CREATED_CLEANUP_ERROR_MESSAGE,
  })
})

test("payment navigation does not wait for cleanup completion", async () => {
  let resolveCleanup: (result: OrderCreatedResult) => void = () => {}
  const cleanupResult = new Promise<OrderCreatedResult>((resolve) => {
    resolveCleanup = resolve
  })
  const events: string[] = []

  completePaymentNavigation({
    cleanupResult,
    onCleanupError: (message) => events.push(`cleanup: ${message}`),
    navigate: () => events.push("navigate"),
    refresh: () => events.push("refresh"),
  })

  assert.deepEqual(events, ["navigate", "refresh"])

  resolveCleanup({ kind: "error", message: "cleanup failed" })
  await cleanupResult
  await Promise.resolve()

  assert.deepEqual(events, ["navigate", "refresh", "cleanup: cleanup failed"])
})
