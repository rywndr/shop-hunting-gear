import {
  orderSubtotal,
  type OrderItem,
  type OrderStatusMeta,
} from "@/lib/orders/config"

type BadgeVariant = OrderStatusMeta["badge"]

export const PAYMENT_METHODS = {
  midtrans: { label: "Midtrans" },
  manual: { label: "Manual" },
} as const satisfies Record<string, { readonly label: string }>

export type PaymentMethod = keyof typeof PAYMENT_METHODS

export const FULFILLMENT_STAGES = {
  inTransit: { label: "Dikirim", badge: "default" },
  awaitingCompletion: {
    label: "Menunggu Pesanan Selesai",
    badge: "secondary",
  },
  completed: { label: "Selesai", badge: "outline" },
} as const satisfies Record<
  string,
  { readonly label: string; readonly badge: BadgeVariant }
>

export type FulfillmentStage = keyof typeof FULFILLMENT_STAGES

type TransactionDetails = {
  readonly orderId: string
  readonly settledAt: string
  readonly method: PaymentMethod
  readonly items: readonly [OrderItem, ...OrderItem[]]
  readonly shipping: number
  readonly discount: number
}

export type Transaction = TransactionDetails & {
  readonly fulfillment: FulfillmentStage
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

export function transactionsByDate(
  transactions: readonly Transaction[]
): readonly Transaction[] {
  return transactions
    .slice()
    .sort((a, b) => Date.parse(b.settledAt) - Date.parse(a.settledAt))
}

export function fundsTotal(transactions: readonly Transaction[]) {
  return transactions.reduce(
    (total, transaction) => total + transactionEarnings(transaction),
    0
  )
}
