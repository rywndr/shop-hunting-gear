import type { Metadata } from "next"

import { AdminPage } from "@/components/admin/admin-page"
import { LowStockList } from "@/components/admin/dashboard/low-stock-list"
import { RecentOrders } from "@/components/admin/dashboard/recent-orders"
import { SalesChart } from "@/components/admin/dashboard/sales-chart"
import { SalesSummary } from "@/components/admin/dashboard/sales-summary"
import { adminSection, LOW_STOCK_THRESHOLD } from "@/lib/admin/config"
import { MOCK_DAILY_SALES, MOCK_SALES_METRICS } from "@/lib/admin/mock"
import { recentOrders } from "@/lib/orders/config"
import { MOCK_ORDERS } from "@/lib/orders/mock"
import { lowStockProducts } from "@/lib/products/config"
import { adminProductListings } from "@/lib/products/service"

const SECTION = adminSection("dashboard")

const RECENT_ORDER_LIMIT = 5

export const metadata: Metadata = {
  title: SECTION.label,
  description: SECTION.description,
}

export default async function AdminDashboardPage() {
  const listings = await adminProductListings()
  const products = listings
    .filter(({ state }) => state !== "deleted")
    .map(({ product }) => product)

  return (
    <AdminPage title={SECTION.label} description={SECTION.description}>
      <SalesSummary metrics={MOCK_SALES_METRICS} />
      <SalesChart series={MOCK_DAILY_SALES} />
      <RecentOrders orders={recentOrders(MOCK_ORDERS, RECENT_ORDER_LIMIT)} />
      <LowStockList
        products={lowStockProducts(products, LOW_STOCK_THRESHOLD)}
        threshold={LOW_STOCK_THRESHOLD}
      />
    </AdminPage>
  )
}
