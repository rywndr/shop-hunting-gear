import Link from "next/link"
import { CaretRightIcon } from "@phosphor-icons/react/ssr"

import { ProductGallery } from "@/components/products/product-gallery"
import { ProductGrid } from "@/components/products/product-grid"
import { ProductPrice } from "@/components/products/product-price"
import { ProductPurchase } from "@/components/products/product-purchase"
import { ProductSection } from "@/components/products/product-section"
import { RatingStars } from "@/components/products/rating-stars"
import { Skeleton } from "@/components/ui/skeleton"
import {
  REVIEWS_ANCHOR,
  ReviewSection,
} from "@/components/products/review-section"
import {
  averageRating,
  reviewCount,
  type Product,
  type ProductCard as ProductCardData,
  type ProductDetail as ProductDetailData,
} from "@/lib/products/config"
import { categoryBySlug } from "@/lib/site/config"
import {
  formatCompactNumber,
  formatNumber,
  formatRating,
} from "@/utils/format/intl"

function Breadcrumb({ product }: { product: Product }) {
  const category = categoryBySlug(product.category)

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {[
          { label: "Beranda", href: "/" },
          { label: category.label, href: category.href },
        ].map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-1">
            <Link
              href={crumb.href}
              className="hover:text-foreground hover:underline hover:underline-offset-4"
            >
              {crumb.label}
            </Link>
            <CaretRightIcon className="size-3" aria-hidden />
          </li>
        ))}
        <li aria-current="page" className="truncate text-foreground">
          {product.name}
        </li>
      </ol>
    </nav>
  )
}

function ProductHeadline({ product }: { product: Product }) {
  const reviews = reviewCount(product)
  const rating = averageRating(product)

  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-heading text-xl leading-tight font-bold tracking-tight sm:text-2xl">
        {product.name}
      </h1>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {reviews > 0 && (
          <span className="flex items-center gap-1.5">
            <RatingStars value={rating} size="md" />
            <span className="font-medium text-foreground tabular-nums">
              {formatRating(rating)}
            </span>
            <a
              href={`#${REVIEWS_ANCHOR}`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {formatNumber(reviews)} ulasan
            </a>
          </span>
        )}

        <span className="tabular-nums">
          {formatCompactNumber(product.sold)} terjual
        </span>
      </div>
    </div>
  )
}

type ProductDetailProps = {
  product: ProductDetailData
  related: readonly ProductCardData[]
}

function ProductDetailSkeleton() {
  return (
    <div
      aria-busy="true"
      className="mx-auto w-full max-w-7xl px-4 py-6 md:pb-12"
    >
      <Skeleton className="h-3 w-40 rounded-none" />

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-10">
        <Skeleton className="aspect-square w-full rounded-none" />

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-3/4 rounded-none" />
            <Skeleton className="h-4 w-1/2 rounded-none" />
          </div>
          <Skeleton className="h-10 w-44 rounded-none" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full rounded-none" />
            <Skeleton className="h-10 w-full rounded-none" />
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-10 md:mt-12 md:gap-12">
        <div className="flex max-w-3xl flex-col gap-3">
          <Skeleton className="h-6 w-48 rounded-none" />
          <Skeleton className="h-4 w-full rounded-none" />
          <Skeleton className="h-4 w-5/6 rounded-none" />
          <Skeleton className="h-4 w-2/3 rounded-none" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40 rounded-none" />
          <Skeleton className="h-24 w-full max-w-3xl rounded-none" />
        </div>
      </div>
    </div>
  )
}

function ProductDetail({ product, related }: ProductDetailProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:pb-12">
      <Breadcrumb product={product} />

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-10">
        <ProductGallery images={product.images} name={product.name} />

        <div className="flex flex-col gap-5">
          <ProductHeadline product={product} />
          <ProductPrice product={product} size="lg" />
          <ProductPurchase product={product} />
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-10 md:mt-12 md:gap-12">
        <ProductSection id="deskripsi" title="Deskripsi Produk">
          <div className="flex max-w-3xl flex-col gap-3 text-sm/relaxed text-pretty">
            {product.description.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </ProductSection>

        <ReviewSection product={product} />

        {related.length > 0 && (
          <ProductSection
            id="produk-terkait"
            title="Produk Terkait"
            description="Perlengkapan lain dari kategori yang sama."
          >
            <ProductGrid
              products={related}
              emptyMessage="Produk lain akan segera tersedia."
            />
          </ProductSection>
        )}
      </div>
    </div>
  )
}

export { ProductDetail, ProductDetailSkeleton }
