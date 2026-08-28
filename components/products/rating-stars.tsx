import { StarIcon } from "@phosphor-icons/react/ssr"

import { MAX_RATING } from "@/lib/products/config"
import { formatRating } from "@/utils/format/intl"
import { cn } from "@/lib/utils"

const STAR_SIZES = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const

type RatingStarsProps = {
  value: number
  size?: keyof typeof STAR_SIZES
  className?: string
}

const STARS = Array.from({ length: MAX_RATING }, (_, index) => index)

function RatingStars({ value, size = "sm", className }: RatingStarsProps) {
  const clamped = Math.min(Math.max(value, 0), MAX_RATING)
  const starClassName = STAR_SIZES[size]

  return (
    <span
      role="img"
      aria-label={`${formatRating(clamped)} dari ${MAX_RATING} bintang`}
      className={cn("relative inline-flex shrink-0", className)}
    >
      <span className="flex gap-px text-muted-foreground/35">
        {STARS.map((star) => (
          <StarIcon key={star} weight="fill" className={starClassName} />
        ))}
      </span>

      <span
        aria-hidden
        style={{ width: `${(clamped / MAX_RATING) * 100}%` }}
        className="absolute inset-y-0 left-0 overflow-hidden"
      >
        <span className="flex w-max gap-px text-chart-2">
          {STARS.map((star) => (
            <StarIcon key={star} weight="fill" className={starClassName} />
          ))}
        </span>
      </span>
    </span>
  )
}

export { RatingStars }
