import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  ProductDetail,
  ProductDetailSkeleton,
} from "@/components/products/product-detail"
import {
  averageRating,
  productDiscount,
  productHref,
  relatedProducts,
  reviewCount,
} from "@/lib/products/config"
import {
  storefrontProductBySlug,
  storefrontProducts,
} from "@/lib/products/service"
import { categoryBySlug, isCategorySlug } from "@/lib/site/config"
import { pageMetadata, PRIVATE_ROBOTS } from "@/lib/site/metadata"
import { formatRating, formatRupiah } from "@/utils/format/intl"

export const revalidate = 21600

export async function generateStaticParams() {
  const products = await storefrontProducts()
  return products.map(({ category, slug }) => ({ category, slug }))
}

export async function generateMetadata({
  params,
}: PageProps<"/c/[category]/p/[slug]">): Promise<Metadata> {
  const { category, slug } = await params
  const product = await storefrontProductBySlug(slug)

  if (!product || product.category !== category) {
    return { title: "Produk tidak ditemukan", robots: PRIVATE_ROBOTS }
  }

  const categoryLabel = isCategorySlug(category)
    ? categoryBySlug(category).label
    : category
  const reviews = reviewCount(product)
  const discount = productDiscount(product)
  const summary = [
    formatRupiah(product.price),
    ...(discount ? [`hemat ${discount.percent}%`] : []),
    ...(reviews > 0
      ? [
          `rating ${formatRating(averageRating(product))} dari ${reviews} ulasan`,
        ]
      : []),
    product.stock > 0 ? "stok tersedia" : "stok habis",
  ].join(" · ")

  return pageMetadata({
    title: `${product.name} — ${categoryLabel}`,
    description: `${product.description[0]} ${summary}.`,
    path: productHref(product),
    images: product.images.flatMap((image) => {
      const url = image.detailUrl ?? image.url ?? image.thumbnailUrl
      return url === undefined ? [] : [{ url, alt: image.alt }]
    }),
  })
}

async function ProductContent({
  category,
  slug,
}: {
  readonly category: string
  readonly slug: string
}) {
  const [product, products] = await Promise.all([
    storefrontProductBySlug(slug),
    storefrontProducts(),
  ])

  if (!product || product.category !== category) {
    notFound()
  }

  return (
    <ProductDetail
      product={product}
      related={relatedProducts(products, product)}
    />
  )
}

export default async function CategoryProductPage({
  params,
}: PageProps<"/c/[category]/p/[slug]">) {
  const { category, slug } = await params

  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductContent category={category} slug={slug} />
    </Suspense>
  )
}
