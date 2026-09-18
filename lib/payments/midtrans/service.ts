import "server-only"

import { reconcileReturnRefunds } from "@/lib/returns/refunds"

import {
  cancelSnapSession,
  cancelSnapTransaction,
  getSnapTransactionStatus,
  midtransIdempotencyKey,
  MidtransApiError,
  refundMidtransTransaction,
} from "@/lib/payments/midtrans/client"
import {
  classifyMidtransPayment,
  isRevenuePaymentStatus,
  outcomeForPaymentStatus,
  type MidtransPaymentOutcome,
} from "@/lib/payments/midtrans/reconciliation"
import {
  abandonOrderCancellation,
  cancellationContextForActor,
  commitPaidCancellationOperation,
  completeUnpaidOrderCancellation,
  reactivateFailedPaidCancellation,
  reconcileCancellationRefund,
  recordCancellationReconciliationProblem,
  selectAlreadyReversedCancellationAction,
  selectCancellationProviderAction,
  selectCancellationRefundAction,
} from "@/lib/orders/cancellation-service"
import type {
  CancellationActor,
  OrderCancellationProviderSelectedStatus,
} from "@/lib/orders/cancellation"
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
import {
  hasFullProviderRefund,
  matchingProviderRefund,
  returnRefundMethod,
} from "@/lib/returns/refund-policy"

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
  await reconcileCancellationRefund(payment)

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
  await reconcileCancellationRefund(payment)
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

export type OrderCancellationExecutionResult =
  | { readonly kind: "completed" }
  | { readonly kind: "pending" }
  | { readonly kind: "refund_pending" }
  | { readonly kind: "manual_refund_required" }
  | { readonly kind: "paid" }
  | { readonly kind: "not-eligible" }
  | { readonly kind: "not-found" }

const CANCELLATION_RECONCILIATION_ERROR =
  "Provider cancellation outcome requires reconciliation."

function normalizeCancellableStatus(
  status: string
): "pending" | "authorize" | "capture" | null {
  switch (status.trim().toLowerCase()) {
    case "pending":
      return "pending"
    case "authorize":
      return "authorize"
    case "capture":
      return "capture"
    default:
      return null
  }
}

async function unresolvedAdminCancellation({
  cancellationId,
  actorId,
  actorType,
}: CancellationActor & {
  readonly cancellationId: string
}): Promise<OrderCancellationExecutionResult> {
  await recordCancellationReconciliationProblem({
    cancellationId,
    actorId,
    actorType,
    error: CANCELLATION_RECONCILIATION_ERROR,
  })
  return { kind: "pending" }
}

async function completeAdminCancellation({
  cancellationId,
  actorId,
  actorType,
  financialAction,
  providerTransactionReference,
}: CancellationActor & {
  readonly cancellationId: string
  readonly financialAction: "none" | "cancel_payment"
  readonly providerTransactionReference?: string | null
}): Promise<OrderCancellationExecutionResult> {
  const result = await completeUnpaidOrderCancellation({
    cancellationId,
    actorId,
    actorType,
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

async function finishFromAdminStatus({
  status,
  cancellationId,
  actorId,
  actorType,
  financialAction,
}: CancellationActor & {
  readonly status: CurrentStatus
  readonly cancellationId: string
  readonly financialAction: "none" | "cancel_payment"
}): Promise<OrderCancellationExecutionResult | null> {
  if (status.kind === "not-found") return null

  switch (status.providerOutcome.kind) {
    case "cancelled":
      return completeAdminCancellation({
        cancellationId,
        actorId,
        actorType,
        financialAction,
        providerTransactionReference: status.payment.transaction_id ?? null,
      })
    case "paid":
    case "reversed":
      return null
    case "unknown":
      return unresolvedAdminCancellation({ cancellationId, actorId, actorType })
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
  actorType,
  orderId,
  existingIdempotencyKey,
  providerTransactionReference,
  providerSelectedStatus,
}: CancellationActor & {
  readonly cancellationId: string
  readonly orderId: string
  readonly existingIdempotencyKey: string | null
  readonly providerTransactionReference: string | null
  readonly providerSelectedStatus?: OrderCancellationProviderSelectedStatus
}) {
  return selectCancellationProviderAction({
    cancellationId,
    actorId,
    actorType,
    providerIdempotencyKey:
      existingIdempotencyKey ?? midtransIdempotencyKey(orderId, "cancel"),
    providerTransactionReference,
    providerSelectedStatus,
  })
}

async function cancelAdminPendingTransaction({
  cancellationId,
  actorId,
  actorType,
  orderId,
  status,
  existingIdempotencyKey = null,
}: CancellationActor & {
  readonly cancellationId: string
  readonly orderId: string
  readonly status: Extract<CurrentStatus, { readonly kind: "found" }>
  readonly existingIdempotencyKey?: string | null
}): Promise<OrderCancellationExecutionResult> {
  const cancellation = await selectAdminProviderCancellation({
    cancellationId,
    actorId,
    actorType,
    orderId,
    existingIdempotencyKey,
    providerTransactionReference: status.payment.transaction_id ?? null,
    providerSelectedStatus:
      normalizeCancellableStatus(status.payment.transaction_status) ??
      undefined,
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
    return unresolvedAdminCancellation({ cancellationId, actorId, actorType })
  }

  const continuedAsPaid = await continueAsPaidAfterFreshStatus({
    status: after,
    orderId,
    actorId,
    actorType,
  })
  if (continuedAsPaid) return continuedAsPaid

  const finished = await finishFromAdminStatus({
    status: after,
    cancellationId,
    actorId,
    actorType,
    financialAction: "cancel_payment",
  })
  return (
    finished ??
    unresolvedAdminCancellation({ cancellationId, actorId, actorType })
  )
}

async function cancelAdminSnapSession({
  cancellationId,
  actorId,
  actorType,
  orderId,
  token,
  paymentSessionExpiresAt,
  existingIdempotencyKey,
}: CancellationActor & {
  readonly cancellationId: string
  readonly orderId: string
  readonly token: string
  readonly paymentSessionExpiresAt: Date | null
  readonly existingIdempotencyKey: string | null
}): Promise<OrderCancellationExecutionResult> {
  const cancellation = await selectAdminProviderCancellation({
    cancellationId,
    actorId,
    actorType,
    orderId,
    existingIdempotencyKey,
    providerTransactionReference: null,
    providerSelectedStatus: "snap_session",
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
    return unresolvedAdminCancellation({ cancellationId, actorId, actorType })
  }

  const continuedAsPaid = await continueAsPaidAfterFreshStatus({
    status: reconciled,
    orderId,
    actorId,
    actorType,
  })
  if (continuedAsPaid) return continuedAsPaid

  const finished = await finishFromAdminStatus({
    status: reconciled,
    cancellationId,
    actorId,
    actorType,
    financialAction: "cancel_payment",
  })
  if (finished) return finished

  if (reconciled.kind === "found") {
    return cancelAdminPendingTransaction({
      cancellationId,
      actorId,
      actorType,
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
      actorType,
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
      actorType,
      financialAction: "cancel_payment",
    })
  }

  return unresolvedAdminCancellation({ cancellationId, actorId, actorType })
}

async function commitPaidCancellation({
  cancellationId,
  actorId,
  actorType,
  completion,
}: CancellationActor & {
  readonly cancellationId: string
  readonly completion:
    | "cancel_confirmed"
    | "already_reversed"
    | "refund_pending"
    | "manual_refund_required"
}): Promise<OrderCancellationExecutionResult> {
  const result = await commitPaidCancellationOperation({
    cancellationId,
    actorId,
    actorType,
    completion,
  })
  if (result.kind === "not-found") return { kind: "not-found" }
  if (result.kind === "not-eligible") return { kind: "not-eligible" }
  if (completion === "refund_pending") return { kind: "refund_pending" }
  if (completion === "manual_refund_required") {
    return { kind: "manual_refund_required" }
  }
  return { kind: "completed" }
}

async function prepareManualPaidCancellation({
  cancellationId,
  actorId,
  actorType,
  grossAmount,
  source,
}: CancellationActor & {
  readonly cancellationId: string
  readonly grossAmount: number
  readonly source:
    | { readonly kind: "manual-order" }
    | {
        readonly kind: "verified-offline-settlement"
        readonly providerTransactionReference: string
      }
}) {
  const selected = await selectCancellationRefundAction({
    cancellationId,
    actorId,
    actorType,
    refundAmount: grossAmount,
    selection:
      source.kind === "manual-order"
        ? { kind: "manual-order-refund" }
        : {
            kind: "verified-offline-settlement",
            providerTransactionReference: source.providerTransactionReference,
            providerStatus: "settlement",
          },
  })
  if (!selected) return { kind: "not-eligible" } as const
  return commitPaidCancellation({
    cancellationId,
    actorId,
    actorType,
    completion: "manual_refund_required",
  })
}

async function executeCancellationRefund({
  cancellationId,
  actorId,
  actorType,
  orderId,
  grossAmount,
  payment,
  existingRefundKey,
}: CancellationActor & {
  readonly cancellationId: string
  readonly orderId: string
  readonly grossAmount: number
  readonly payment: MidtransStatusResponse
  readonly existingRefundKey: string | null
}): Promise<OrderCancellationExecutionResult> {
  const method = returnRefundMethod({
    paymentType: payment.payment_type,
    amount: grossAmount,
    grossAmount,
  })
  if (method === "unknown") {
    return unresolvedAdminCancellation({ cancellationId, actorId, actorType })
  }
  if (method === "offline") {
    if (
      payment.transaction_status.trim().toLowerCase() !== "settlement" ||
      !payment.transaction_id
    ) {
      return unresolvedAdminCancellation({ cancellationId, actorId, actorType })
    }
    return prepareManualPaidCancellation({
      cancellationId,
      actorId,
      actorType,
      grossAmount,
      source: {
        kind: "verified-offline-settlement",
        providerTransactionReference: payment.transaction_id,
      },
    })
  }
  if (!payment.transaction_id) {
    return unresolvedAdminCancellation({ cancellationId, actorId, actorType })
  }

  const refundKey = existingRefundKey ?? `cancellation_${cancellationId}`
  const selected = await selectCancellationRefundAction({
    cancellationId,
    actorId,
    actorType,
    refundAmount: grossAmount,
    selection: {
      kind: "online-refund",
      refundKey,
      providerTransactionReference: payment.transaction_id,
    },
  })
  if (!selected) return { kind: "not-eligible" }

  const committed = await commitPaidCancellation({
    cancellationId,
    actorId,
    actorType,
    completion: "refund_pending",
  })
  if (committed.kind !== "refund_pending") return committed

  if (matchingProviderRefund({ payment, refundKey, amount: grossAmount })) {
    await reconcileCancellationRefund(payment)
    const match = matchingProviderRefund({
      payment,
      refundKey,
      amount: grossAmount,
    })
    return match?.bankConfirmedAt
      ? { kind: "completed" }
      : { kind: "refund_pending" }
  }
  if (payment.transaction_status.trim().toLowerCase() !== "settlement") {
    return unresolvedAdminCancellation({ cancellationId, actorId, actorType })
  }

  try {
    await refundMidtransTransaction({
      transactionId: payment.transaction_id,
      refundKey,
      amount: grossAmount,
      reason: "Pembatalan pesanan sebelum pengiriman",
    })
  } catch {
    // GET below resolves success, duplicate submission, and ambiguity.
  }

  let after: CurrentStatus
  try {
    after = await currentStatus(orderId, payment.transaction_id)
  } catch {
    return unresolvedAdminCancellation({ cancellationId, actorId, actorType })
  }
  if (after.kind === "found") {
    const matched = matchingProviderRefund({
      payment: after.payment,
      refundKey,
      amount: grossAmount,
    })
    if (matched) {
      await reconcileCancellationRefund(after.payment)
      return matched.bankConfirmedAt
        ? { kind: "completed" }
        : { kind: "refund_pending" }
    }
  }
  return unresolvedAdminCancellation({ cancellationId, actorId, actorType })
}

async function executePaidAdminCancellation({
  context,
  actorId,
  actorType,
}: CancellationActor & {
  readonly context: NonNullable<
    Awaited<ReturnType<typeof cancellationContextForActor>>
  >
}): Promise<OrderCancellationExecutionResult> {
  const { cancellation, order } = context
  if (order.sourceKind === "manual") {
    return prepareManualPaidCancellation({
      cancellationId: cancellation.id,
      actorId,
      actorType,
      grossAmount: order.grossAmount,
      source: { kind: "manual-order" },
    })
  }

  let status: CurrentStatus
  try {
    status = await currentStatus(order.id, order.midtransTransactionId)
  } catch {
    return unresolvedAdminCancellation({
      cancellationId: cancellation.id,
      actorId,
      actorType,
    })
  }
  if (status.kind === "not-found") {
    return unresolvedAdminCancellation({
      cancellationId: cancellation.id,
      actorId,
      actorType,
    })
  }

  const rawStatus = status.payment.transaction_status.trim().toLowerCase()
  if (
    rawStatus === "cancel" &&
    cancellation.financialAction === "cancel_payment" &&
    cancellation.providerSelectedStatus !== null &&
    cancellation.providerTransactionReference !== null &&
    status.payment.transaction_id === cancellation.providerTransactionReference
  ) {
    return commitPaidCancellation({
      cancellationId: cancellation.id,
      actorId,
      actorType,
      completion: "cancel_confirmed",
    })
  }
  const cancellable = normalizeCancellableStatus(rawStatus)
  if (cancellable) {
    const selected = await selectAdminProviderCancellation({
      cancellationId: cancellation.id,
      actorId,
      actorType,
      orderId: order.id,
      existingIdempotencyKey: cancellation.providerIdempotencyKey,
      providerTransactionReference: status.payment.transaction_id ?? null,
      providerSelectedStatus: cancellable,
    })
    if (!selected?.providerIdempotencyKey) return { kind: "not-eligible" }
    try {
      await cancelSnapTransaction({
        orderId: order.id,
        idempotencyKey: selected.providerIdempotencyKey,
      })
    } catch {
      // GET below resolves success, duplicate submission, and ambiguity.
    }
    let after: CurrentStatus
    try {
      after = await currentStatus(
        order.id,
        selected.providerTransactionReference
      )
    } catch {
      return unresolvedAdminCancellation({
        cancellationId: cancellation.id,
        actorId,
        actorType,
      })
    }
    if (
      after.kind === "found" &&
      after.payment.transaction_status.trim().toLowerCase() === "cancel" &&
      after.payment.transaction_id === selected.providerTransactionReference
    ) {
      return commitPaidCancellation({
        cancellationId: cancellation.id,
        actorId,
        actorType,
        completion: "cancel_confirmed",
      })
    }
    if (
      after.kind === "found" &&
      after.payment.transaction_status.trim().toLowerCase() === "settlement"
    ) {
      return executeCancellationRefund({
        cancellationId: cancellation.id,
        actorId,
        actorType,
        orderId: order.id,
        grossAmount: order.grossAmount,
        payment: after.payment,
        existingRefundKey:
          selected.financialAction === "refund"
            ? selected.providerIdempotencyKey
            : null,
      })
    }
    return unresolvedAdminCancellation({
      cancellationId: cancellation.id,
      actorId,
      actorType,
    })
  }

  switch (rawStatus) {
    case "settlement":
      return executeCancellationRefund({
        cancellationId: cancellation.id,
        actorId,
        actorType,
        orderId: order.id,
        grossAmount: order.grossAmount,
        payment: status.payment,
        existingRefundKey:
          cancellation.financialAction === "refund"
            ? cancellation.providerIdempotencyKey
            : null,
      })
    case "refund":
    case "partial_refund": {
      if (
        (cancellation.financialAction === "undetermined" ||
          cancellation.financialAction === "none") &&
        status.payment.transaction_id &&
        hasFullProviderRefund({
          payment: status.payment,
          amount: order.grossAmount,
        })
      ) {
        const selected = await selectAlreadyReversedCancellationAction({
          cancellationId: cancellation.id,
          actorId,
          actorType,
          providerTransactionReference: status.payment.transaction_id,
        })
        if (!selected) return { kind: "not-eligible" }
        return commitPaidCancellation({
          cancellationId: cancellation.id,
          actorId,
          actorType,
          completion: "already_reversed",
        })
      }
      if (
        cancellation.financialAction === "refund" &&
        cancellation.providerIdempotencyKey &&
        cancellation.refundAmount === order.grossAmount &&
        matchingProviderRefund({
          payment: status.payment,
          refundKey: cancellation.providerIdempotencyKey,
          amount: order.grossAmount,
        })
      ) {
        await reconcileCancellationRefund(status.payment)
        const match = matchingProviderRefund({
          payment: status.payment,
          refundKey: cancellation.providerIdempotencyKey,
          amount: order.grossAmount,
        })
        return match?.bankConfirmedAt
          ? { kind: "completed" }
          : { kind: "refund_pending" }
      }
      return unresolvedAdminCancellation({
        cancellationId: cancellation.id,
        actorId,
        actorType,
      })
    }
    case "cancel":
    case "expire":
    case "deny":
    case "failure":
    default:
      return unresolvedAdminCancellation({
        cancellationId: cancellation.id,
        actorId,
        actorType,
      })
  }
}

async function continueAsPaidAfterFreshStatus({
  status,
  orderId,
  actorId,
  actorType,
}: CancellationActor & {
  readonly status: CurrentStatus
  readonly orderId: string
}): Promise<OrderCancellationExecutionResult | null> {
  if (
    status.kind !== "found" ||
    (status.providerOutcome.kind !== "paid" &&
      status.providerOutcome.kind !== "reversed")
  ) {
    return null
  }

  const context = await cancellationContextForActor({
    orderId,
    actorId,
    actorType,
  })
  if (!context) return { kind: "not-found" }
  if (
    !isRevenuePaymentStatus(context.order.paymentStatus) ||
    context.order.tracking !== null ||
    (context.order.fulfillmentStatus !== "processing" &&
      context.order.fulfillmentStatus !== "cancelled")
  ) {
    return unresolvedAdminCancellation({
      cancellationId: context.cancellation.id,
      actorId,
      actorType,
    })
  }

  return executePaidAdminCancellation({ context, actorId, actorType })
}

export async function executeOrderCancellation({
  orderId,
  actorId,
  actorType,
}: CancellationActor & {
  readonly orderId: string
}): Promise<OrderCancellationExecutionResult> {
  let context = await cancellationContextForActor({
    orderId,
    actorId,
    actorType,
  })
  if (!context) return { kind: "not-found" }
  if (context.cancellation.status === "completed") return { kind: "completed" }

  if (context.cancellation.status === "failed") {
    const reactivated = await reactivateFailedPaidCancellation({
      orderId,
      actorId,
      actorType,
    })
    if (!reactivated) return { kind: "not-eligible" }
    const refreshed = await cancellationContextForActor({
      orderId,
      actorId,
      actorType,
    })
    if (!refreshed) return { kind: "not-found" }
    context = refreshed
  }

  const { cancellation, order } = context

  if (
    isRevenuePaymentStatus(order.paymentStatus) &&
    (order.fulfillmentStatus === "processing" ||
      order.fulfillmentStatus === "cancelled") &&
    order.tracking === null
  ) {
    return executePaidAdminCancellation({ context, actorId, actorType })
  }

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
        actorType,
      })
    }

    const continuedAsPaid = await continueAsPaidAfterFreshStatus({
      status: selectedStatus,
      orderId,
      actorId,
      actorType,
    })
    if (continuedAsPaid) return continuedAsPaid

    const selectedFinished = await finishFromAdminStatus({
      status: selectedStatus,
      cancellationId: cancellation.id,
      actorId,
      actorType,
      financialAction: "cancel_payment",
    })
    if (selectedFinished) return selectedFinished

    if (selectedStatus.kind === "found") {
      return cancelAdminPendingTransaction({
        cancellationId: cancellation.id,
        actorId,
        actorType,
        orderId,
        status: selectedStatus,
        existingIdempotencyKey: cancellation.providerIdempotencyKey,
      })
    }

    if (!order.snapToken) {
      return unresolvedAdminCancellation({
        cancellationId: cancellation.id,
        actorId,
        actorType,
      })
    }

    return cancelAdminSnapSession({
      cancellationId: cancellation.id,
      actorId,
      actorType,
      orderId,
      token: order.snapToken,
      paymentSessionExpiresAt: order.paymentSessionExpiresAt,
      existingIdempotencyKey: cancellation.providerIdempotencyKey,
    })
  }

  if (isRevenuePaymentStatus(order.paymentStatus)) {
    return unresolvedAdminCancellation({
      cancellationId: cancellation.id,
      actorId,
      actorType,
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
      actorType,
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
      actorType,
      error: "Order fulfillment is not eligible for unpaid cancellation.",
    })
    return { kind: "not-eligible" }
  }

  if (order.sourceKind === "manual") {
    return completeAdminCancellation({
      cancellationId: cancellation.id,
      actorId,
      actorType,
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
      actorType,
    })
  }

  const continuedAsPaid = await continueAsPaidAfterFreshStatus({
    status: initial,
    orderId,
    actorId,
    actorType,
  })
  if (continuedAsPaid) return continuedAsPaid

  const finished = await finishFromAdminStatus({
    status: initial,
    cancellationId: cancellation.id,
    actorId,
    actorType,
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
      actorType,
      orderId,
      status: initial,
      existingIdempotencyKey: cancellation.providerIdempotencyKey,
    })
  }

  if (order.snapToken) {
    return cancelAdminSnapSession({
      cancellationId: cancellation.id,
      actorId,
      actorType,
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
      actorType,
      financialAction: "none",
    })
  }

  return unresolvedAdminCancellation({
    cancellationId: cancellation.id,
    actorId,
    actorType,
  })
}

export type AdminUnpaidCancellationResult = OrderCancellationExecutionResult

export function executeAdminUnpaidCancellation({
  orderId,
  actorId,
}: {
  readonly orderId: string
  readonly actorId: string
}) {
  return executeOrderCancellation({ orderId, actorId, actorType: "admin" })
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
