type NotificationVariant = "success" | "error" | "info"

type NotificationInput = {
  readonly variant: NotificationVariant
  readonly message: string
}

type Notification = NotificationInput & {
  readonly id: number
  readonly expiresAt: number
}

const MAX_NOTIFICATIONS = 5
const NOTIFICATION_QUEUE_TTL_MS = 30_000

function sameNotification(left: Notification, right: Notification) {
  return left.variant === right.variant && left.message === right.message
}

function pruneStaleQueuedNotifications(
  notifications: readonly Notification[],
  now: number
): readonly Notification[] {
  const current = notifications[0]
  if (!current) return notifications

  return [
    current,
    ...notifications
      .slice(1)
      .filter((notification) => notification.expiresAt > now),
  ]
}

function enqueueNotification(
  notifications: readonly Notification[],
  notification: Notification,
  now: number
): readonly Notification[] {
  const freshNotifications = pruneStaleQueuedNotifications(notifications, now)

  if (
    freshNotifications.some((queued) => sameNotification(queued, notification))
  ) {
    return freshNotifications
  }

  if (notification.variant !== "error") {
    return freshNotifications.length < MAX_NOTIFICATIONS
      ? [...freshNotifications, notification]
      : freshNotifications
  }

  const firstNonErrorIndex = freshNotifications.findIndex(
    (queued) => queued.variant !== "error"
  )
  const insertionIndex =
    firstNonErrorIndex === -1 ? freshNotifications.length : firstNonErrorIndex
  const next = [
    ...freshNotifications.slice(0, insertionIndex),
    notification,
    ...freshNotifications.slice(insertionIndex),
  ]

  if (next.length <= MAX_NOTIFICATIONS) {
    return next
  }

  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index]?.variant !== "error") {
      return [...next.slice(0, index), ...next.slice(index + 1)]
    }
  }

  return next.slice(0, MAX_NOTIFICATIONS)
}

function advanceNotificationQueue(
  notifications: readonly Notification[],
  now: number
): readonly Notification[] {
  return notifications
    .slice(1)
    .filter((notification) => notification.expiresAt > now)
}

export {
  MAX_NOTIFICATIONS,
  NOTIFICATION_QUEUE_TTL_MS,
  advanceNotificationQueue,
  enqueueNotification,
}
export type { Notification, NotificationInput, NotificationVariant }
