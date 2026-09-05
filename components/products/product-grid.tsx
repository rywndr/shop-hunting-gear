import { PackageIcon } from "@phosphor-icons/react/ssr"

import { FLAT_CARD } from "@/components/account/account-card"
import { InfiniteScrollList } from "@/components/infinite-scroll-list"
import {
  ProductCard,
  ProductCardSkeleton,
} from "@/components/products/product-card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { ProductCard as ProductCardData } from "@/lib/products/config"
import { cn } from "@/lib/utils"

type ProductGridProps = {
  products: readonly ProductCardData[]
  emptyMessage: string
  className?: string
}

const INITIAL_PRODUCT_COUNT = 10
const PRODUCTS_PER_LOAD = 10
const PRODUCT_GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"

function ProductGridSkeleton({ className }: { readonly className?: string }) {
  return (
    <ul
      aria-label="Memuat daftar produk"
      aria-busy="true"
      className={cn(PRODUCT_GRID_CLASS, className)}
    >
      {Array.from({ length: INITIAL_PRODUCT_COUNT }, (_, index) => (
        <li key={`product-skeleton-${index}`}>
          <ProductCardSkeleton />
        </li>
      ))}
    </ul>
  )
}

function ProductGrid({ products, emptyMessage, className }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <Empty className={cn(FLAT_CARD, "border-dashed py-12", className)}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Belum ada produk</EmptyTitle>
          <EmptyDescription>{emptyMessage}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <InfiniteScrollList
      aria-label="Daftar produk"
      initialItemCount={INITIAL_PRODUCT_COUNT}
      loadMoreItemCount={PRODUCTS_PER_LOAD}
      className={cn(PRODUCT_GRID_CLASS, className)}
    >
      {products.map((product) => (
        <li key={product.slug}>
          <ProductCard product={product} />
        </li>
      ))}
    </InfiniteScrollList>
  )
}

export { ProductGrid, ProductGridSkeleton }
