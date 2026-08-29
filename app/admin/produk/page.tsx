import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminPage } from "@/components/admin/admin-page"
import { CatalogActions } from "@/components/admin/produk/catalog-actions"
import { ListingTable } from "@/components/admin/produk/listing-table"
import { listingForTable } from "@/lib/admin/catalog"
import { adminSection } from "@/lib/admin/config"
import { MOCK_LISTINGS } from "@/lib/admin/mock"

const SECTION = adminSection("products")

export const metadata: Metadata = {
  title: SECTION.label,
  description: SECTION.description,
}

export default async function AdminProductsPage(
  props: PageProps<"/admin/produk">
) {
  const { tab } = await props.searchParams

  if (tab === undefined) {
    redirect("/admin/produk?tab=all")
  }

  return (
    <AdminPage
      title={SECTION.label}
      description={SECTION.description}
      action={<CatalogActions />}
    >
      <Suspense>
        <ListingTable
          listings={MOCK_LISTINGS.map(listingForTable)}
          now={new Date().toISOString()}
        />
      </Suspense>
    </AdminPage>
  )
}
