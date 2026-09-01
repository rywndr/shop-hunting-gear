import "server-only"

import { serverEnv } from "@/lib/env/server"

export const MIDTRANS_SNAP_SESSION_EXPIRY = {
  duration: 24,
  unit: "hours",
} as const

const MILLISECONDS_PER_EXPIRY_UNIT = {
  minute: 60 * 1000,
  minutes: 60 * 1000,
  hour: 60 * 60 * 1000,
  hours: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
} as const

export function snapSessionExpiresAt(createdAt: Date) {
  return new Date(
    createdAt.getTime() +
      MIDTRANS_SNAP_SESSION_EXPIRY.duration *
        MILLISECONDS_PER_EXPIRY_UNIT[MIDTRANS_SNAP_SESSION_EXPIRY.unit]
  )
}

const MIDTRANS_URLS = {
  sandbox: {
    snapApi: "https://app.sandbox.midtrans.com/snap/v1/transactions",
    snapScript: "https://app.sandbox.midtrans.com/snap/snap.js",
    statusApi: "https://api.sandbox.midtrans.com/v2",
  },
  production: {
    snapApi: "https://app.midtrans.com/snap/v1/transactions",
    snapScript: "https://app.midtrans.com/snap/snap.js",
    statusApi: "https://api.midtrans.com/v2",
  },
} as const

export type MidtransBrowserConfig =
  | { readonly kind: "unconfigured" }
  | {
      readonly kind: "configured"
      readonly clientKey: string
      readonly snapScriptUrl: string
    }

export function midtransBrowserConfig(): MidtransBrowserConfig {
  const config = serverEnv.midtrans

  return config
    ? {
        kind: "configured",
        clientKey: config.clientKey,
        snapScriptUrl: MIDTRANS_URLS[config.environment].snapScript,
      }
    : { kind: "unconfigured" }
}

export function midtransServerConfig() {
  const config = serverEnv.midtrans

  if (!config) {
    throw new Error("No Midtrans configuration.")
  }

  return {
    serverKey: config.serverKey,
    snapApiUrl: MIDTRANS_URLS[config.environment].snapApi,
    statusApiUrl: MIDTRANS_URLS[config.environment].statusApi,
  }
}
