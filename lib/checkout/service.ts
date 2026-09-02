import "server-only"

import type { CartItem, CartVariant } from "@/lib/cart/config"
import {
  cartItemsForUser,
  cartItemsWithThumbnailsForUser,
} from "@/lib/cart/service"
import type { CheckoutSource } from "@/lib/checkout/config"
import type { Product, ProductVariant } from "@/lib/products/config"
import {
  storefrontProductCardBySlug,
  storefrontProductDataBySlug,
} from "@/lib/products/service"

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

type ProductCheckoutSource = Extract<CheckoutSource, { kind: "product" }>

type ProductBySlug = (slug: string) => Promise<Product | undefined>

async function checkoutProductItem({
  source,
  productBySlug,
}: {
  readonly source: ProductCheckoutSource
  readonly productBySlug: ProductBySlug
}): Promise<readonly CartItem[]> {
  const product = await productBySlug(source.productSlug)

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
    case "product":
      return checkoutProductItem({
        source,
        productBySlug: storefrontProductDataBySlug,
      })
    default: {
      const _exhaustive: never = source
      return _exhaustive
    }
  }
}

export async function checkoutItemsWithThumbnailsForUser({
  userId,
  source,
}: {
  userId: string
  source: CheckoutSource
}): Promise<readonly CartItem[]> {
  switch (source.kind) {
    case "cart":
      return cartItemsWithThumbnailsForUser(userId, {
        preserveQuantity: true,
      })
    case "product":
      return checkoutProductItem({
        source,
        productBySlug: storefrontProductCardBySlug,
      })
    default: {
      const _exhaustive: never = source
      return _exhaustive
    }
  }
}
