import assert from "node:assert/strict"
import test from "node:test"

import {
  authNotificationMessage,
  clearAuthNotification,
  queueAuthNotification,
  readAuthNotification,
} from "../lib/auth/notification"

const STORAGE_KEY = "hunting-gear:auth-notification"

class MemoryStorage {
  readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

function installWindow(value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value,
  })

  return () => {
    if (previous) {
      Object.defineProperty(globalThis, "window", previous)
      return
    }

    Reflect.deleteProperty(globalThis, "window")
  }
}

test("valid OAuth notification remains queued until explicitly consumed", () => {
  const storage = new MemoryStorage()
  const restoreWindow = installWindow({ sessionStorage: storage })

  try {
    queueAuthNotification("sign-in")
    const stored = storage.getItem(STORAGE_KEY)

    assert.ok(stored)
    const pending = readAuthNotification()

    assert.equal(pending?.kind, "sign-in")
    assert.ok((pending?.expiresAt ?? 0) > Date.now())
    assert.equal(storage.getItem(STORAGE_KEY), stored)

    clearAuthNotification()
    assert.equal(storage.getItem(STORAGE_KEY), null)
  } finally {
    restoreWindow()
  }
})

test("OAuth registration uses account creation copy", () => {
  const storage = new MemoryStorage()
  const restoreWindow = installWindow({ sessionStorage: storage })

  try {
    queueAuthNotification("sign-up")

    assert.equal(readAuthNotification()?.kind, "sign-up")
    assert.equal(authNotificationMessage("sign-up"), "Akun berhasil dibuat.")
    assert.notEqual(
      authNotificationMessage("sign-up"),
      authNotificationMessage("sign-in")
    )
  } finally {
    restoreWindow()
  }
})

test("stale and invalid OAuth notifications are discarded", () => {
  const storage = new MemoryStorage()
  const restoreWindow = installWindow({ sessionStorage: storage })

  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ kind: "sign-in", expiresAt: Date.now() - 1 })
    )
    assert.equal(readAuthNotification(), null)
    assert.equal(storage.getItem(STORAGE_KEY), null)

    storage.setItem(STORAGE_KEY, "not-json")
    assert.equal(readAuthNotification(), null)
    assert.equal(storage.getItem(STORAGE_KEY), null)

    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ kind: "unknown", expiresAt: Date.now() + 60_000 })
    )
    assert.equal(readAuthNotification(), null)
    assert.equal(storage.getItem(STORAGE_KEY), null)
  } finally {
    restoreWindow()
  }
})

test("OAuth notification storage failures do not break authentication flows", () => {
  const restoreWindow = installWindow({
    get sessionStorage(): never {
      throw new Error("storage unavailable")
    },
  })

  try {
    assert.doesNotThrow(() => queueAuthNotification("sign-in"))
    assert.equal(readAuthNotification(), null)
    assert.doesNotThrow(() => clearAuthNotification())
  } finally {
    restoreWindow()
  }
})
