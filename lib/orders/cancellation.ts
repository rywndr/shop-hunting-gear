import type { FulfillmentStatus } from "./config"

export const CANCELLATION_STATUSES = [
  "requested",
  "provider_operation_pending",
  "refund_pending",
  "manual_refund_required",
  "completed",
  "failed",
] as const

export type OrderCancellationStatus = (typeof CANCELLATION_STATUSES)[number]

export const ACTIVE_CANCELLATION_STATUSES = [
  "requested",
  "provider_operation_pending",
  "refund_pending",
  "manual_refund_required",
] as const satisfies readonly OrderCancellationStatus[]

// `failed` is terminal and means cancellation was explicitly abandoned.
// Retryable or ambiguous failures stay active and record the problem through
// reconciliationStatus and lastError.

export type OrderCancellationActorType = "customer" | "admin"

export type OrderCancellationFinancialAction =
  "undetermined" | "none" | "cancel_payment" | "refund" | "manual_refund"

export type OrderCancellationReconciliationStatus =
  "not_required" | "pending" | "reconciled" | "failed"

export type CancellationEligibility = {
  readonly fulfillmentStatus: FulfillmentStatus
  readonly tracking: string | null
}

export function canCancelOrder({
  fulfillmentStatus,
  tracking,
}: CancellationEligibility) {
  switch (fulfillmentStatus) {
    case "awaiting_payment":
      return true
    case "processing":
      return tracking === null
    case "shipped":
    case "completed":
    case "cancelled":
      return false
    default: {
      const _exhaustive: never = fulfillmentStatus
      return _exhaustive
    }
  }
}

export function isActiveCancellationStatus(status: OrderCancellationStatus) {
  return ACTIVE_CANCELLATION_STATUSES.some(
    (activeStatus) => activeStatus === status
  )
}
