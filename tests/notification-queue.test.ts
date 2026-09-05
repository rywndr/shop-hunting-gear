import assert from "node:assert/strict"
import test from "node:test"

import {
  advanceNotificationQueue,
  enqueueNotification,
  type Notification,
} from "../components/notification/notification-queue"

const NOW = 1_000
const FUTURE = NOW + 10_000

function notification({
  id,
  variant,
  message,
  expiresAt = FUTURE,
}: {
  readonly id: number
  readonly variant: Notification["variant"]
  readonly message: string
  readonly expiresAt?: number
}): Notification {
  return { id, variant, message, expiresAt }
}

test("errors stay FIFO ahead of queued success and info notifications", () => {
  const success = notification({
    id: 1,
    variant: "success",
    message: "success",
  })
  const info = notification({ id: 2, variant: "info", message: "info" })
  const firstError = notification({
    id: 3,
    variant: "error",
    message: "error 1",
  })
  const secondError = notification({
    id: 4,
    variant: "error",
    message: "error 2",
  })

  const withFirstError = enqueueNotification([success, info], firstError, NOW)
  const withSecondError = enqueueNotification(withFirstError, secondError, NOW)

  assert.deepEqual(
    withSecondError.map(({ id }) => id),
    [3, 4, 1, 2]
  )
})

test("stale queued notifications expire before display", () => {
  const current = notification({ id: 1, variant: "error", message: "current" })
  const stale = notification({
    id: 2,
    variant: "success",
    message: "stale",
    expiresAt: NOW,
  })
  const fresh = notification({ id: 3, variant: "info", message: "fresh" })

  assert.deepEqual(
    advanceNotificationQueue([current, stale, fresh], NOW).map(({ id }) => id),
    [3]
  )
})

test("duplicate queued notifications are coalesced", () => {
  const current = notification({ id: 1, variant: "success", message: "saved" })
  const duplicate = notification({
    id: 2,
    variant: "success",
    message: "saved",
  })

  const next = enqueueNotification([current], duplicate, NOW)

  assert.deepEqual(
    next.map(({ id }) => id),
    [1]
  )
})
