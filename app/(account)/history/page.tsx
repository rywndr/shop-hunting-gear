import type { Metadata } from "next"

import { AccountShell } from "@/components/account/account-shell"
import { SectionTabs, type SectionTab } from "@/components/account/section-tabs"
import { OrderList } from "@/components/orders/order-list"
import { getCurrentSession } from "@/lib/auth/session"
import {
  ORDER_STATUSES,
  ORDER_STATUS_ORDER,
  type OrderStatus,
} from "@/lib/orders/config"
import { ordersForUserPage } from "@/lib/orders/service"
import { midtransBrowserConfig } from "@/lib/payments/midtrans/config"

const PAGE_SIZE = 6

type HistoryTab = "semua" | OrderStatus

export const metadata: Metadata = {
  title: "History",
  description: "Riwayat pesanan Anda.",
}

function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUS_ORDER.some((status) => status === value)
}

function historyTab(value: string | undefined): HistoryTab {
  return value === "semua" || (value !== undefined && isOrderStatus(value))
    ? value
    : "semua"
}

function positiveInteger(value: string | undefined) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
}

function buildTabs({
  activeTab,
  counts,
  midtrans,
  orders,
  page,
  total,
}: {
  readonly activeTab: HistoryTab
  readonly counts: Readonly<Record<OrderStatus, number>>
  readonly midtrans: ReturnType<typeof midtransBrowserConfig>
  readonly orders: Awaited<ReturnType<typeof ordersForUserPage>>["orders"]
  readonly page: number
  readonly total: number
}): readonly SectionTab[] {
  const panel = (tab: HistoryTab, emptyMessage: string, tabTotal: number) =>
    activeTab === tab ? (
      <OrderList
        orders={orders}
        emptyMessage={emptyMessage}
        midtrans={midtrans}
        page={page}
        pageSize={PAGE_SIZE}
        total={tabTotal}
      />
    ) : null

  return [
    {
      value: "semua",
      label: "Semua",
      count: total,
      panel: panel(
        "semua",
        "Pesanan yang Anda buat akan muncul di sini.",
        total
      ),
    },
    ...ORDER_STATUS_ORDER.map((status) => ({
      value: status,
      label: ORDER_STATUSES[status].label,
      count: counts[status],
      panel: panel(
        status,
        `Tidak ada pesanan berstatus ${ORDER_STATUSES[status].label.toLowerCase()}.`,
        counts[status]
      ),
    })),
  ]
}

export default async function HistoryPage(props: PageProps<"/history">) {
  const session = await getCurrentSession()

  if (!session) return null

  const params = await props.searchParams
  const activeTab = historyTab(
    typeof params.status === "string" ? params.status : undefined
  )
  const page = positiveInteger(
    typeof params.page === "string" ? params.page : undefined
  )
  const status = activeTab === "semua" ? null : activeTab
  const orderPage = await ordersForUserPage({
    userId: session.user.id,
    status,
    page,
    pageSize: PAGE_SIZE,
  })

  return (
    <AccountShell
      title="Riwayat Pesanan"
      description="Lacak status pembayaran dan pengiriman pesanan Anda."
    >
      <SectionTabs
        label="Status pesanan"
        activeValue={activeTab}
        queryParam="status"
        tabs={buildTabs({
          activeTab,
          counts: orderPage.counts,
          midtrans: midtransBrowserConfig(),
          orders: orderPage.orders,
          page,
          total: orderPage.total,
        })}
      />
    </AccountShell>
  )
}
