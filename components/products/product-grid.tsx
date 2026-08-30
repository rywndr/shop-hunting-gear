import { PackageIcon } from "@phosphor-icons/react/ssr"

import { FLAT_CARD } from "@/components/account/account-card"
import { InfiniteScrollList } from "@/components/infinite-scroll-list"
import { ProductCard } from "@/components/products/product-card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { Product } from "@/lib/products/config"
import { cn } from "@/lib/utils"

type ProductGridProps = {
  products: readonly Product[]
  emptyMessage: string
  className?: string
}

const INITIAL_PRODUCT_COUNT = 10
const PRODUCTS_PER_LOAD = 10

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
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
        className
      )}
    >
      {products.map((product) => (
        <li key={product.slug}>
          <ProductCard product={product} />
        </li>
      ))}
    </InfiniteScrollList>
  )
}

export { ProductGrid }
