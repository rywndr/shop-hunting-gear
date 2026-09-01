import "server-only"

import {
  cancelSnapSession,
  cancelSnapTransaction,
  getSnapTransactionStatus,
  midtransIdempotencyKey,
  MidtransApiError,
} from "@/lib/payments/midtrans/client"
import {
  isRevenuePaymentStatus,
  outcomeForPaymentStatus,
  type MidtransPaymentOutcome,
} from "@/lib/payments/midtrans/reconciliation"
import {
  applyMidtransPaymentUpdate,
  cancelUnpaidOrderLocally,
  expiredSnapSessionOrders,
  InvalidPaymentError,
  paymentOrderForId,
  paymentOrderForUser,
  UnknownOrderError,
} from "@/lib/orders/service"
import type { MidtransStatusResponse } from "@/lib/payments/midtrans/schema"

export type PaymentReconciliationResult = Awaited<
  ReturnType<typeof applyMidtransPaymentUpdate>
>

function outcomeForAppliedPayment(
  applied: PaymentReconciliationResult
): MidtransPaymentOutcome {
  if (applied.kind === "unknown") {
    return {
      kind: "unknown",
      transactionStatus: applied.transactionStatus,
    }
  }

  return outcomeForPaymentStatus(applied.paymentStatus)
}

export async function reconcileMidtransPayment(orderId: string) {
  const order = await paymentOrderForId(orderId)

  if (!order) {
    throw new UnknownOrderError(orderId)
  }

  const payment = await getSnapTransactionStatus({ orderId })

  if (payment.order_id !== orderId) {
    throw new InvalidPaymentError("Midtrans returned a different order.")
  }

  const applied = await applyMidtransPaymentUpdate(payment)

  return {
    outcome: outcomeForAppliedPayment(applied),
    applied,
  }
}

function isMidtransApiError(error: unknown): error is MidtransApiError {
  return error instanceof MidtransApiError
}

function isStatusNotFound(error: unknown): error is MidtransApiError {
  return (
    isMidtransApiError(error) && error.operation === "status" && error.notFound
  )
}

export type CancelPaymentResult =
  | { readonly kind: "cancelled" }
  | { readonly kind: "paid" }
  | { readonly kind: "pending" }
  | { readonly kind: "not-found" }
  | { readonly kind: "error" }

type CurrentStatus =
  | { readonly kind: "found"; readonly outcome: MidtransPaymentOutcome }
  | { readonly kind: "not-found" }

async function applyStatus(
  payment: MidtransStatusResponse
): Promise<MidtransPaymentOutcome> {
  const applied = await applyMidtransPaymentUpdate(payment)
  return outcomeForAppliedPayment(applied)
}

async function currentStatus(orderId: string): Promise<CurrentStatus> {
  try {
    const payment = await getSnapTransactionStatus({ orderId })

    if (payment.order_id !== orderId) {
      throw new InvalidPaymentError("Midtrans returned a different order.")
    }

    return { kind: "found", outcome: await applyStatus(payment) }
  } catch (error) {
    if (isStatusNotFound(error)) return { kind: "not-found" }
    throw error
  }
}

function terminalCancellationResult(
  outcome: MidtransPaymentOutcome
): Exclude<CancelPaymentResult, { readonly kind: "pending" }> | null {
  switch (outcome.kind) {
    case "paid":
    case "reversed":
      return { kind: "paid" }
    case "cancelled":
      return { kind: "cancelled" }
    case "unknown":
      return { kind: "error" }
    case "pending":
      return null
    default: {
      const _exhaustive: never = outcome
      return _exhaustive
    }
  }
}

async function statusAfterTransactionCancellation(
  orderId: string
): Promise<CancelPaymentResult> {
  let after: CurrentStatus

  try {
    after = await currentStatus(orderId)
  } catch {
    return { kind: "error" }
  }

  if (after.kind === "not-found") {
    return { kind: "error" }
  }

  return terminalCancellationResult(after.outcome) ?? { kind: "pending" }
}

async function cancelActiveTransaction(
  orderId: string
): Promise<CancelPaymentResult> {
  try {
    await cancelSnapTransaction({
      orderId,
      idempotencyKey: midtransIdempotencyKey(orderId, "cancel"),
    })
  } catch {
    return statusAfterTransactionCancellation(orderId)
  }

  return statusAfterTransactionCancellation(orderId)
}

async function cancelLocally({
  userId,
  orderId,
  expectedPaymentInitStatus,
  onlyWithoutSnapToken = false,
}: {
  readonly userId: string
  readonly orderId: string
  readonly expectedPaymentInitStatus?: "pending" | "failed"
  readonly onlyWithoutSnapToken?: boolean
}): Promise<CancelPaymentResult> {
  const result = await cancelUnpaidOrderLocally({
    userId,
    orderId,
    expectedPaymentInitStatus,
    onlyWithoutSnapToken,
  })

  switch (result.kind) {
    case "cancelled":
      return { kind: "cancelled" }
    case "paid":
      return { kind: "paid" }
    case "not-cancellable":
      return { kind: "error" }
    default: {
      const _exhaustive: never = result
      return _exhaustive
    }
  }
}

async function reconcileAfterSessionEndpoint({
  orderId,
  notFoundFallback,
}: {
  readonly orderId: string
  readonly notFoundFallback: () => Promise<CancelPaymentResult>
}): Promise<CancelPaymentResult> {
  let status: CurrentStatus

  try {
    status = await currentStatus(orderId)
  } catch {
    return { kind: "error" }
  }

  if (status.kind === "not-found") {
    return notFoundFallback()
  }

  const terminal = terminalCancellationResult(status.outcome)
  return terminal ?? cancelActiveTransaction(orderId)
}

async function cancelSnapSessionForOrder({
  userId,
  orderId,
  token,
  paymentSessionExpiresAt,
}: {
  readonly userId: string
  readonly orderId: string
  readonly token: string
  readonly paymentSessionExpiresAt: Date | null
}): Promise<CancelPaymentResult> {
  let result

  try {
    result = await cancelSnapSession({ token })
  } catch {
    return reconcileAfterSessionEndpoint({
      orderId,
      notFoundFallback: () =>
        paymentSessionExpiresAt !== null &&
        paymentSessionExpiresAt.getTime() <= Date.now()
          ? cancelLocally({ userId, orderId })
          : Promise.resolve({ kind: "error" }),
    })
  }

  switch (result.kind) {
    case "cancelled":
    case "already-cancelled":
      return reconcileAfterSessionEndpoint({
        orderId,
        notFoundFallback: () => cancelLocally({ userId, orderId }),
      })
    case "in-progress":
      return reconcileAfterSessionEndpoint({
        orderId,
        notFoundFallback: async () => ({ kind: "pending" }),
      })
    case "not-found":
      return reconcileAfterSessionEndpoint({
        orderId,
        notFoundFallback: () =>
          paymentSessionExpiresAt !== null &&
          paymentSessionExpiresAt.getTime() <= Date.now()
            ? cancelLocally({ userId, orderId })
            : Promise.resolve({ kind: "error" }),
      })
    default: {
      const _exhaustive: never = result
      return _exhaustive
    }
  }
}

export async function cancelMidtransOrderForUser({
  userId,
  orderId,
}: {
  readonly userId: string
  readonly orderId: string
}): Promise<CancelPaymentResult> {
  const order = await paymentOrderForUser({ userId, orderId })

  if (!order) return { kind: "not-found" }
  if (isRevenuePaymentStatus(order.paymentStatus)) {
    return { kind: "paid" }
  }
  if (order.fulfillmentStatus === "cancelled") {
    return { kind: "cancelled" }
  }
  if (order.fulfillmentStatus !== "awaiting_payment") {
    return { kind: "error" }
  }

  let initial: CurrentStatus

  try {
    initial = await currentStatus(orderId)
  } catch {
    return { kind: "error" }
  }

  if (initial.kind === "not-found") {
    if (!order.snapToken) {
      if (
        order.paymentInitStatus === "pending" ||
        order.paymentInitStatus === "failed"
      ) {
        return cancelLocally({
          userId,
          orderId,
          expectedPaymentInitStatus: order.paymentInitStatus,
          onlyWithoutSnapToken: true,
        })
      }

      return { kind: "error" }
    }

    return cancelSnapSessionForOrder({
      userId,
      orderId,
      token: order.snapToken,
      paymentSessionExpiresAt: order.paymentSessionExpiresAt,
    })
  }

  const terminal = terminalCancellationResult(initial.outcome)
  return terminal ?? cancelActiveTransaction(orderId)
}

export async function reconcileExpiredSnapSessionReservations({
  productSlugs,
}: {
  readonly productSlugs?: readonly string[]
} = {}): Promise<void> {
  const candidates = await expiredSnapSessionOrders({ productSlugs })

  for (const order of candidates) {
    try {
      if (
        order.paymentSessionExpiresAt === null ||
        order.paymentSessionExpiresAt.getTime() > Date.now()
      ) {
        continue
      }

      const status = await currentStatus(order.id)

      if (status.kind === "found") {
        switch (status.outcome.kind) {
          case "paid":
          case "reversed":
          case "cancelled":
            continue
          case "unknown":
            continue
          case "pending":
            break
          default: {
            const _exhaustive: never = status.outcome
            return _exhaustive
          }
        }
      }

      if (!order.snapToken) continue

      const result = await cancelSnapSessionForOrder({
        userId: order.userId,
        orderId: order.id,
        token: order.snapToken,
        paymentSessionExpiresAt: order.paymentSessionExpiresAt,
      })

      if (result.kind === "pending" || result.kind === "error") {
        console.error(
          JSON.stringify({
            event: "payments.expired_snap_session_not_released",
            orderId: order.id,
            result: result.kind,
          })
        )
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "payments.expired_snap_session_reconciliation_failed",
          orderId: order.id,
          error: error instanceof Error ? error.message : String(error),
        })
      )
    }
  }
}
