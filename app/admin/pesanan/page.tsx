import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminPage } from "@/components/admin/admin-page"
import { SalesOrderTable } from "@/components/admin/pesanan/sales-order-table"
import { adminSection } from "@/lib/admin/config"
import { MOCK_SALES_ORDERS } from "@/lib/admin/mock"

const SECTION = adminSection("orders")

export const metadata: Metadata = {
  title: SECTION.label,
  description: SECTION.description,
}

export default async function AdminOrdersPage(
  props: PageProps<"/admin/pesanan">
) {
  const { tab } = await props.searchParams

  if (tab === undefined) {
    redirect("/admin/pesanan?tab=all")
  }

  return (
    <AdminPage title={SECTION.label} description={SECTION.description}>
      <Suspense>
        <SalesOrderTable orders={MOCK_SALES_ORDERS} />
      </Suspense>
    </AdminPage>
  )
}
