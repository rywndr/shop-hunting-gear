import type { Metadata } from "next"

import { AccountShell } from "@/components/account/account-shell"
import { SectionTabs, type SectionTab } from "@/components/account/section-tabs"
import { OrderList } from "@/components/orders/order-list"
import {
  ORDER_STATUSES,
  ORDER_STATUS_ORDER,
  type Order,
  type OrderStatus,
} from "@/lib/orders/config"
import { MOCK_ORDERS } from "@/lib/orders/mock"

export const metadata: Metadata = {
  title: "History",
  description: "Riwayat pesanan Anda.",
}

function buildTabs(orders: readonly Order[]): readonly SectionTab[] {
  const forStatus = (status: OrderStatus) =>
    orders.filter((order) => order.status === status)

  return [
    {
      value: "semua",
      label: "Semua",
      count: orders.length,
      panel: (
        <OrderList
          orders={orders}
          emptyMessage="Pesanan yang Anda buat akan muncul di sini."
        />
      ),
    },
    ...ORDER_STATUS_ORDER.map((status) => ({
      value: status,
      label: ORDER_STATUSES[status].label,
      count: forStatus(status).length,
      panel: (
        <OrderList
          orders={forStatus(status)}
          emptyMessage={`Tidak ada pesanan berstatus ${ORDER_STATUSES[status].label.toLowerCase()}.`}
        />
      ),
    })),
  ]
}

export default function HistoryPage() {
  return (
    <AccountShell
      title="Riwayat Pesanan"
      description="Lacak status pembayaran dan pengiriman pesanan Anda."
    >
      <SectionTabs label="Status pesanan" tabs={buildTabs(MOCK_ORDERS)} />
    </AccountShell>
  )
}
