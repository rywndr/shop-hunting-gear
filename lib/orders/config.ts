export const ORDER_STATUSES = {
  unpaid: {
    label: "Belum Bayar",
    badge: "destructive",
    primaryAction: "Bayar Sekarang",
    secondaryAction: "Batalkan Pesanan",
    returnAction: null,
  },
  processing: {
    label: "Diproses",
    badge: "secondary",
    primaryAction: null,
    secondaryAction: "Lihat Detail",
    returnAction: null,
  },
  shipped: {
    label: "Dikirim",
    badge: "default",
    primaryAction: "Lacak Pengiriman",
    secondaryAction: "Pesanan Diterima",
    returnAction: null,
  },
  completed: {
    label: "Selesai",
    badge: "outline",
    primaryAction: "Beli Lagi",
    secondaryAction: "Beri Ulasan",
    returnAction: "Ajukan Retur",
  },
  cancelled: {
    label: "Dibatalkan",
    badge: "outline",
    primaryAction: "Beli Lagi",
    secondaryAction: null,
    returnAction: null,
  },
} as const satisfies Record<string, OrderStatusMeta>

export type OrderStatusMeta = {
  readonly label: string
  readonly badge: "default" | "secondary" | "destructive" | "outline"
  readonly primaryAction: string | null
  readonly secondaryAction: string | null
  readonly returnAction: string | null
}

export type OrderStatus = keyof typeof ORDER_STATUSES

export const PAYMENT_STATUSES = {
  pending: "pending",
  authorized: "authorized",
  paid: "paid",
  failed: "failed",
  denied: "denied",
  cancelled: "cancelled",
  expired: "expired",
  partialRefund: "partial_refund",
  refunded: "refunded",
  partialChargeback: "partial_chargeback",
  chargeback: "chargeback",
} as const

export type PaymentStatus =
  (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES]

export type FulfillmentStatus =
  "awaiting_payment" | "processing" | "shipped" | "completed" | "cancelled"

export type OrderSourceKind = "cart" | "product" | "manual"

export const ORDER_STATUS_ORDER = [
  "unpaid",
  "processing",
  "shipped",
  "completed",
  "cancelled",
] as const satisfies readonly OrderStatus[]

export type OrderItem = {
  readonly productSlug: string
  readonly name: string
  readonly variant: string
  readonly quantity: number
  readonly price: number
}

export type Order = {
  readonly id: string
  readonly status: OrderStatus
  readonly paymentStatus: PaymentStatus
  readonly fulfillmentStatus: FulfillmentStatus
  readonly sourceKind: OrderSourceKind
  readonly placedAt: string
  readonly courier: string
  readonly shipping: number
  readonly tracking: string | null
  readonly paymentToken: string | null
  readonly items: readonly OrderItem[]
}

export function orderSubtotal(order: Pick<Order, "items">) {
  return order.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  )
}

export function orderTotal(order: Pick<Order, "items" | "shipping">) {
  return orderSubtotal(order) + order.shipping
}

export function orderItemCount(order: Pick<Order, "items">) {
  return order.items.reduce((count, item) => count + item.quantity, 0)
}

export function recentOrders(orders: readonly Order[], limit: number) {
  return [...orders]
    .sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt))
    .slice(0, limit)
}
