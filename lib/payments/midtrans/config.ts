import "server-only"

import { serverEnv } from "@/lib/env/server"

const MIDTRANS_URLS = {
  sandbox: {
    snapApi: "https://app.sandbox.midtrans.com/snap/v1/transactions",
    snapScript: "https://app.sandbox.midtrans.com/snap/snap.js",
  },
  production: {
    snapApi: "https://app.midtrans.com/snap/v1/transactions",
    snapScript: "https://app.midtrans.com/snap/snap.js",
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
  }
}
