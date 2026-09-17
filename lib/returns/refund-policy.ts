import type { MidtransStatusResponse } from "@/lib/payments/midtrans/schema"
import { parseIdrAmount } from "@/lib/payments/midtrans/reconciliation"

export const REFUND_RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function providerRefundDate(
  value: string | null | undefined
): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value))
    return null
  const date = new Date(`${value.replace(" ", "T")}+07:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function refundAmountInteger(
  value: string | null | undefined
): number | null {
  if (!value) return null
  const amount = parseIdrAmount(value)
  return amount !== null && amount <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(amount)
    : null
}

export function onlineRefundSupported({
  paymentType,
  amount,
  grossAmount,
}: {
  readonly paymentType: string
  readonly amount: number
  readonly grossAmount: number
}) {
  const type = paymentType.toLowerCase()
  if (
    ![
      "credit_card",
      "gopay",
      "shopeepay",
      "dana",
      "ovo",
      "qris",
      "kredivo",
      "akulaku",
    ].includes(type)
  )
    return false
  // The endpoint reference is stricter than Midtrans's general feature table.
  return !(["shopeepay", "ovo"].includes(type) && amount !== grossAmount)
}

// Unknown provider methods require investigation, not an assumed offline payout.
export function returnRefundMethod({
  paymentType,
  amount,
  grossAmount,
}: {
  readonly paymentType: string | null | undefined
  readonly amount: number
  readonly grossAmount: number
}): "midtrans" | "offline" | "unknown" {
  if (!paymentType) return "unknown"
  const type = paymentType.toLowerCase()
  if (onlineRefundSupported({ paymentType: type, amount, grossAmount }))
    return "midtrans"
  // Non-online types documented at https://docs.midtrans.com/docs/https-notification-webhooks,
  // plus the endpoint's full-refund-only methods handled by the existing offline policy.
  if (
    ["bank_transfer", "echannel", "cstore", "shopeepay", "ovo"].includes(type)
  )
    return "offline"
  return "unknown"
}

export function matchingProviderRefund({
  payment,
  refundKey,
  amount,
}: {
  readonly payment: MidtransStatusResponse
  readonly refundKey: string
  readonly amount: number
}) {
  if (
    !["refund", "partial_refund"].includes(
      payment.transaction_status.toLowerCase()
    )
  )
    return null
  const matches =
    payment.refunds?.filter((refund) => refund.refund_key === refundKey) ?? []
  if (matches.length !== 1) return null
  const refund = matches[0]
  if (!refund || refundAmountInteger(refund.refund_amount) !== amount)
    return null
  return {
    id: refund.refund_chargeback_id,
    amount,
    bankConfirmedAt: providerRefundDate(refund.bank_confirmed_at),
  }
}

export function hasFullProviderRefund({
  payment,
  amount,
}: {
  readonly payment: MidtransStatusResponse
  readonly amount: number
}) {
  const transactionStatus = payment.transaction_status.trim().toLowerCase()
  if (
    transactionStatus !== "refund" &&
    transactionStatus !== "partial_refund"
  ) {
    return false
  }

  const refundedAmount = refundAmountInteger(payment.refund_amount)
  return refundedAmount !== null && refundedAmount >= amount
}
