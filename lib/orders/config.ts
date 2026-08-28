/**
 * Single source of truth for the orders lifecycle.
 */

export const ORDER_STATUSES = {
  unpaid: {
    label: "Belum Bayar",
    badge: "destructive",
    primaryAction: "Bayar Sekarang",
    secondaryAction: "Batalkan Pesanan",
  },
  processing: {
    label: "Diproses",
    badge: "secondary",
    primaryAction: null,
    secondaryAction: "Lihat Detail",
  },
  shipped: {
    label: "Dikirim",
    badge: "default",
    primaryAction: "Lacak Pengiriman",
    secondaryAction: "Pesanan Diterima",
  },
  completed: {
    label: "Selesai",
    badge: "outline",
    primaryAction: "Beli Lagi",
    secondaryAction: "Beri Ulasan",
  },
  cancelled: {
    label: "Dibatalkan",
    badge: "outline",
    primaryAction: "Beli Lagi",
    secondaryAction: null,
  },
} as const satisfies Record<string, OrderStatusMeta>

export type OrderStatusMeta = {
  readonly label: string
  readonly badge: "default" | "secondary" | "destructive" | "outline"
  readonly primaryAction: string | null
  readonly secondaryAction: string | null
}

export type OrderStatus = keyof typeof ORDER_STATUSES

export const ORDER_STATUS_ORDER = [
  "unpaid",
  "processing",
  "shipped",
  "completed",
  "cancelled",
] as const satisfies readonly OrderStatus[]

export type OrderItem = {
  readonly name: string
  readonly variant: string
  readonly quantity: number
  readonly price: number
}

export type Order = {
  readonly id: string
  readonly status: OrderStatus
  readonly placedAt: string
  readonly courier: string
  readonly shipping: number
  readonly tracking: string | null
  readonly items: readonly OrderItem[]
}

export function orderSubtotal(order: Order) {
  return order.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  )
}

export function orderTotal(order: Order) {
  return orderSubtotal(order) + order.shipping
}

export function orderItemCount(order: Order) {
  return order.items.reduce((count, item) => count + item.quantity, 0)
}
