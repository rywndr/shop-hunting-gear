import type { FulfillmentStatus, PaymentStatus } from "@/lib/orders/config"
import { RETURN_WINDOW_MS } from "./config"

export function isReturnEligible({
  completedAt,
  fulfillmentStatus,
  paymentStatus,
  midtransRefundAmount,
  midtransChargebackAmount,
  hasRequest,
  now,
}: {
  readonly completedAt: Date | null
  readonly fulfillmentStatus: FulfillmentStatus
  readonly paymentStatus: PaymentStatus
  readonly midtransRefundAmount: number | null
  readonly midtransChargebackAmount: number | null
  readonly hasRequest: boolean
  readonly now: Date
}) {
  if (hasRequest || completedAt === null || fulfillmentStatus !== "completed")
    return false
  if (
    paymentStatus !== "paid" ||
    (midtransRefundAmount ?? 0) !== 0 ||
    (midtransChargebackAmount ?? 0) !== 0
  )
    return false
  const elapsed = now.getTime() - completedAt.getTime()
  return elapsed >= 0 && elapsed < RETURN_WINDOW_MS
}
