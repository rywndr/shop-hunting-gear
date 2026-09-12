import { cache, Suspense } from "react"
import type { Metadata } from "next"
import { permanentRedirect, redirect } from "next/navigation"

import { HeroCarousel } from "@/components/layout/hero-carousel"
import {
  BrowseControls,
  type CategoryCount,
} from "@/components/products/browse-controls"
import {
  ProductGrid,
  ProductGridSkeleton,
} from "@/components/products/product-grid"
import { ProductPagination } from "@/components/products/product-pagination"
import {
  productsInCategories,
  productsMatching,
  sortProducts,
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
import { CATEGORIES, SITE, findCategories } from "@/lib/site/config"
import { pageMetadata } from "@/lib/site/metadata"

const PAGE_SIZE = 12

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

function categoryLabels(categories: readonly SelectedCategory[]) {
  return categories.map((category) => category.label).join(" & ")
}

function filteredProducts(
  products: readonly Product[],
  selection: BrowseSelection
): readonly Product[] {
  const inCategories = productsInCategories(products, selection.categories)
  const matching = selection.search
    ? productsMatching(inCategories, selection.search)
    : inCategories

  return sortProducts(matching, selection.sort)
}

function categoryCounts(
  products: readonly Product[]
): readonly CategoryCount[] {
  return CATEGORIES.map((category) => ({
    slug: category.slug,
    label: category.label,
    count: products.filter((product) => product.category === category.slug)
      .length,
  }))
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
        description: "Produk dari kategori yang dipilih.",
      }
    case "all":
      return {
        title: "Semua Produk",
        description: "Perlengkapan Hunting, Fishing, Spareparts, dan Hobbies.",
      }
    default: {
      const _exhaustive: never = filter
      return _exhaustive
    }
  }
}

async function resolveBrowsePage(query: BrowseQuery) {
  const allProducts = await browseProducts()
  const products = filteredProducts(allProducts, normalizeBrowseQuery(query))
  const resolution = resolveBrowseRequest({
    query,
    pageCount: browsePageCount(products.length, PAGE_SIZE),
  })

  return { ...resolution, allProducts, products }
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

  const { selection, products: matchingProducts, allProducts } = resolution
  const page = selection.page
  const visibleProductData = matchingProducts.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )
  const products = await storefrontProductCards(visibleProductData)
  const copy = sectionCopy(browseFilter(selection))

  return (
    <div
      id="catalog"
      className="mx-auto grid w-full max-w-7xl scroll-mt-20 gap-8 px-4 py-8 md:scroll-mt-[calc(3.75rem+var(--spacing-category-bar)+1rem)] md:grid-cols-[16rem_minmax(0,1fr)] md:py-12"
    >
      <BrowseControls
        categories={categoryCounts(allProducts)}
        selection={selection}
        total={matchingProducts.length}
      />

      <section
        id="products"
        aria-labelledby="products-heading"
        className="min-w-0 scroll-mt-20 md:scroll-mt-[calc(3.75rem+var(--spacing-category-bar)+1rem)]"
      >
        <div className="mb-6 border-b border-border pb-5">
          <h1
            id="products-heading"
            className="font-heading text-2xl font-semibold tracking-tight md:text-3xl"
          >
            {copy.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.description}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <ProductGrid
            products={products}
            emptyMessage="Tidak ada produk yang cocok dengan filter ini."
            className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
          />
          {matchingProducts.length > PAGE_SIZE && (
            <ProductPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={matchingProducts.length}
            />
          )}
        </div>
      </section>
    </div>
  )
}

function BrowseCatalogSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 md:grid-cols-[16rem_minmax(0,1fr)] md:py-12">
      <div aria-hidden className="hidden space-y-6 md:block">
        <div className="h-11 animate-pulse bg-muted" />
        <div className="h-12 animate-pulse border-b border-border bg-muted" />
        <div className="h-48 animate-pulse bg-muted" />
      </div>
      <section aria-labelledby="loading-products-heading" className="min-w-0">
        <div className="mb-6 border-b border-border pb-5">
          <h1
            id="loading-products-heading"
            className="font-heading text-2xl font-semibold"
          >
            Memuat produk
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Katalog sedang dimuat.
          </p>
        </div>
        <ProductGridSkeleton className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3" />
      </section>
    </div>
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
