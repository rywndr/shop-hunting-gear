"use client"

import { useEffect } from "react"

import { useNotification } from "@/components/notification/notification-provider"
import { authClient } from "@/lib/auth/client"
import {
  authNotificationMessage,
  clearAuthNotification,
  readAuthNotification,
} from "@/lib/auth/notification"

function AuthNotificationBridge() {
  const { showNotification } = useNotification()
  const { data: session, isPending } = authClient.useSession()
  const userId = session?.user.id

  useEffect(() => {
    if (isPending) return

    const pendingNotification = readAuthNotification()
    if (!pendingNotification) return

    if (!userId) {
      const timeoutId = window.setTimeout(
        clearAuthNotification,
        Math.max(0, pendingNotification.expiresAt - Date.now())
      )

      return () => window.clearTimeout(timeoutId)
    }

    clearAuthNotification()
    showNotification({
      variant: "success",
      message: authNotificationMessage(pendingNotification.kind),
    })
  }, [isPending, showNotification, userId])

  return null
}

export { AuthNotificationBridge }
