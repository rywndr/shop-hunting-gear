import type { CategorySlug } from "@/lib/site/config"

export const MAX_RATING = 5

export const RATING_STARS = [5, 4, 3, 2, 1] as const

export type RatingStar = (typeof RATING_STARS)[number]
export type RatingBreakdown = Readonly<Record<RatingStar, number>>
type NonEmptyReadonlyArray<T> = readonly [T, ...T[]]

export type ProductImage = {
  readonly id: string
  readonly alt: string
}

export type ProductVariant = {
  readonly label: string
  readonly options: NonEmptyReadonlyArray<string>
}

export type Review = {
  readonly id: string
  readonly author: string
  readonly rating: RatingStar
  readonly createdAt: string
  readonly variant: string | null
  readonly body: string
}

export type Product = {
  readonly slug: string
  readonly name: string
  readonly category: CategorySlug
  readonly price: number
  readonly compareAtPrice: number | null
  readonly stock: number
  readonly sold: number
  readonly description: NonEmptyReadonlyArray<string>
  readonly images: NonEmptyReadonlyArray<ProductImage>
  readonly variants: readonly ProductVariant[]
  readonly ratings: RatingBreakdown
  readonly reviews: readonly Review[]
}

export function productHref(product: Pick<Product, "category" | "slug">) {
  return `/c/${product.category}/p/${product.slug}`
}

export function reviewCount(product: Product) {
  return RATING_STARS.reduce((total, star) => total + product.ratings[star], 0)
}

export function averageRating(product: Product) {
  const count = reviewCount(product)

  if (count === 0) {
    return 0
  }

  const weighted = RATING_STARS.reduce(
    (total, star) => total + star * product.ratings[star],
    0
  )

  return weighted / count
}

export function ratingShare(product: Product, star: RatingStar) {
  const count = reviewCount(product)

  return count === 0 ? 0 : (product.ratings[star] / count) * 100
}

export type ProductDiscount = {
  readonly compareAtPrice: number
  readonly percent: number
}

export function productDiscount(
  product: Pick<Product, "compareAtPrice" | "price">
): ProductDiscount | null {
  const { compareAtPrice, price } = product

  if (compareAtPrice === null || compareAtPrice <= price) {
    return null
  }

  return {
    compareAtPrice,
    percent: Math.round((1 - price / compareAtPrice) * 100),
  }
}

export function isInStock(product: Product) {
  return product.stock > 0
}

export function lowStockProducts(
  products: readonly Product[],
  threshold: number
) {
  return [...products]
    .filter((product) => product.stock <= threshold)
    .sort((a, b) => a.stock - b.stock)
}

export function findProduct(products: readonly Product[], slug: string) {
  return products.find((product) => product.slug === slug)
}

export function productsInCategory(
  products: readonly Product[],
  category: CategorySlug
) {
  return products.filter((product) => product.category === category)
}

export function productsInCategories(
  products: readonly Product[],
  categories: readonly CategorySlug[]
) {
  if (categories.length === 0) {
    return products
  }

  const selected = new Set(categories)
  return products.filter((product) => selected.has(product.category))
}

export function productsMatching(
  products: readonly Product[],
  search: string
) {
  const term = search.trim().toLocaleLowerCase("id-ID")

  if (!term) {
    return products
  }

  return products.filter((product) =>
    [product.name, ...product.description].some((value) =>
      value.toLocaleLowerCase("id-ID").includes(term)
    )
  )
}

export function relatedProducts(
  products: readonly Product[],
  product: Product,
  limit = 4
) {
  return productsInCategory(products, product.category)
    .filter((candidate) => candidate.slug !== product.slug)
    .slice(0, limit)
}
