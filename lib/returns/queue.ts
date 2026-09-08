import type { RefundStatus, ReturnStatus } from "./config"

export const ACTIONABLE_RETURN_STATUSES = [
  "requested",
  "approved",
  "inspected",
] as const satisfies readonly ReturnStatus[]

export const ACTIVE_REFUND_STATUSES = [
  "ready",
  "pending",
  "blocked",
] as const satisfies readonly RefundStatus[]

const actionableReturnStatusSet = new Set<ReturnStatus>(
  ACTIONABLE_RETURN_STATUSES
)
const activeRefundStatusSet = new Set<RefundStatus>(ACTIVE_REFUND_STATUSES)

export function isActionableReturn({
  status,
  refundStatus,
}: {
  readonly status: ReturnStatus
  readonly refundStatus: RefundStatus | null
}) {
  return (
    actionableReturnStatusSet.has(status) &&
    (refundStatus === null || activeRefundStatusSet.has(refundStatus))
  )
}
