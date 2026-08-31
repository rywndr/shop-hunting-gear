import Link from "next/link"

import { ProductPrice } from "@/components/products/product-price"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { RatingStars } from "@/components/products/rating-stars"
import {
  averageRating,
  productHref,
  reviewCount,
  type Product,
} from "@/lib/products/config"
import { formatCompactNumber, formatRating } from "@/utils/format/intl"

function ProductCard({ product }: { product: Product }) {
  const reviews = reviewCount(product)
  const rating = averageRating(product)

  return (
    <Link
      href={productHref(product)}
      className="group flex h-full flex-col border border-border bg-card transition-colors outline-none hover:border-primary/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <ProductThumbnail
        src={product.images[0].url}
        label={product.images[0].alt}
        className="aspect-square w-full"
        iconClassName="size-8"
      />

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm/5 group-hover:underline group-hover:underline-offset-2">
          {product.name}
        </h3>

        <ProductPrice product={product} className="min-h-12 justify-end" />

        <p className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-1 text-xs text-muted-foreground">
          {reviews > 0 && (
            <>
              <RatingStars value={rating} />
              <span className="tabular-nums">{formatRating(rating)}</span>
              <span aria-hidden>&middot;</span>
            </>
          )}
          <span className="tabular-nums">
            {formatCompactNumber(product.sold)} terjual
          </span>
        </p>
      </div>
    </Link>
  )
}

export { ProductCard }
