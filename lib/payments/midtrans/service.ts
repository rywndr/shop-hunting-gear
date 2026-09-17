import "server-only"

import { reconcileReturnRefunds } from "@/lib/returns/refunds"

import {
  cancelSnapSession,
  cancelSnapTransaction,
  getSnapTransactionStatus,
  midtransIdempotencyKey,
  MidtransApiError,
} from "@/lib/payments/midtrans/client"
import {
  classifyMidtransPayment,
  isRevenuePaymentStatus,
  outcomeForPaymentStatus,
  type MidtransPaymentOutcome,
} from "@/lib/payments/midtrans/reconciliation"
import {
  abandonOrderCancellation,
  adminCancellationContext,
  completeUnpaidOrderCancellation,
  recordCancellationReconciliationProblem,
  selectCancellationProviderAction,
} from "@/lib/orders/cancellation-service"
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

export async function reconcileMidtransPayment(
  orderId: string,
  notificationTransactionId?: string | null
) {
  const order = await paymentOrderForId(orderId)

  if (!order) {
    throw new UnknownOrderError(orderId)
  }

  const payment = await getSnapTransactionStatus({
    orderId,
    transactionId: order.midtransTransactionId ?? notificationTransactionId,
  })

  if (
    payment.order_id !== orderId ||
    (order.midtransTransactionId &&
      payment.transaction_id !== order.midtransTransactionId)
  ) {
    throw new InvalidPaymentError(
      "Midtrans returned a different order or transaction."
    )
  }

  await reconcileReturnRefunds(payment)
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
  | {
      readonly kind: "found"
      readonly providerOutcome: MidtransPaymentOutcome
      readonly appliedOutcome: MidtransPaymentOutcome
      readonly payment: MidtransStatusResponse
    }
  | { readonly kind: "not-found" }

function cancellationOutcomeWithoutPersistedIntent(
  status: Extract<CurrentStatus, { readonly kind: "found" }>
): MidtransPaymentOutcome {
  if (
    status.appliedOutcome.kind === "paid" ||
    status.appliedOutcome.kind === "reversed"
  ) {
    return status.appliedOutcome
  }

  return status.providerOutcome
}

async function applyStatus(
  payment: MidtransStatusResponse
): Promise<MidtransPaymentOutcome> {
  await reconcileReturnRefunds(payment)
  const applied = await applyMidtransPaymentUpdate(payment)
  return outcomeForAppliedPayment(applied)
}

async function currentStatus(
  orderId: string,
  transactionId?: string | null
): Promise<CurrentStatus> {
  try {
    const payment = await getSnapTransactionStatus({ orderId, transactionId })

    if (
      payment.order_id !== orderId ||
      (transactionId && payment.transaction_id !== transactionId)
    ) {
      throw new InvalidPaymentError(
        "Midtrans returned a different order or transaction."
      )
    }

    const providerOutcome = classifyMidtransPayment({
      transactionStatus: payment.transaction_status,
      fraudStatus: payment.fraud_status ?? null,
    })
    const appliedOutcome = await applyStatus(payment)

    return { kind: "found", providerOutcome, appliedOutcome, payment }
  } catch (error) {
    if (isStatusNotFound(error)) return { kind: "not-found" }
    throw error
  }
}

export type AdminUnpaidCancellationResult =
  | { readonly kind: "completed" }
  | { readonly kind: "pending" }
  | { readonly kind: "paid" }
  | { readonly kind: "not-eligible" }
  | { readonly kind: "not-found" }

const CANCELLATION_RECONCILIATION_ERROR =
  "Provider cancellation outcome requires reconciliation."

async function unresolvedAdminCancellation({
  cancellationId,
  actorId,
}: {
  readonly cancellationId: string
  readonly actorId: string
}): Promise<AdminUnpaidCancellationResult> {
  await recordCancellationReconciliationProblem({
    cancellationId,
    actorId,
    error: CANCELLATION_RECONCILIATION_ERROR,
  })
  return { kind: "pending" }
}

async function completeAdminCancellation({
  cancellationId,
  actorId,
  financialAction,
  providerTransactionReference,
}: {
  readonly cancellationId: string
  readonly actorId: string
  readonly financialAction: "none" | "cancel_payment"
  readonly providerTransactionReference?: string | null
}): Promise<AdminUnpaidCancellationResult> {
  const result = await completeUnpaidOrderCancellation({
    cancellationId,
    actorId,
    financialAction,
    providerTransactionReference,
  })

  switch (result.kind) {
    case "completed":
    case "already-completed":
      return { kind: "completed" }
    case "paid":
      return { kind: "paid" }
    case "not-eligible":
      return { kind: "not-eligible" }
    case "not-found":
      return { kind: "not-found" }
    default: {
      const _exhaustive: never = result
      return _exhaustive
    }
  }
}

async function rejectPaidAdminCancellation({
  cancellationId,
  actorId,
}: {
  readonly cancellationId: string
  readonly actorId: string
}): Promise<AdminUnpaidCancellationResult> {
  await abandonOrderCancellation({
    cancellationId,
    actorId,
    error: "Order has recognized revenue and cannot use unpaid cancellation.",
  })
  return { kind: "paid" }
}

async function finishFromAdminStatus({
  status,
  cancellationId,
  actorId,
  financialAction,
}: {
  readonly status: CurrentStatus
  readonly cancellationId: string
  readonly actorId: string
  readonly financialAction: "none" | "cancel_payment"
}): Promise<AdminUnpaidCancellationResult | null> {
  if (status.kind === "not-found") return null

  switch (status.providerOutcome.kind) {
    case "cancelled":
      return completeAdminCancellation({
        cancellationId,
        actorId,
        financialAction,
        providerTransactionReference: status.payment.transaction_id ?? null,
      })
    case "paid":
    case "reversed":
      return rejectPaidAdminCancellation({ cancellationId, actorId })
    case "unknown":
      return unresolvedAdminCancellation({ cancellationId, actorId })
    case "pending":
      return null
    default: {
      const _exhaustive: never = status.providerOutcome
      return _exhaustive
    }
  }
}

async function selectAdminProviderCancellation({
  cancellationId,
  actorId,
  orderId,
  existingIdempotencyKey,
  providerTransactionReference,
}: {
  readonly cancellationId: string
  readonly actorId: string
  readonly orderId: string
  readonly existingIdempotencyKey: string | null
  readonly providerTransactionReference: string | null
}) {
  return selectCancellationProviderAction({
    cancellationId,
    actorId,
    providerIdempotencyKey:
      existingIdempotencyKey ?? midtransIdempotencyKey(orderId, "cancel"),
    providerTransactionReference,
  })
}

async function cancelAdminPendingTransaction({
  cancellationId,
  actorId,
  orderId,
  status,
  existingIdempotencyKey = null,
}: {
  readonly cancellationId: string
  readonly actorId: string
  readonly orderId: string
  readonly status: Extract<CurrentStatus, { readonly kind: "found" }>
  readonly existingIdempotencyKey?: string | null
}): Promise<AdminUnpaidCancellationResult> {
  const cancellation = await selectAdminProviderCancellation({
    cancellationId,
    actorId,
    orderId,
    existingIdempotencyKey,
    providerTransactionReference: status.payment.transaction_id ?? null,
  })
  if (!cancellation?.providerIdempotencyKey) return { kind: "not-eligible" }

  try {
    await cancelSnapTransaction({
      orderId,
      idempotencyKey: cancellation.providerIdempotencyKey,
    })
  } catch {
    // A timeout may mean Midtrans accepted the operation. GET decides below.
  }

  let after: CurrentStatus
  try {
    after = await currentStatus(orderId, status.payment.transaction_id ?? null)
  } catch {
    return unresolvedAdminCancellation({ cancellationId, actorId })
  }

  const finished = await finishFromAdminStatus({
    status: after,
    cancellationId,
    actorId,
    financialAction: "cancel_payment",
  })
  return finished ?? unresolvedAdminCancellation({ cancellationId, actorId })
}

async function cancelAdminSnapSession({
  cancellationId,
  actorId,
  orderId,
  token,
  paymentSessionExpiresAt,
  existingIdempotencyKey,
}: {
  readonly cancellationId: string
  readonly actorId: string
  readonly orderId: string
  readonly token: string
  readonly paymentSessionExpiresAt: Date | null
  readonly existingIdempotencyKey: string | null
}): Promise<AdminUnpaidCancellationResult> {
  const cancellation = await selectAdminProviderCancellation({
    cancellationId,
    actorId,
    orderId,
    existingIdempotencyKey,
    providerTransactionReference: null,
  })
  if (!cancellation) return { kind: "not-eligible" }

  let endpointResult: Awaited<ReturnType<typeof cancelSnapSession>> | null =
    null
  try {
    endpointResult = await cancelSnapSession({ token })
  } catch {
    // Reconcile below because the request may have reached Midtrans.
  }

  let reconciled: CurrentStatus
  try {
    reconciled = await currentStatus(orderId)
  } catch {
    return unresolvedAdminCancellation({ cancellationId, actorId })
  }

  const finished = await finishFromAdminStatus({
    status: reconciled,
    cancellationId,
    actorId,
    financialAction: "cancel_payment",
  })
  if (finished) return finished

  if (reconciled.kind === "found") {
    return cancelAdminPendingTransaction({
      cancellationId,
      actorId,
      orderId,
      status: reconciled,
      existingIdempotencyKey: cancellation.providerIdempotencyKey,
    })
  }

  if (
    endpointResult?.kind === "cancelled" ||
    endpointResult?.kind === "already-cancelled"
  ) {
    return completeAdminCancellation({
      cancellationId,
      actorId,
      financialAction: "cancel_payment",
    })
  }

  if (
    endpointResult?.kind === "not-found" &&
    paymentSessionExpiresAt !== null &&
    paymentSessionExpiresAt.getTime() <= Date.now()
  ) {
    return completeAdminCancellation({
      cancellationId,
      actorId,
      financialAction: "cancel_payment",
    })
  }

  return unresolvedAdminCancellation({ cancellationId, actorId })
}

export async function executeAdminUnpaidCancellation({
  orderId,
  actorId,
}: {
  readonly orderId: string
  readonly actorId: string
}): Promise<AdminUnpaidCancellationResult> {
  const context = await adminCancellationContext({ orderId, actorId })
  if (!context) return { kind: "not-found" }
  if (context.cancellation.status === "completed") return { kind: "completed" }

  const { cancellation, order } = context
  if (cancellation.status === "failed") return { kind: "not-eligible" }

  if (
    cancellation.financialAction === "cancel_payment" &&
    order.sourceKind !== "manual"
  ) {
    let selectedStatus: CurrentStatus
    try {
      selectedStatus = await currentStatus(orderId, order.midtransTransactionId)
    } catch {
      return unresolvedAdminCancellation({
        cancellationId: cancellation.id,
        actorId,
      })
    }

    const selectedFinished = await finishFromAdminStatus({
      status: selectedStatus,
      cancellationId: cancellation.id,
      actorId,
      financialAction: "cancel_payment",
    })
    if (selectedFinished) return selectedFinished

    if (selectedStatus.kind === "found") {
      return cancelAdminPendingTransaction({
        cancellationId: cancellation.id,
        actorId,
        orderId,
        status: selectedStatus,
        existingIdempotencyKey: cancellation.providerIdempotencyKey,
      })
    }

    if (!order.snapToken) {
      return unresolvedAdminCancellation({
        cancellationId: cancellation.id,
        actorId,
      })
    }

    return cancelAdminSnapSession({
      cancellationId: cancellation.id,
      actorId,
      orderId,
      token: order.snapToken,
      paymentSessionExpiresAt: order.paymentSessionExpiresAt,
      existingIdempotencyKey: cancellation.providerIdempotencyKey,
    })
  }

  if (isRevenuePaymentStatus(order.paymentStatus)) {
    return rejectPaidAdminCancellation({
      cancellationId: cancellation.id,
      actorId,
    })
  }
  if (order.fulfillmentStatus === "cancelled") {
    const action =
      cancellation.financialAction === "cancel_payment"
        ? "cancel_payment"
        : "none"
    return completeAdminCancellation({
      cancellationId: cancellation.id,
      actorId,
      financialAction: action,
      providerTransactionReference: order.midtransTransactionId,
    })
  }
  if (
    order.fulfillmentStatus !== "awaiting_payment" ||
    order.tracking !== null
  ) {
    await abandonOrderCancellation({
      cancellationId: cancellation.id,
      actorId,
      error: "Order fulfillment is not eligible for unpaid cancellation.",
    })
    return { kind: "not-eligible" }
  }

  if (order.sourceKind === "manual") {
    return completeAdminCancellation({
      cancellationId: cancellation.id,
      actorId,
      financialAction: "none",
    })
  }

  let initial: CurrentStatus
  try {
    initial = await currentStatus(orderId, order.midtransTransactionId)
  } catch {
    return unresolvedAdminCancellation({
      cancellationId: cancellation.id,
      actorId,
    })
  }

  const finished = await finishFromAdminStatus({
    status: initial,
    cancellationId: cancellation.id,
    actorId,
    financialAction:
      cancellation.financialAction === "cancel_payment"
        ? "cancel_payment"
        : "none",
  })
  if (finished) return finished

  if (initial.kind === "found") {
    return cancelAdminPendingTransaction({
      cancellationId: cancellation.id,
      actorId,
      orderId,
      status: initial,
      existingIdempotencyKey: cancellation.providerIdempotencyKey,
    })
  }

  if (order.snapToken) {
    return cancelAdminSnapSession({
      cancellationId: cancellation.id,
      actorId,
      orderId,
      token: order.snapToken,
      paymentSessionExpiresAt: order.paymentSessionExpiresAt,
      existingIdempotencyKey: cancellation.providerIdempotencyKey,
    })
  }

  if (
    order.paymentInitStatus === "pending" ||
    order.paymentInitStatus === "failed"
  ) {
    return completeAdminCancellation({
      cancellationId: cancellation.id,
      actorId,
      financialAction: "none",
    })
  }

  return unresolvedAdminCancellation({
    cancellationId: cancellation.id,
    actorId,
  })
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

  return (
    terminalCancellationResult(
      cancellationOutcomeWithoutPersistedIntent(after)
    ) ?? {
      kind: "pending",
    }
  )
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

  const terminal = terminalCancellationResult(
    cancellationOutcomeWithoutPersistedIntent(status)
  )
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

  const terminal = terminalCancellationResult(
    cancellationOutcomeWithoutPersistedIntent(initial)
  )
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
        const cancellationOutcome =
          cancellationOutcomeWithoutPersistedIntent(status)

        switch (cancellationOutcome.kind) {
          case "paid":
          case "reversed":
          case "cancelled":
            continue
          case "unknown":
            continue
          case "pending":
            break
          default: {
            const _exhaustive: never = cancellationOutcome
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
