import type { FulfillmentStatus, Order } from "./config"
import { z } from "zod"

export const adminOrderCancellationSchema = z.object({
  orderId: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(1000),
})

export type AdminOrderCancellationInput = z.infer<
  typeof adminOrderCancellationSchema
>

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

export type CancellationActor = {
  readonly actorId: string
  readonly actorType: OrderCancellationActorType
}

export const customerOrderCancellationSchema = z.object({
  orderId: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(1000),
})

export type CustomerOrderCancellationInput = z.infer<
  typeof customerOrderCancellationSchema
>

export type OrderCancellationFinancialAction =
  "undetermined" | "none" | "cancel_payment" | "refund" | "manual_refund"

export type OrderCancellationProviderSelectedStatus =
  "pending" | "authorize" | "capture" | "settlement" | "snap_session"

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

export function canCustomerCancelOrder({
  status,
  paymentStatus,
  fulfillmentStatus,
  tracking,
}: Pick<Order, "status" | "paymentStatus" | "fulfillmentStatus" | "tracking">) {
  if (status === "unpaid") return fulfillmentStatus === "awaiting_payment"
  return (
    status === "processing" &&
    paymentStatus === "paid" &&
    fulfillmentStatus === "processing" &&
    tracking === null
  )
}

export function customerOrderActionVisibility({
  order,
  hasCancellation,
}: {
  readonly order: Pick<
    Order,
    | "status"
    | "paymentStatus"
    | "fulfillmentStatus"
    | "tracking"
    | "paymentToken"
  >
  readonly hasCancellation: boolean
}) {
  return {
    showCancellation: !hasCancellation && canCustomerCancelOrder(order),
    showPayment:
      !hasCancellation &&
      order.status === "unpaid" &&
      order.paymentToken !== null,
    showPrimaryAction: !(hasCancellation && order.status === "unpaid"),
    showCancellationStatus: hasCancellation,
  }
}

export function isActiveCancellationStatus(status: OrderCancellationStatus) {
  return ACTIVE_CANCELLATION_STATUSES.some(
    (activeStatus) => activeStatus === status
  )
}
