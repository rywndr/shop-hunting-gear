import { ALL_FILTER } from "@/lib/admin/config"
import type { Order, OrderStatus, OrderStatusMeta } from "@/lib/orders/config"
import { isRevenuePaymentStatus } from "@/lib/payments/midtrans/reconciliation"

type BadgeVariant = OrderStatusMeta["badge"]

export type OrderQueueMeta = {
  readonly label: string
  readonly badge: BadgeVariant
  readonly counted: boolean
}

export const ORDER_QUEUES = {
  unpaid: { label: "Belum Bayar", badge: "default", counted: true },
  toShip: { label: "Perlu Dikirim", badge: "secondary", counted: true },
  shipped: { label: "Dikirim", badge: "default", counted: true },
  completed: { label: "Selesai", badge: "outline", counted: false },
  returns: {
    label: "Pengembalian/Pembatalan",
    badge: "outline",
    counted: false,
  },
} as const satisfies Record<string, OrderQueueMeta>

export type OrderQueue = keyof typeof ORDER_QUEUES

const QUEUE_BY_STATUS = {
  unpaid: "unpaid",
  processing: "toShip",
  shipped: "shipped",
  completed: "completed",
  cancelled: "returns",
} as const satisfies Record<OrderStatus, OrderQueue>

export type SalesOrder = {
  readonly buyer: string
  readonly order: Order
}

export function salesOrderQueue({ order }: SalesOrder): OrderQueue {
  return QUEUE_BY_STATUS[order.status]
}

type OrderState = Pick<Order, "paymentStatus" | "fulfillmentStatus">

export function canMarkOrderPaid({
  sourceKind,
  paymentStatus,
  fulfillmentStatus,
}: OrderState & Pick<Order, "sourceKind">) {
  return (
    sourceKind === "manual" &&
    fulfillmentStatus === "awaiting_payment" &&
    (paymentStatus === "pending" || paymentStatus === "authorized")
  )
}

export function canMarkOrderCompleted({
  paymentStatus,
  fulfillmentStatus,
}: OrderState) {
  return (
    isRevenuePaymentStatus(paymentStatus) &&
    (fulfillmentStatus === "processing" || fulfillmentStatus === "shipped")
  )
}

type ShipmentState = OrderState & Pick<Order, "tracking">

export function canShipOrder({
  paymentStatus,
  fulfillmentStatus,
  tracking,
}: ShipmentState) {
  return (
    isRevenuePaymentStatus(paymentStatus) &&
    fulfillmentStatus === "processing" &&
    tracking === null
  )
}

type LabelState = Pick<Order, "fulfillmentStatus" | "tracking">

export function canPrintShippingLabel<Candidate extends LabelState>(
  order: Candidate
): order is Candidate & { readonly tracking: string } {
  return (
    order.tracking !== null &&
    (order.fulfillmentStatus === "shipped" ||
      order.fulfillmentStatus === "completed")
  )
}

export function shippingLabelHref(orderId: string) {
  return `/admin/pesanan/${encodeURIComponent(orderId)}/label`
}

export type OrderQueueFilter = typeof ALL_FILTER | OrderQueue

export const ORDER_QUEUE_FILTER_ORDER = [
  ALL_FILTER,
  "unpaid",
  "toShip",
  "shipped",
  "completed",
  "returns",
] as const satisfies readonly OrderQueueFilter[]

export function isOrderQueueFilter(value: unknown): value is OrderQueueFilter {
  return (
    value === ALL_FILTER ||
    (typeof value === "string" && Object.hasOwn(ORDER_QUEUES, value))
  )
}

export function orderQueueFilterLabel(filter: OrderQueueFilter) {
  return filter === ALL_FILTER ? "Semua" : ORDER_QUEUES[filter].label
}

export const ORDER_TABS = {
  all: ALL_FILTER,
  unpaid: "unpaid",
  "to-ship": "toShip",
  shipped: "shipped",
  completed: "completed",
  returns: "returns",
} as const satisfies Record<string, OrderQueueFilter>

export type OrderTab = keyof typeof ORDER_TABS

function isOrderTab(value: string): value is OrderTab {
  return Object.hasOwn(ORDER_TABS, value)
}

export function orderTab(filter: OrderQueueFilter): OrderTab {
  switch (filter) {
    case ALL_FILTER:
      return "all"
    case "unpaid":
      return "unpaid"
    case "toShip":
      return "to-ship"
    case "shipped":
      return "shipped"
    case "completed":
      return "completed"
    case "returns":
      return "returns"
    default: {
      const _exhaustive: never = filter
      return _exhaustive
    }
  }
}

export function orderFilterFromTab(tab: string | null): OrderQueueFilter {
  return tab !== null && isOrderTab(tab) ? ORDER_TABS[tab] : ALL_FILTER
}

export function orderQueueCounts(
  orders: readonly SalesOrder[]
): Readonly<Record<OrderQueue, number>> {
  const counts = {
    unpaid: 0,
    toShip: 0,
    shipped: 0,
    completed: 0,
    returns: 0,
  } satisfies Record<OrderQueue, number>

  for (const entry of orders) {
    counts[salesOrderQueue(entry)] += 1
  }

  return counts
}

export type SalesOrderQuery = {
  readonly queue: OrderQueueFilter
  readonly search: string
}

function searchText({ buyer, order }: SalesOrder) {
  return [order.id, buyer, ...order.items.map((item) => item.name)]
    .join(" ")
    .toLocaleLowerCase("id-ID")
}

export function querySalesOrders(
  orders: readonly SalesOrder[],
  query: SalesOrderQuery
): readonly SalesOrder[] {
  const search = query.search.trim().toLocaleLowerCase("id-ID")

  return orders
    .filter(
      (entry) =>
        (query.queue === ALL_FILTER ||
          salesOrderQueue(entry) === query.queue) &&
        searchText(entry).includes(search)
    )
    .sort((a, b) => Date.parse(b.order.placedAt) - Date.parse(a.order.placedAt))
}
