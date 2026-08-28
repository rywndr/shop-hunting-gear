import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ProductDetail } from "@/components/products/product-detail"
import {
  findProduct,
  productHref,
  relatedProducts,
} from "@/lib/products/config"
import { MOCK_PRODUCTS } from "@/lib/products/mock"

export function generateStaticParams() {
  return MOCK_PRODUCTS.map(({ category, slug }) => ({ category, slug }))
}

export async function generateMetadata({
  params,
}: PageProps<"/c/[category]/p/[slug]">): Promise<Metadata> {
  const { category, slug } = await params
  const product = findProduct(MOCK_PRODUCTS, slug)

  if (!product || product.category !== category) {
    return { title: "Produk tidak ditemukan" }
  }

  return {
    title: product.name,
    description: product.description[0],
    alternates: { canonical: productHref(product) },
  }
}

export default async function CategoryProductPage({
  params,
}: PageProps<"/c/[category]/p/[slug]">) {
  const { category, slug } = await params
  const product = findProduct(MOCK_PRODUCTS, slug)

  if (!product || product.category !== category) {
    notFound()
  }

  return (
    <ProductDetail
      product={product}
      related={relatedProducts(MOCK_PRODUCTS, product)}
    />
  )
}
