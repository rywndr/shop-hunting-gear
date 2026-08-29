import {
  orderItemCount,
  orderSubtotal,
  type OrderItem,
  type OrderStatusMeta,
} from "@/lib/orders/config"

type BadgeVariant = OrderStatusMeta["badge"]

export type PayoutStateMeta = {
  readonly label: string
  readonly shortLabel: string
  readonly statusLabel: string
  readonly badge: BadgeVariant
  readonly note: string
}

/**
 * A transaction reaches this page once the order ships, so the money is either
 * waiting for that order to finish or already out.
 */
export const PAYOUT_STATES = {
  pending: {
    label: "Dana Pending",
    shortLabel: "Pending",
    statusLabel: "Menunggu Pesanan Selesai",
    badge: "secondary",
    note: "Dari pesanan yang sudah dikirim dan belum selesai.",
  },
  released: {
    label: "Dana Dilepas",
    shortLabel: "Dilepas",
    statusLabel: "Dana Dilepas",
    badge: "default",
    note: "Sudah cair ke rekening toko.",
  },
} as const satisfies Record<string, PayoutStateMeta>

export type PayoutState = keyof typeof PAYOUT_STATES

export const PAYOUT_STATE_ORDER = [
  "pending",
  "released",
] as const satisfies readonly PayoutState[]

export function isPayoutState(value: string): value is PayoutState {
  return Object.hasOwn(PAYOUT_STATES, value)
}

export const PAYMENT_METHODS = {
  midtrans: { label: "Midtrans" },
  manual: { label: "Manual" },
} as const satisfies Record<string, { readonly label: string }>

export type PaymentMethod = keyof typeof PAYMENT_METHODS

export type Transaction = {
  readonly orderId: string
  readonly settledAt: string
  readonly payout: PayoutState
  readonly method: PaymentMethod
  readonly items: readonly [OrderItem, ...OrderItem[]]
  readonly shipping: number
  readonly discount: number
}

export type EarningsLineKind = "credit" | "debit"

const LINE_SIGN = {
  credit: 1,
  debit: -1,
} as const satisfies Record<EarningsLineKind, number>

export type EarningsLine = {
  readonly label: string
  readonly amount: number
  readonly kind: EarningsLineKind
}

export function earningsLineAmount(line: EarningsLine) {
  return LINE_SIGN[line.kind] * line.amount
}

function lineTotal(lines: readonly EarningsLine[]) {
  return lines.reduce((total, line) => total + earningsLineAmount(line), 0)
}

function nonZeroLines(lines: readonly EarningsLine[]): readonly EarningsLine[] {
  return lines.filter((line) => line.amount !== 0)
}

export function paymentLines(
  transaction: Transaction
): readonly EarningsLine[] {
  return nonZeroLines([
    {
      label: "Harga barang",
      amount: orderSubtotal(transaction),
      kind: "credit",
    },
    {
      label: "Ongkos kirim dari pembeli",
      amount: transaction.shipping,
      kind: "credit",
    },
    { label: "Diskon toko", amount: transaction.discount, kind: "debit" },
  ])
}

export function amountPaid(transaction: Transaction) {
  return lineTotal(paymentLines(transaction))
}

export function deductionLines(
  transaction: Transaction
): readonly EarningsLine[] {
  return nonZeroLines([
    {
      label: "Ongkos kirim ke kurir",
      amount: transaction.shipping,
      kind: "debit",
    },
  ])
}

export function transactionEarnings(transaction: Transaction) {
  return amountPaid(transaction) + lineTotal(deductionLines(transaction))
}

export function transactionItemCount(transaction: Transaction) {
  return orderItemCount(transaction)
}

export type EarningsGroup = {
  readonly label: string
  readonly lines: readonly EarningsLine[]
  readonly total: { readonly label: string; readonly amount: number }
}

export function earningsBreakdown(
  transaction: Transaction
): readonly [EarningsGroup, EarningsGroup] {
  return [
    {
      label: "Pembayaran pembeli",
      lines: paymentLines(transaction),
      total: { label: "Dibayar pembeli", amount: amountPaid(transaction) },
    },
    {
      label: "Potongan",
      lines: deductionLines(transaction),
      total: {
        label: "Penghasilan bersih",
        amount: transactionEarnings(transaction),
      },
    },
  ]
}

export function transactionsByPayout(
  transactions: readonly Transaction[],
  payout: PayoutState
): readonly Transaction[] {
  return transactions
    .filter((transaction) => transaction.payout === payout)
    .sort((a, b) => Date.parse(b.settledAt) - Date.parse(a.settledAt))
}

export type PayoutTotal = {
  readonly payout: PayoutState
  readonly amount: number
  readonly count: number
}

export function payoutTotals(
  transactions: readonly Transaction[]
): readonly PayoutTotal[] {
  return PAYOUT_STATE_ORDER.map((payout) => {
    const group = transactionsByPayout(transactions, payout)

    return {
      payout,
      amount: group.reduce(
        (total, transaction) => total + transactionEarnings(transaction),
        0
      ),
      count: group.length,
    }
  })
}
