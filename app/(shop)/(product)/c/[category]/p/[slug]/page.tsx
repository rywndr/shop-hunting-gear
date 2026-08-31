import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ProductDetail } from "@/components/products/product-detail"
import { productHref, relatedProducts } from "@/lib/products/config"
import {
  storefrontProductBySlug,
  storefrontProducts,
} from "@/lib/products/service"

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
