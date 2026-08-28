import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ProductDetail } from "@/components/products/product-detail"
import { findProduct, relatedProducts } from "@/lib/products/config"
import { MOCK_PRODUCTS } from "@/lib/products/mock"

export function generateStaticParams() {
  return MOCK_PRODUCTS.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params,
}: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const product = findProduct(MOCK_PRODUCTS, slug)

  if (!product) {
    return { title: "Produk tidak ditemukan" }
  }

  return { title: product.name, description: product.description[0] }
}

export default async function ProductPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params
  const product = findProduct(MOCK_PRODUCTS, slug)

  if (!product) {
    notFound()
  }

  return (
    <ProductDetail
      product={product}
      related={relatedProducts(MOCK_PRODUCTS, product)}
    />
  )
}
