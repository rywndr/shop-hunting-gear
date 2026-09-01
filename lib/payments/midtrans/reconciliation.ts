import type { PaymentStatus } from "@/lib/orders/config"

export type MidtransPaymentOutcome =
  | {
      readonly kind: "paid"
      readonly paymentStatus: "paid"
    }
  | {
      readonly kind: "pending"
      readonly paymentStatus: "pending" | "authorized"
    }
  | {
      readonly kind: "cancelled"
      readonly paymentStatus: "failed" | "denied" | "cancelled" | "expired"
    }
  | {
      readonly kind: "reversed"
      readonly paymentStatus:
        "partial_refund" | "refunded" | "partial_chargeback" | "chargeback"
    }
  | {
      readonly kind: "unknown"
      readonly transactionStatus: string
    }

export type PaymentTransition =
  | { readonly kind: "settle"; readonly paymentStatus: "paid" }
  | {
      readonly kind: "release"
      readonly paymentStatus: "failed" | "denied" | "cancelled" | "expired"
    }
  | { readonly kind: "record"; readonly paymentStatus: PaymentStatus }
  | { readonly kind: "ignore"; readonly paymentStatus: PaymentStatus }
  | {
      readonly kind: "unknown"
      readonly paymentStatus: PaymentStatus
      readonly transactionStatus: string
    }

export function classifyMidtransPayment({
  transactionStatus,
  fraudStatus,
}: {
  readonly transactionStatus: string
  readonly fraudStatus: string | null
}): MidtransPaymentOutcome {
  switch (transactionStatus.trim().toLowerCase()) {
    case "settlement":
      return { kind: "paid", paymentStatus: "paid" }
    case "capture": {
      const normalizedFraudStatus = fraudStatus?.trim().toLowerCase()

      return normalizedFraudStatus === "accept"
        ? { kind: "paid", paymentStatus: "paid" }
        : normalizedFraudStatus === "deny"
          ? { kind: "cancelled", paymentStatus: "denied" }
          : { kind: "pending", paymentStatus: "authorized" }
    }
    case "authorize":
      return { kind: "pending", paymentStatus: "authorized" }
    case "pending":
      return { kind: "pending", paymentStatus: "pending" }
    case "failure":
      return { kind: "cancelled", paymentStatus: "failed" }
    case "deny":
      return { kind: "cancelled", paymentStatus: "denied" }
    case "cancel":
      return { kind: "cancelled", paymentStatus: "cancelled" }
    case "expire":
      return { kind: "cancelled", paymentStatus: "expired" }
    case "partial_refund":
      return { kind: "reversed", paymentStatus: "partial_refund" }
    case "refund":
      return { kind: "reversed", paymentStatus: "refunded" }
    case "partial_chargeback":
      return { kind: "reversed", paymentStatus: "partial_chargeback" }
    case "chargeback":
      return { kind: "reversed", paymentStatus: "chargeback" }
    default:
      return { kind: "unknown", transactionStatus }
  }
}

export function outcomeForPaymentStatus(
  status: PaymentStatus
): MidtransPaymentOutcome {
  switch (status) {
    case "paid":
      return { kind: "paid", paymentStatus: "paid" }
    case "partial_refund":
    case "refunded":
    case "partial_chargeback":
    case "chargeback":
      return { kind: "reversed", paymentStatus: status }
    case "failed":
    case "denied":
    case "cancelled":
    case "expired":
      return { kind: "cancelled", paymentStatus: status }
    case "pending":
      return { kind: "pending", paymentStatus: "pending" }
    case "authorized":
      return { kind: "pending", paymentStatus: "authorized" }
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function paymentTransition({
  current,
  incoming,
}: {
  readonly current: PaymentStatus
  readonly incoming: MidtransPaymentOutcome
}): PaymentTransition {
  if (incoming.kind === "unknown") {
    return {
      kind: "unknown",
      paymentStatus: current,
      transactionStatus: incoming.transactionStatus,
    }
  }

  if (incoming.kind === "paid") {
    if (current === "paid") {
      return { kind: "ignore", paymentStatus: current }
    }

    if (
      current === "partial_refund" ||
      current === "refunded" ||
      current === "partial_chargeback" ||
      current === "chargeback"
    ) {
      return { kind: "ignore", paymentStatus: current }
    }

    return { kind: "settle", paymentStatus: "paid" }
  }

  if (incoming.kind === "reversed") {
    if (!isRevenuePaymentStatus(current)) {
      return { kind: "ignore", paymentStatus: current }
    }

    if (current === "chargeback" || current === "refunded") {
      return { kind: "ignore", paymentStatus: current }
    }

    if (
      current === "partial_chargeback" &&
      incoming.paymentStatus !== "chargeback"
    ) {
      return { kind: "ignore", paymentStatus: current }
    }

    if (
      current === "partial_refund" &&
      incoming.paymentStatus === "partial_refund"
    ) {
      return { kind: "ignore", paymentStatus: current }
    }

    return { kind: "record", paymentStatus: incoming.paymentStatus }
  }

  if (
    current === "paid" ||
    current === "partial_refund" ||
    current === "refunded" ||
    current === "partial_chargeback" ||
    current === "chargeback"
  ) {
    return { kind: "ignore", paymentStatus: current }
  }

  if (
    current === "failed" ||
    current === "denied" ||
    current === "cancelled" ||
    current === "expired"
  ) {
    if (incoming.kind === "pending" || incoming.kind === "cancelled") {
      return { kind: "ignore", paymentStatus: current }
    }
  }

  if (
    current === "authorized" &&
    incoming.kind === "pending" &&
    incoming.paymentStatus === "pending"
  ) {
    return { kind: "ignore", paymentStatus: current }
  }

  if (incoming.kind === "cancelled") {
    return { kind: "release", paymentStatus: incoming.paymentStatus }
  }

  return { kind: "record", paymentStatus: incoming.paymentStatus }
}

export function isRevenuePaymentStatus(status: PaymentStatus) {
  return (
    status === "paid" ||
    status === "partial_refund" ||
    status === "refunded" ||
    status === "partial_chargeback" ||
    status === "chargeback"
  )
}

export function parseIdrAmount(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim())

  if (!match || (match[2] !== undefined && /[^0]/.test(match[2]))) {
    return null
  }

  try {
    return BigInt(match[1])
  } catch {
    return null
  }
}

export function grossAmountMatches(value: string, expected: number) {
  return (
    Number.isSafeInteger(expected) &&
    expected >= 0 &&
    parseIdrAmount(value) === BigInt(expected)
  )
}
