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

test("confirmed payment navigates while cart cleanup is still unresolved", async () => {
  const events: string[] = []
  let resolveConfirmation: (result: "paid") => void = () => {}
  const confirmation = new Promise<"paid">((resolve) => {
    resolveConfirmation = resolve
  })
  let resolveCleanup: (result: OrderCreatedResult) => void = () => {}
  const cleanupResult = normalizeOrderCreated(() => {
    events.push("cleanup started")
    return new Promise<OrderCreatedResult>((resolve) => {
      resolveCleanup = resolve
    })
  })
  let cleanupSettled = false
  void cleanupResult.then(() => {
    cleanupSettled = true
  })
  let state: "confirming" | "snap-completed" = "confirming"
  const completion = completePaymentNavigation({
    confirm: () => {
      events.push("confirmation started")
      return confirmation
    },
    isCurrent: () => state === "confirming",
    onConfirmed: (result) => {
      assert.equal(result, "paid")
      state = "snap-completed"
      events.push("confirmed")
    },
    cleanupResult,
    onCleanupError: (message) => events.push(message),
    navigate: () => {
      assert.equal(state, "snap-completed")
      assert.equal(cleanupSettled, false)
      events.push("navigate")
    },
    refresh: () => events.push("refresh"),
  })

  assert.deepEqual(events, ["cleanup started", "confirmation started"])
  resolveConfirmation("paid")
  // Race against an event-loop turn so waiting for cleanup fails rather than hangs.
  const completed = await Promise.race([
    completion.then(() => true),
    new Promise<false>((resolve) => setImmediate(() => resolve(false))),
  ])
  assert.equal(completed, true)
  assert.equal(cleanupSettled, false)
  assert.deepEqual(events, [
    "cleanup started",
    "confirmation started",
    "confirmed",
    "navigate",
    "refresh",
  ])
  resolveCleanup({ kind: "error", message: "cleanup failed" })
  await cleanupResult
  assert.equal(events.filter((event) => event === "cleanup failed").length, 1)
})

test("stale payment confirmation cannot complete or navigate", async () => {
  let activeAttemptId = 1
  const attemptId = activeAttemptId
  const events: string[] = []
  await completePaymentNavigation({
    confirm: async () => {
      activeAttemptId = 2
    },
    isCurrent: () => activeAttemptId === attemptId,
    onConfirmed: () => events.push("confirmed"),
    cleanupResult: Promise.resolve({ kind: "error", message: "cleanup failed" }),
    onCleanupError: (message) => events.push(message),
    navigate: () => events.push("navigate"),
    refresh: () => events.push("refresh"),
  })
  assert.deepEqual(events, [])
})

test("payment navigation does not wait for cleanup completion", async () => {
  let resolveCleanup: (result: OrderCreatedResult) => void = () => {}
  const cleanupResult = new Promise<OrderCreatedResult>((resolve) => {
    resolveCleanup = resolve
  })
  const events: string[] = []

  await completePaymentNavigation({
    confirm: async () => {},
    isCurrent: () => true,
    onConfirmed: () => {},
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
