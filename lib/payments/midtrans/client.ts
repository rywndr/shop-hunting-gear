import "server-only"

import { Buffer } from "node:buffer"
import { createHash } from "node:crypto"

import {
  MIDTRANS_SNAP_SESSION_EXPIRY,
  midtransServerConfig,
} from "@/lib/payments/midtrans/config"
import {
  midtransCancelResponseSchema,
  midtransStatusCodeSchema,
  midtransStatusResponseSchema,
  snapSessionCancellationErrorSchema,
  snapSessionCancellationResponseSchema,
  snapTransactionResponseSchema,
  type MidtransCancelResponse,
  type MidtransStatusResponse,
  type SnapTransaction,
} from "@/lib/payments/midtrans/schema"

type MidtransApiOperation =
  "create" | "status" | "cancel" | "snap-session-cancel"

export class MidtransApiError extends Error {
  readonly operation: MidtransApiOperation
  readonly status: number | null
  readonly providerStatusCode: string | null
  readonly retryable: boolean
  readonly notFound: boolean

  constructor({
    operation,
    status,
    providerStatusCode = null,
    retryable,
    notFound = false,
  }: {
    readonly operation: MidtransApiOperation
    readonly status: number | null
    readonly providerStatusCode?: string | null
    readonly retryable: boolean
    readonly notFound?: boolean
  }) {
    super(`Midtrans ${operation} request failed.`)
    this.name = "MidtransApiError"
    this.operation = operation
    this.status = status
    this.providerStatusCode = providerStatusCode
    this.retryable = retryable
    this.notFound = notFound
  }
}

type SnapItem = {
  readonly id: string
  readonly price: number
  readonly quantity: number
  readonly name: string
}

type SnapAddress = {
  readonly first_name: string
  readonly email: string
  readonly phone: string
  readonly address: string
  readonly city: string
  readonly postal_code: string
  readonly country_code: "IDN"
}

export type CreateSnapTransaction = {
  readonly orderId: string
  readonly idempotencyKey: string
  readonly grossAmount: number
  readonly items: readonly SnapItem[]
  readonly customer: {
    readonly name: string
    readonly email: string
    readonly phone: string
    readonly shippingAddress: SnapAddress
  }
}

function authorizationHeader(serverKey: string) {
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`
}

export function midtransIdempotencyKey(
  orderId: string,
  operation: "create" | "cancel"
) {
  return createHash("sha256")
    .update(`hunting-gear:${operation}:${orderId}`)
    .digest("hex")
    .slice(0, 46)
}

async function responsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function requestError(
  operation: MidtransApiError["operation"],
  error: unknown
): MidtransApiError {
  if (error instanceof MidtransApiError) {
    return error
  }

  return new MidtransApiError({
    operation,
    status: null,
    retryable: true,
  })
}

function httpError({
  operation,
  status,
  providerStatusCode,
  retryable,
}: {
  readonly operation: MidtransApiError["operation"]
  readonly status: number
  readonly providerStatusCode?: string | null
  readonly retryable?: boolean
}) {
  const effectiveStatus = providerStatusCode
    ? Number(providerStatusCode)
    : status

  return new MidtransApiError({
    operation,
    status,
    providerStatusCode,
    retryable:
      retryable ??
      (effectiveStatus === 408 ||
        effectiveStatus === 425 ||
        effectiveStatus === 429 ||
        effectiveStatus >= 500),
    notFound: status === 404 || providerStatusCode === "404",
  })
}

export async function createSnapTransaction({
  orderId,
  idempotencyKey,
  grossAmount,
  items,
  customer,
}: CreateSnapTransaction): Promise<SnapTransaction> {
  const config = midtransServerConfig()
  let response: Response

  try {
    response = await fetch(config.snapApiUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authorizationHeader(config.serverKey),
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: orderId,
          gross_amount: grossAmount,
        },
        item_details: items,
        credit_card: { secure: true },
        page_expiry: MIDTRANS_SNAP_SESSION_EXPIRY,
        customer_details: {
          first_name: customer.name,
          email: customer.email,
          phone: customer.phone,
          shipping_address: customer.shippingAddress,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    })
  } catch (error) {
    throw requestError("create", error)
  }

  const payload = await responsePayload(response)
  const parsed = snapTransactionResponseSchema.safeParse(payload)

  if (!response.ok) {
    throw httpError({ operation: "create", status: response.status })
  }

  if (!parsed.success) {
    throw httpError({
      operation: "create",
      status: response.status,
      retryable: true,
    })
  }

  return parsed.data
}

export async function getSnapTransactionStatus({
  orderId,
}: {
  readonly orderId: string
}): Promise<MidtransStatusResponse> {
  const config = midtransServerConfig()
  let response: Response

  try {
    response = await fetch(
      `${config.statusApiUrl}/${encodeURIComponent(orderId)}/status`,
      {
        headers: {
          Accept: "application/json",
          Authorization: authorizationHeader(config.serverKey),
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      }
    )
  } catch (error) {
    throw requestError("status", error)
  }

  const payload = await responsePayload(response)
  const statusCode = midtransStatusCodeSchema.safeParse(payload)
  const providerStatusCode = statusCode.success
    ? statusCode.data.status_code
    : null

  if (
    !response.ok ||
    (providerStatusCode !== "200" && providerStatusCode !== "201")
  ) {
    throw httpError({
      operation: "status",
      status: response.status,
      providerStatusCode,
      retryable: providerStatusCode === null ? true : undefined,
    })
  }

  const parsed = midtransStatusResponseSchema.safeParse(payload)

  if (!parsed.success) {
    throw httpError({
      operation: "status",
      status: response.status,
      providerStatusCode,
      retryable: true,
    })
  }

  return parsed.data
}

export async function cancelSnapTransaction({
  orderId,
  idempotencyKey,
}: {
  readonly orderId: string
  readonly idempotencyKey: string
}): Promise<MidtransCancelResponse> {
  const config = midtransServerConfig()
  let response: Response

  try {
    response = await fetch(
      `${config.statusApiUrl}/${encodeURIComponent(orderId)}/cancel`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: authorizationHeader(config.serverKey),
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      }
    )
  } catch (error) {
    throw requestError("cancel", error)
  }

  const payload = await responsePayload(response)
  const statusCode = midtransStatusCodeSchema.safeParse(payload)
  const providerStatusCode = statusCode.success
    ? statusCode.data.status_code
    : null
  const parsed = midtransCancelResponseSchema.safeParse(payload)

  if (!response.ok || !parsed.success || parsed.data.status_code !== "200") {
    throw httpError({
      operation: "cancel",
      status: response.status,
      providerStatusCode,
      retryable: response.ok ? true : undefined,
    })
  }

  return parsed.data
}

export type SnapSessionCancellationResult =
  | { readonly kind: "cancelled"; readonly canceledAt: string }
  | { readonly kind: "already-cancelled" }
  | { readonly kind: "in-progress" }
  | { readonly kind: "not-found" }

function knownSnapSessionCancellationResult(
  messages: readonly string[]
): Exclude<
  SnapSessionCancellationResult,
  { readonly kind: "cancelled" }
> | null {
  const normalized = messages.join(" ").toLowerCase()

  if (
    normalized.includes("already canceled") ||
    normalized.includes("already cancelled")
  ) {
    return { kind: "already-cancelled" }
  }

  if (
    normalized.includes("transaction is on progress") ||
    normalized.includes("transaction is in progress")
  ) {
    return { kind: "in-progress" }
  }

  if (
    normalized.includes("token not found") ||
    normalized.includes("token is not found") ||
    normalized.includes("token does not exist") ||
    normalized.includes("token doesn't exist")
  ) {
    return { kind: "not-found" }
  }

  return null
}

export async function cancelSnapSession({
  token,
}: {
  readonly token: string
}): Promise<SnapSessionCancellationResult> {
  const config = midtransServerConfig()
  let response: Response

  try {
    response = await fetch(
      `${config.snapApiUrl}/${encodeURIComponent(token)}/cancel`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: authorizationHeader(config.serverKey),
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      }
    )
  } catch (error) {
    throw requestError("snap-session-cancel", error)
  }

  const payload = await responsePayload(response)
  const success = snapSessionCancellationResponseSchema.safeParse(payload)

  if (response.ok && success.success) {
    return { kind: "cancelled", canceledAt: success.data.canceled_at }
  }

  const statusCode = midtransStatusCodeSchema.safeParse(payload)
  const providerStatusCode = statusCode.success
    ? statusCode.data.status_code
    : null

  if (response.status === 404 || providerStatusCode === "404") {
    return { kind: "not-found" }
  }

  const providerError = snapSessionCancellationErrorSchema.safeParse(payload)

  if (providerError.success) {
    const known = knownSnapSessionCancellationResult(
      providerError.data.error_messages
    )

    if (known) return known
  }

  throw httpError({
    operation: "snap-session-cancel",
    status: response.status,
    providerStatusCode,
    retryable: response.ok ? true : undefined,
  })
}
