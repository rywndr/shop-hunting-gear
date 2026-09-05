const AUTH_NOTIFICATION_STORAGE_KEY = "hunting-gear:auth-notification"
const AUTH_NOTIFICATION_TTL_MS = 10 * 60 * 1_000

const AUTH_NOTIFICATION_MESSAGES = {
  "sign-in": "Berhasil masuk ke akun.",
} as const

type AuthNotificationKind = keyof typeof AUTH_NOTIFICATION_MESSAGES

type PendingAuthNotification = {
  readonly kind: AuthNotificationKind
  readonly expiresAt: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function queueAuthNotification(kind: AuthNotificationKind) {
  try {
    const notification = {
      kind,
      expiresAt: Date.now() + AUTH_NOTIFICATION_TTL_MS,
    } satisfies PendingAuthNotification

    window.sessionStorage.setItem(
      AUTH_NOTIFICATION_STORAGE_KEY,
      JSON.stringify(notification)
    )
  } catch {
    // Authentication should still succeed when session storage is unavailable.
  }
}

function clearAuthNotification() {
  try {
    window.sessionStorage.removeItem(AUTH_NOTIFICATION_STORAGE_KEY)
  } catch {
    // Nothing to clear when session storage is unavailable.
  }
}

function readAuthNotification(): PendingAuthNotification | null {
  let stored: string | null

  try {
    stored = window.sessionStorage.getItem(AUTH_NOTIFICATION_STORAGE_KEY)
  } catch {
    return null
  }

  if (!stored) {
    return null
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(stored)
  } catch {
    clearAuthNotification()
    return null
  }

  if (
    !isRecord(parsed) ||
    parsed.kind !== "sign-in" ||
    typeof parsed.expiresAt !== "number" ||
    !Number.isFinite(parsed.expiresAt) ||
    parsed.expiresAt <= Date.now()
  ) {
    clearAuthNotification()
    return null
  }

  return { kind: parsed.kind, expiresAt: parsed.expiresAt }
}

function authNotificationMessage(kind: AuthNotificationKind) {
  return AUTH_NOTIFICATION_MESSAGES[kind]
}

export {
  authNotificationMessage,
  clearAuthNotification,
  queueAuthNotification,
  readAuthNotification,
}
