import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminPage } from "@/components/admin/admin-page"
import { ManualOrderWizard } from "@/components/admin/pesanan/manual-order-wizard"
import { SalesOrderTable } from "@/components/admin/pesanan/sales-order-table"
import { SalesOrderTableSkeleton } from "@/components/admin/pesanan/sales-order-table-skeleton"
import { adminSection } from "@/lib/admin/config"
import { salesOrderBuyers, salesOrderPage } from "@/lib/orders/service"
import { storefrontProducts } from "@/lib/products/service"
import { orderFilterFromTab, type OrderQueueFilter } from "@/lib/admin/orders"

const SECTION = adminSection("orders")
type AdminPageSize = 10 | 25 | 50

export const metadata: Metadata = {
  title: SECTION.label,
  description: SECTION.description,
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function isPageSize(value: number): value is AdminPageSize {
  return value === 10 || value === 25 || value === 50
}

function pageSize(value: string | undefined) {
  const parsed = positiveInteger(value, 10)
  return isPageSize(parsed) ? parsed : 10
}

async function ManualOrderAction() {
  const [products, buyers] = await Promise.all([
    storefrontProducts(),
    salesOrderBuyers(),
  ])

  return <ManualOrderWizard buyers={buyers} products={products} />
}

async function OrderTable({
  queue,
  search,
  currentPage,
  currentPageSize,
}: {
  readonly queue: OrderQueueFilter
  readonly search: string
  readonly currentPage: number
  readonly currentPageSize: AdminPageSize
}) {
  const orderPage = await salesOrderPage({
    queue,
    search,
    page: currentPage,
    pageSize: currentPageSize,
  })

  return (
    <SalesOrderTable
      orders={orderPage.orders}
      counts={orderPage.counts}
      total={orderPage.total}
      page={currentPage}
      pageSize={currentPageSize}
      queue={queue}
      search={search}
    />
  )
}

export default async function AdminOrdersPage(
  props: PageProps<"/admin/pesanan">
) {
  const params = await props.searchParams
  const tab = typeof params.tab === "string" ? params.tab : undefined
  const search = typeof params.q === "string" ? params.q : ""
  const queue: OrderQueueFilter = orderFilterFromTab(tab ?? null)
  const currentPage = positiveInteger(
    typeof params.page === "string" ? params.page : undefined,
    1
  )
  const currentPageSize = pageSize(
    typeof params.size === "string" ? params.size : undefined
  )

  if (tab === undefined) {
    redirect("/admin/pesanan?tab=all")
  }

  return (
    <AdminPage
      title={SECTION.label}
      description={SECTION.description}
      action={
        <Suspense>
          <ManualOrderAction />
        </Suspense>
      }
    >
      <Suspense fallback={<SalesOrderTableSkeleton />}>
        <OrderTable
          queue={queue}
          search={search}
          currentPage={currentPage}
          currentPageSize={currentPageSize}
        />
      </Suspense>
    </AdminPage>
  )
}
