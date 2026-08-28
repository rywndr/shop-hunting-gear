import { notFound, permanentRedirect } from "next/navigation"

import { findProduct, productHref } from "@/lib/products/config"
import { MOCK_PRODUCTS } from "@/lib/products/mock"

export function generateStaticParams() {
  return MOCK_PRODUCTS.map(({ slug }) => ({ slug }))
}

export default async function ProductPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params
  const product = findProduct(MOCK_PRODUCTS, slug)

  if (!product) {
    notFound()
  }

  permanentRedirect(productHref(product))
}
