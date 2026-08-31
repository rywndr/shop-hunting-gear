import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminPage } from "@/components/admin/admin-page"
import { ManualOrderWizard } from "@/components/admin/pesanan/manual-order-wizard"
import { SalesOrderTable } from "@/components/admin/pesanan/sales-order-table"
import { adminSection } from "@/lib/admin/config"
import { MOCK_SALES_ORDERS } from "@/lib/admin/mock"
import { storefrontProducts } from "@/lib/products/service"

const SECTION = adminSection("orders")

export const metadata: Metadata = {
  title: SECTION.label,
  description: SECTION.description,
}

export default async function AdminOrdersPage(
  props: PageProps<"/admin/pesanan">
) {
  const { tab } = await props.searchParams
  const products = await storefrontProducts()

  if (tab === undefined) {
    redirect("/admin/pesanan?tab=all")
  }

  return (
    <AdminPage
      title={SECTION.label}
      description={SECTION.description}
      action={
        <ManualOrderWizard
          buyers={[...new Set(MOCK_SALES_ORDERS.map(({ buyer }) => buyer))]}
          products={products}
        />
      }
    >
      <Suspense>
        <SalesOrderTable orders={MOCK_SALES_ORDERS} />
      </Suspense>
    </AdminPage>
  )
}
