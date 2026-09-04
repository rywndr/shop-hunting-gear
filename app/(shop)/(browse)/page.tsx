import { cache, Suspense } from "react"
import type { Metadata } from "next"
import { permanentRedirect, redirect } from "next/navigation"

import { HeroCarousel } from "@/components/layout/hero-carousel"
import { CategoryFilterList } from "@/components/products/category-filter-list"
import {
  ProductGrid,
  ProductGridSkeleton,
} from "@/components/products/product-grid"
import { ProductPagination } from "@/components/products/product-pagination"
import { ProductSection } from "@/components/products/product-section"
import {
  productsInCategories,
  productsMatching,
  type Product,
} from "@/lib/products/config"
import {
  storefrontProductCards,
  storefrontProductData,
} from "@/lib/products/service"
import {
  browsePageCount,
  normalizeBrowseQuery,
  resolveBrowseRequest,
  type BrowseQuery,
  type BrowseSelection,
} from "@/lib/site/browse"
import { SITE, findCategories, type CategorySlug } from "@/lib/site/config"
import { pageMetadata } from "@/lib/site/metadata"

const PAGE_SIZE = 10

export const dynamic = "force-dynamic"

type SelectedCategory = ReturnType<typeof findCategories>[number]

type BrowseFilter =
  | {
      readonly kind: "search"
      readonly search: string
      readonly categories: readonly SelectedCategory[]
    }
  | {
      readonly kind: "category"
      readonly categories: readonly SelectedCategory[]
    }
  | { readonly kind: "all" }

const browseProducts = cache(storefrontProductData)

function browseFilter(selection: BrowseSelection): BrowseFilter {
  const categories = findCategories(selection.categories)

  if (selection.search) {
    return { kind: "search", search: selection.search, categories }
  }

  if (categories.length > 0) {
    return { kind: "category", categories }
  }

  return { kind: "all" }
}

function filterCategories(filter: BrowseFilter): readonly SelectedCategory[] {
  switch (filter.kind) {
    case "search":
    case "category":
      return filter.categories
    case "all":
      return []
    default: {
      const _exhaustive: never = filter
      return _exhaustive
    }
  }
}

function categorySlugs(
  categories: readonly SelectedCategory[]
): readonly CategorySlug[] {
  return categories.map((category) => category.slug)
}

function categoryLabels(categories: readonly SelectedCategory[]) {
  return categories.map((category) => category.label).join(" & ")
}

function filteredProducts(
  products: readonly Product[],
  selection: BrowseSelection
): readonly Product[] {
  const inCategories = productsInCategories(products, selection.categories)

  return selection.search
    ? productsMatching(inCategories, selection.search)
    : inCategories
}

function sectionCopy(filter: BrowseFilter): {
  readonly title: string
  readonly description: string
} {
  switch (filter.kind) {
    case "search":
      return {
        title: categoryLabels(filter.categories) || "Semua Produk",
        description: `Hasil pencarian untuk "${filter.search}".`,
      }
    case "category":
      return {
        title: categoryLabels(filter.categories),
        description: "Produk dari category yang dipilih.",
      }
    case "all":
      return {
        title: "Semua Produk",
        description: "Seluruh katalog dari empat category dalam satu daftar.",
      }
    default: {
      const _exhaustive: never = filter
      return _exhaustive
    }
  }
}

async function resolveBrowsePage(query: BrowseQuery) {
  const products = filteredProducts(
    await browseProducts(),
    normalizeBrowseQuery(query)
  )
  const resolution = resolveBrowseRequest({
    query,
    pageCount: browsePageCount(products.length, PAGE_SIZE),
  })

  return { ...resolution, products }
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/">): Promise<Metadata> {
  const { selection, canonical, index } = await resolveBrowsePage(
    await searchParams
  )
  const filter = browseFilter(selection)
  const suffix = selection.page > 1 ? ` · Halaman ${selection.page}` : ""

  switch (filter.kind) {
    case "search":
      return pageMetadata({
        title: `Pencarian "${filter.search}"${suffix}`,
        description: `Hasil pencarian "${filter.search}" di katalog ${SITE.alternateName}.`,
        path: canonical,
        index,
      })
    case "category": {
      const labels = categoryLabels(filter.categories)

      return pageMetadata({
        title: `Produk ${labels}${suffix}`,
        description: `Belanja perlengkapan ${labels} di ${SITE.alternateName}. Stok siap kirim ke seluruh Indonesia.`,
        path: canonical,
        index,
      })
    }
    case "all":
      return pageMetadata({
        title: `${SITE.tagline}${suffix}`,
        description: SITE.description,
        path: canonical,
        index,
      })
    default: {
      const _exhaustive: never = filter
      return _exhaustive
    }
  }
}

async function BrowseCatalog({
  searchParams,
}: {
  readonly searchParams: Promise<BrowseQuery>
}) {
  const resolution = await resolveBrowsePage(await searchParams)

  switch (resolution.redirectType) {
    case "permanent":
      permanentRedirect(resolution.redirectTo)
    case "temporary":
      redirect(resolution.redirectTo)
    case null:
      break
    default: {
      const _exhaustive: never = resolution
      return _exhaustive
    }
  }

  const { selection, products: matchingProducts } = resolution
  const page = selection.page
  const visibleProductData = matchingProducts.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )
  const products = await storefrontProductCards(visibleProductData)
  const filter = browseFilter(selection)
  const copy = sectionCopy(filter)
  const selectedCategories = filterCategories(filter)

  return (
    <ProductSection
      id="products"
      title={copy.title}
      description={copy.description}
      action={
        selectedCategories.length > 0 ? (
          <CategoryFilterList
            key={categorySlugs(selectedCategories).join(",")}
            categories={selectedCategories}
            search={filter.kind === "search" ? filter.search : ""}
          />
        ) : undefined
      }
      className="mx-auto w-full max-w-7xl px-4 py-8 md:py-12"
    >
      <div className="flex flex-col gap-6">
        <ProductGrid
          products={products}
          emptyMessage="Tidak ada produk yang cocok dengan filter ini."
        />
        {matchingProducts.length > PAGE_SIZE && (
          <ProductPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={matchingProducts.length}
          />
        )}
      </div>
    </ProductSection>
  )
}

function BrowseCatalogSkeleton() {
  return (
    <ProductSection
      id="products"
      title="Memuat produk"
      description="Katalog sedang dimuat."
      className="mx-auto w-full max-w-7xl px-4 py-8 md:py-12"
    >
      <div className="flex flex-col gap-6">
        <ProductGridSkeleton />
      </div>
    </ProductSection>
  )
}

export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <>
      <HeroCarousel />

      <Suspense fallback={<BrowseCatalogSkeleton />}>
        <BrowseCatalog searchParams={searchParams} />
      </Suspense>
    </>
  )
}
