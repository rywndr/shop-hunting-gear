import { Suspense } from "react"
import type { Metadata } from "next"

import { AccountShell } from "@/components/account/account-shell"
import { SectionTabs, type SectionTab } from "@/components/account/section-tabs"
import { FLAT_CARD } from "@/components/account/account-card"
import { OrderList } from "@/components/orders/order-list"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentSession } from "@/lib/auth/session"
import {
  ORDER_STATUSES,
  ORDER_STATUS_ORDER,
  type OrderStatus,
} from "@/lib/orders/config"
import { ordersForUserPage } from "@/lib/orders/service"
import { midtransBrowserConfig } from "@/lib/payments/midtrans/config"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 6

type HistoryTab = "semua" | OrderStatus

export const metadata: Metadata = {
  title: "History",
  description: "Lacak pembayaran, pengiriman, dan riwayat pesanan Anda.",
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

function OrderCardSkeleton() {
  return (
    <Card
      aria-hidden
      size="sm"
      className={cn(FLAT_CARD, "gap-0 py-0")}
    >
      <CardHeader className="flex-row items-center gap-3 border-b py-3">
        <Skeleton className="h-3.5 w-28 rounded-none" />
        <Skeleton className="h-3.5 w-20 rounded-none" />
        <Skeleton className="ms-auto h-5 w-20 rounded-none" />
      </CardHeader>
      <CardContent className="py-4">
        <div className="flex gap-3">
          <Skeleton className="size-16 shrink-0 rounded-none sm:size-18" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/3 rounded-none" />
            <Skeleton className="h-3 w-24 rounded-none" />
            <Skeleton className="mt-auto h-3 w-32 rounded-none" />
          </div>
          <Skeleton className="h-3.5 w-24 rounded-none" />
        </div>
        <div className="mt-4 flex justify-between border-t pt-3">
          <Skeleton className="h-3 w-20 rounded-none" />
          <Skeleton className="h-3 w-36 rounded-none" />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between gap-3 border-t py-3">
        <Skeleton className="h-4 w-40 rounded-none" />
        <Skeleton className="h-10 w-28 rounded-none" />
      </CardFooter>
    </Card>
  )
}

function HistoryTabsSkeleton({ activeTab }: { activeTab: HistoryTab }) {
  const tabs: readonly SectionTab[] = [
    { value: "semua", label: "Semua" },
    ...ORDER_STATUS_ORDER.map((status) => ({
      value: status,
      label: ORDER_STATUSES[status].label,
    })),
  ].map((tab) => ({
    ...tab,
    count: <span className="block h-3 w-4 animate-pulse bg-muted" />,
    panel:
      tab.value === activeTab ? (
        <div
          className="flex flex-col gap-4"
          aria-label="Memuat riwayat pesanan"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <OrderCardSkeleton key={index} />
          ))}
        </div>
      ) : null,
  }))

  return (
    <SectionTabs
      label="Status pesanan"
      activeValue={activeTab}
      queryParam="status"
      tabs={tabs}
    />
  )
}

async function HistoryTabs({
  activeTab,
  page,
}: {
  activeTab: HistoryTab
  page: number
}) {
  const session = await getCurrentSession()

  if (!session) return null

  const status = activeTab === "semua" ? null : activeTab
  const orderPage = await ordersForUserPage({
    userId: session.user.id,
    status,
    page,
    pageSize: PAGE_SIZE,
  })

  return (
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
  )
}

export default async function HistoryPage(props: PageProps<"/history">) {
  const params = await props.searchParams
  const activeTab = historyTab(
    typeof params.status === "string" ? params.status : undefined
  )
  const page = positiveInteger(
    typeof params.page === "string" ? params.page : undefined
  )

  return (
    <AccountShell
      title="Riwayat Pesanan"
      description="Lacak status pembayaran dan pengiriman pesanan Anda."
    >
      <Suspense
        key={`${activeTab}:${page}`}
        fallback={<HistoryTabsSkeleton activeTab={activeTab} />}
      >
        <HistoryTabs activeTab={activeTab} page={page} />
      </Suspense>
    </AccountShell>
  )
}
