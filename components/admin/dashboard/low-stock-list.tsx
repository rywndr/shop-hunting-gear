import Link from "next/link"

import { AdminCard, AdminCardLink } from "@/components/admin/admin-card"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { adminSection } from "@/lib/admin/config"
import { productHref, type Product } from "@/lib/products/config"
import { categoryBySlug } from "@/lib/site/config"
import { formatNumber } from "@/utils/format/intl"

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return <Badge variant="destructive">Stok habis</Badge>
  }

  return (
    <Badge variant="secondary" className="tabular-nums">
      {formatNumber(stock)} tersisa
    </Badge>
  )
}

const SKELETON_ROWS = [0, 1, 2]

function LowStockListSkeleton({ threshold }: { threshold: number }) {
  return (
    <AdminCard
      title="Stok Menipis"
      description={`Produk dengan stok ${formatNumber(threshold)} unit atau kurang.`}
    >
      <div className="flex flex-col gap-3">
        {SKELETON_ROWS.map((row) => (
          <div key={row} className="flex items-center gap-3">
            <Skeleton className="size-11 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </AdminCard>
  )
}

function LowStockList({
  products,
  threshold,
}: {
  products: readonly Product[]
  threshold: number
}) {
  const productsSection = adminSection("products")

  return (
    <AdminCard
      title="Stok Menipis"
      description={`Produk dengan stok ${formatNumber(threshold)} unit atau kurang.`}
      action={
        <AdminCardLink href={productsSection.href}>Kelola Stok</AdminCardLink>
      }
    >
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Semua produk masih punya stok yang cukup.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {products.map((product) => (
            <li key={product.slug} className="flex items-center gap-3">
              <ProductThumbnail
                className="size-11 shrink-0"
                iconClassName="size-5"
              />

              <div className="min-w-0 flex-1">
                <Link
                  href={productHref(product)}
                  className="line-clamp-2 text-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  {product.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {categoryBySlug(product.category).label}
                </p>
              </div>

              <StockBadge stock={product.stock} />
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  )
}

export { LowStockList, LowStockListSkeleton }
