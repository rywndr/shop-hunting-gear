import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminPage } from "@/components/admin/admin-page"
import { CatalogActions } from "@/components/admin/produk/catalog-actions"
import { ListingTable } from "@/components/admin/produk/listing-table"
import { ListingTableSkeleton } from "@/components/admin/produk/listing-table-skeleton"
import {
  listingCategoryFromParam,
  listingFilterFromTab,
  listingForTable,
  listingSortFromKey,
  type ListingQuery,
} from "@/lib/admin/catalog"
import { adminSection } from "@/lib/admin/config"
import { adminListingPage } from "@/lib/products/service"

const SECTION = adminSection("products")
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

async function ProductListingTable({
  query,
  currentPage,
  currentPageSize,
}: {
  readonly query: ListingQuery
  readonly currentPage: number
  readonly currentPageSize: number
}) {
  const listingPage = await adminListingPage({
    ...query,
    page: currentPage,
    pageSize: currentPageSize,
  })

  return (
    <ListingTable
      listings={listingPage.listings.map(listingForTable)}
      counts={listingPage.counts}
      total={listingPage.total}
      page={currentPage}
      pageSize={currentPageSize}
      state={query.state}
      category={query.category}
      sort={query.sort}
      search={query.search}
      now={new Date().toISOString()}
    />
  )
}

export default async function AdminProductsPage(
  props: PageProps<"/admin/produk">
) {
  const params = await props.searchParams
  const tab = typeof params.tab === "string" ? params.tab : undefined
  const query: ListingQuery = {
    state: listingFilterFromTab(tab ?? null),
    category: listingCategoryFromParam(
      typeof params.category === "string" ? params.category : undefined
    ),
    search: typeof params.q === "string" ? params.q : "",
    sort: listingSortFromKey(
      typeof params.sort === "string" ? params.sort : undefined
    ),
  }
  const currentPage = positiveInteger(
    typeof params.page === "string" ? params.page : undefined,
    1
  )
  const currentPageSize = pageSize(
    typeof params.size === "string" ? params.size : undefined
  )

  if (tab === undefined) {
    redirect("/admin/produk?tab=active")
  }

  return (
    <AdminPage
      title={SECTION.label}
      description={SECTION.description}
      action={<CatalogActions />}
    >
      <Suspense fallback={<ListingTableSkeleton />}>
        <ProductListingTable
          query={query}
          currentPage={currentPage}
          currentPageSize={currentPageSize}
        />
      </Suspense>
    </AdminPage>
  )
}
