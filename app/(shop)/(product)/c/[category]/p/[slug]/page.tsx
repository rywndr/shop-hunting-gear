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
  storefrontProductCards,
  storefrontProductData,
  storefrontProductDetailBySlug,
  storefrontProductMetadataBySlug,
} from "@/lib/products/service"
import { categoryBySlug, isCategorySlug } from "@/lib/site/config"
import { pageMetadata, PRIVATE_ROBOTS } from "@/lib/site/metadata"
import { formatRating, formatRupiah } from "@/utils/format/intl"

export async function generateStaticParams() {
  const products = await storefrontProductData()

  // Cache Components requires a validation path even for an empty catalog.
  // The existing product/category validation returns notFound for this path.
  return products.length > 0
    ? products.map(({ category, slug }) => ({ category, slug }))
    : [{ category: "__placeholder__", slug: "__placeholder__" }]
}

export async function generateMetadata({
  params,
}: PageProps<"/c/[category]/p/[slug]">): Promise<Metadata> {
  const { category, slug } = await params
  const product = await storefrontProductMetadataBySlug(slug)

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
  params,
}: PageProps<"/c/[category]/p/[slug]">) {
  const { category, slug } = await params
  const [product, products] = await Promise.all([
    storefrontProductDetailBySlug(slug),
    storefrontProductData(),
  ])

  if (!product || product.category !== category) {
    notFound()
  }

  const related = await storefrontProductCards(
    relatedProducts(products, product)
  )

  return <ProductDetail product={product} related={related} />
}

export default function CategoryProductPage(
  props: PageProps<"/c/[category]/p/[slug]">
) {
  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductContent {...props} />
    </Suspense>
  )
}
