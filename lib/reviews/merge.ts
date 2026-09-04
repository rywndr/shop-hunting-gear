import type { Review } from "@/lib/products/config"

export function mergeReviews(
  legacy: readonly Review[],
  relational: readonly Review[]
) {
  return [...legacy, ...relational].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  )
}
