import { ChatCircleTextIcon, StarIcon } from "@phosphor-icons/react/ssr"

import { FLAT_CARD } from "@/components/account/account-card"
import { ProductSection } from "@/components/products/product-section"
import { RatingStars } from "@/components/products/rating-stars"
import { ReviewMediaGallery } from "@/components/products/review-media-gallery"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  MAX_RATING,
  RATING_STARS,
  averageRating,
  ratingShare,
  reviewCount,
  type Product,
  type Review,
} from "@/lib/products/config"
import {
  formatNumber,
  formatRating,
  formatShortDate,
} from "@/utils/format/intl"
import { cn } from "@/lib/utils"

const REVIEWS_ANCHOR = "ulasan"

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
}

function RatingSummary({ product }: { product: Product }) {
  const rating = averageRating(product)
  const reviews = reviewCount(product)

  return (
    <Card size="sm" className={FLAT_CARD}>
      <CardContent className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
        <div className="flex flex-col items-center gap-1">
          <p className="font-heading text-4xl font-bold tracking-tight tabular-nums">
            {formatRating(rating)}
          </p>
          <RatingStars value={rating} size="md" />
          <p className="text-xs text-muted-foreground">
            {formatNumber(reviews)} ulasan dari pembeli
          </p>
        </div>

        <ul className="flex flex-col gap-1.5">
          {RATING_STARS.map((star) => (
            <li key={star} className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs tabular-nums">
                {star}
                <StarIcon
                  weight="fill"
                  className="size-3 text-chart-2"
                  aria-hidden
                />
                <span className="sr-only">bintang</span>
              </span>

              <span aria-hidden className="h-1.5 flex-1 bg-muted">
                <span
                  style={{ width: `${ratingShare(product, star)}%` }}
                  className="block h-full bg-chart-2"
                />
              </span>

              <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                {formatNumber(product.ratings[star])}
                <span className="sr-only"> ulasan</span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function ReviewRow({ review }: { review: Review }) {
  return (
    <li className="flex gap-3 py-4">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center bg-muted text-xs font-medium text-muted-foreground"
      >
        {initials(review.author)}
      </span>

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <RatingStars value={review.rating} />
          <span className="text-sm font-medium">{review.author}</span>
          <span className="text-xs text-muted-foreground">
            {formatShortDate(review.createdAt)}
          </span>
        </div>

        {review.variant && (
          <p className="text-xs text-muted-foreground">
            Varian: {review.variant}
          </p>
        )}

        <p className="text-sm/relaxed text-pretty">{review.body}</p>

        {review.media && review.media.length > 0 && (
          <ReviewMediaGallery media={review.media} author={review.author} />
        )}
      </div>
    </li>
  )
}

function ReviewSection({
  product,
  className,
}: {
  product: Product
  className?: string
}) {
  const reviews = reviewCount(product)

  return (
    <ProductSection
      id={REVIEWS_ANCHOR}
      title="Ulasan Pembeli"
      description={
        reviews === 0
          ? undefined
          : `Rata-rata ${formatRating(averageRating(product))} dari ${MAX_RATING} bintang.`
      }
      className={className}
    >
      {reviews === 0 ? (
        <Empty className={cn(FLAT_CARD, "border-dashed py-10")}>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ChatCircleTextIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Belum ada ulasan</EmptyTitle>
            <EmptyDescription>
              Jadilah yang pertama memberi ulasan setelah pesanan Anda diterima.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <RatingSummary product={product} />

          {product.reviews.length > 0 && (
            <ul className="flex flex-col divide-y divide-border">
              {product.reviews.map((review) => (
                <ReviewRow key={review.id} review={review} />
              ))}
            </ul>
          )}
        </>
      )}
    </ProductSection>
  )
}

export { ReviewSection, REVIEWS_ANCHOR }
