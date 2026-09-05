import type { CartVariant } from "@/lib/cart/config"
import type { Product } from "@/lib/products/config"

export type CheckoutSource =
  | { readonly kind: "cart" }
  | {
      readonly kind: "product"
      readonly productSlug: string
      readonly quantity: number
      readonly variants: readonly CartVariant[]
    }

export function checkoutHref({
  product,
  quantity,
  variants,
}: {
  product: Pick<Product, "slug">
  quantity: number
  variants: readonly CartVariant[]
}) {
  const params = new URLSearchParams({
    product: product.slug,
    quantity: String(quantity),
    variants: JSON.stringify(variants),
  })

  return `/checkout?${params}`
}
