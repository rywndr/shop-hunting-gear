"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { XIcon } from "@phosphor-icons/react"

import {
  NOTIFICATION_QUEUE_TTL_MS,
  advanceNotificationQueue,
  enqueueNotification,
  type Notification,
  type NotificationInput,
  type NotificationVariant,
} from "@/components/notification/notification-queue"
import { Button } from "@/components/ui/button"

type NotificationContextValue = {
  readonly showNotification: (notification: NotificationInput) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)
const AUTO_DISMISS_MS = 4_000
const ERROR_AUTO_DISMISS_MS = 7_000

function NotificationProvider({ children }: { children: ReactNode }) {
  const nextId = useRef(0)
  const [notifications, setNotifications] = useState<readonly Notification[]>(
    []
  )
  const notification = notifications[0]

  const showNotification = useCallback((input: NotificationInput) => {
    const now = Date.now()
    nextId.current += 1
    const notification = {
      ...input,
      id: nextId.current,
      expiresAt: now + NOTIFICATION_QUEUE_TTL_MS,
    }
    setNotifications((current) =>
      enqueueNotification(current, notification, now)
    )
  }, [])

  const dismiss = useCallback(() => {
    setNotifications((current) => advanceNotificationQueue(current, Date.now()))
  }, [])

  useEffect(() => {
    if (!notification) return

    const id = notification.id
    const dismissMs =
      notification.variant === "error" ? ERROR_AUTO_DISMISS_MS : AUTO_DISMISS_MS
    const timeoutId = window.setTimeout(() => {
      setNotifications((current) =>
        current[0]?.id === id
          ? advanceNotificationQueue(current, Date.now())
          : current
      )
    }, dismissMs)

    return () => window.clearTimeout(timeoutId)
  }, [notification])

  const value = useMemo<NotificationContextValue>(
    () => ({ showNotification }),
    [showNotification]
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {notification && notification.variant !== "error" && (
          <span key={notification.id}>{notification.message}</span>
        )}
      </span>
      <span
        className="sr-only"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        {notification?.variant === "error" && (
          <span key={notification.id}>{notification.message}</span>
        )}
      </span>
      {notification && (
        <NotificationMessage
          key={notification.id}
          message={notification.message}
          variant={notification.variant}
          onDismiss={dismiss}
        />
      )}
    </NotificationContext.Provider>
  )
}

function NotificationMessage({
  message,
  variant,
  onDismiss,
}: {
  message: string
  variant: NotificationVariant
  onDismiss: () => void
}) {
  const isError = variant === "error"

  return (
    <div
      className={`fixed top-[calc(env(safe-area-inset-top)+4.75rem)] left-1/2 z-[110] flex w-fit max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 rounded-2xl p-1.5 shadow-lg ${
        isError
          ? "bg-destructive text-destructive-foreground"
          : "bg-foreground text-background"
      }`}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Tutup notifikasi"
        className={
          isError
            ? "shrink-0 text-destructive-foreground hover:bg-destructive-foreground/10 hover:text-destructive-foreground"
            : "shrink-0 text-background hover:bg-background/10 hover:text-background"
        }
        onClick={onDismiss}
      >
        <XIcon className="size-4" aria-hidden />
      </Button>
      <span className="min-w-0 flex-1 pr-1 text-sm font-medium break-words">
        {message}
      </span>
    </div>
  )
}

function useNotification() {
  const notification = useContext(NotificationContext)

  if (!notification) {
    throw new Error("useNotification must be used within NotificationProvider.")
  }

  return notification
}

export { NotificationProvider, useNotification }
