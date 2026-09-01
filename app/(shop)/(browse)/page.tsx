import { HeroCarousel } from "@/components/layout/hero-carousel"
import { CategoryFilterList } from "@/components/products/category-filter-list"
import { ProductGrid } from "@/components/products/product-grid"
import { ProductPagination } from "@/components/products/product-pagination"
import { ProductSection } from "@/components/products/product-section"
import { productsInCategories, productsMatching } from "@/lib/products/config"
import { storefrontProducts } from "@/lib/products/service"
import { CATEGORY_QUERY, SEARCH_QUERY, findCategories } from "@/lib/site/config"

const PAGE_SIZE = 10

export const dynamic = "force-dynamic"

function positiveInteger(value: string | undefined) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
}

export default async function Page({ searchParams }: PageProps<"/">) {
  const savedProducts = await storefrontProducts()
  const query = await searchParams
  const categoryQuery = query[CATEGORY_QUERY]
  const categories = findCategories(
    typeof categoryQuery === "string" ? [categoryQuery] : (categoryQuery ?? [])
  )
  const search =
    typeof query[SEARCH_QUERY] === "string" ? query[SEARCH_QUERY].trim() : ""
  const categorySlugs = categories.map((category) => category.slug)
  const categoryProducts = productsInCategories(savedProducts, categorySlugs)
  const matchingProducts = productsMatching(categoryProducts, search)
  const pageCount = Math.max(1, Math.ceil(matchingProducts.length / PAGE_SIZE))
  const requestedPage = positiveInteger(
    typeof query.page === "string" ? query.page : undefined
  )
  const page = Math.min(requestedPage, pageCount)
  const products = matchingProducts.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )

  return (
    <>
      <HeroCarousel />

      <ProductSection
        id="produk"
        title={
          categories.length > 0
            ? categories.map((category) => category.label).join(" & ")
            : "Semua Produk"
        }
        description={
          search
            ? `Hasil pencarian untuk "${search}".`
            : categories.length > 0
              ? "Produk dari kategori yang dipilih."
              : "Seluruh katalog dari empat kategori dalam satu daftar."
        }
        action={
          categories.length > 0 ? (
            <CategoryFilterList
              key={categorySlugs.join(",")}
              categories={categories}
              search={search}
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
    </>
  )
}
