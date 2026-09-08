import { Suspense } from "react"
import type { Metadata } from "next"

import { AdminPage } from "@/components/admin/admin-page"
import { DashboardSkeleton } from "@/components/admin/dashboard/dashboard-skeleton"
import { LowStockList } from "@/components/admin/dashboard/low-stock-list"
import { RecentOrders } from "@/components/admin/dashboard/recent-orders"
import { SalesChart } from "@/components/admin/dashboard/sales-chart"
import { SalesSummary } from "@/components/admin/dashboard/sales-summary"
import {
  adminSection,
  dashboardSalesMetrics,
  DASHBOARD_RECENT_ORDER_LIMIT,
  DASHBOARD_SALES_HISTORY_DAYS,
  LOW_STOCK_THRESHOLD,
} from "@/lib/admin/config"
import { adminDailySales, recentAdminOrders } from "@/lib/orders/service"
import { adminLowStockProducts } from "@/lib/products/service"

const SECTION = adminSection("dashboard")

export const metadata: Metadata = {
  title: SECTION.label,
  description: SECTION.description,
}

async function DashboardContent() {
  const [sales, orders, lowStock] = await Promise.all([
    adminDailySales(DASHBOARD_SALES_HISTORY_DAYS),
    recentAdminOrders(DASHBOARD_RECENT_ORDER_LIMIT),
    adminLowStockProducts(LOW_STOCK_THRESHOLD),
  ])

  return (
    <>
      <SalesSummary metrics={dashboardSalesMetrics(sales)} />
      <SalesChart series={sales} />
      <RecentOrders orders={orders} />
      <LowStockList products={lowStock} threshold={LOW_STOCK_THRESHOLD} />
    </>
  )
}

export default function AdminDashboardPage() {
  return (
    <AdminPage title={SECTION.label} description={SECTION.description}>
      <Suspense
        fallback={<DashboardSkeleton lowStockThreshold={LOW_STOCK_THRESHOLD} />}
      >
        <DashboardContent />
      </Suspense>
    </AdminPage>
  )
}
