import "server-only"

import type { CartItem, CartVariant } from "@/lib/cart/config"
import { cartItemsForUser } from "@/lib/cart/service"
import type { CheckoutSource } from "@/lib/checkout/config"
import type { Product, ProductVariant } from "@/lib/products/config"
import { storefrontProductBySlug } from "@/lib/products/service"

function validVariant(
  input: CartVariant | undefined,
  productVariant: ProductVariant
) {
  return (
    input?.label === productVariant.label &&
    productVariant.options.includes(input.value)
  )
}

function checkoutProduct(product: Product): CartItem["product"] {
  return {
    category: product.category,
    compareAtPrice: product.compareAtPrice,
    images: product.images,
    name: product.name,
    price: product.price,
    slug: product.slug,
    stock: product.stock,
    weight: product.weight,
  }
}

export async function checkoutItemsForUser({
  userId,
  source,
}: {
  userId: string
  source: CheckoutSource
}): Promise<readonly CartItem[]> {
  switch (source.kind) {
    case "cart":
      return cartItemsForUser(userId, { preserveQuantity: true })
    case "product": {
      const product = await storefrontProductBySlug(source.productSlug)

      if (
        !product ||
        source.variants.length !== product.variants.length ||
        !product.variants.every((variant, index) =>
          validVariant(source.variants[index], variant)
        )
      ) {
        return []
      }

      return [
        {
          id: `checkout-${product.slug}`,
          product: checkoutProduct(product),
          quantity: source.quantity,
          variants: source.variants,
        },
      ]
    }
    default: {
      const _exhaustive: never = source
      return _exhaustive
    }
  }
}
