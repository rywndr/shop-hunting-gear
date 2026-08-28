import type { Product } from "@/lib/products/config"

type CartProduct = Pick<
  Product,
  "category" | "compareAtPrice" | "name" | "price" | "slug" | "stock"
>

export type CartVariant = {
  readonly label: string
  readonly value: string
}

export type CartItem = {
  readonly id: string
  readonly product: CartProduct
  readonly quantity: number
  readonly variants: readonly CartVariant[]
}

export type AddToCartInput = Omit<CartItem, "id">

function cartItemId(input: AddToCartInput) {
  return JSON.stringify([
    input.product.slug,
    input.variants.map(({ label, value }) => [label, value]),
  ])
}

function hasSameVariants(
  left: readonly CartVariant[],
  right: readonly CartVariant[]
) {
  return (
    left.length === right.length &&
    left.every(
      (variant, index) =>
        variant.label === right[index]?.label &&
        variant.value === right[index]?.value
    )
  )
}

export function addCartItem(
  items: readonly CartItem[],
  input: AddToCartInput
): readonly CartItem[] {
  const existingIndex = items.findIndex(
    (item) =>
      item.product.slug === input.product.slug &&
      hasSameVariants(item.variants, input.variants)
  )

  if (existingIndex === -1) {
    return [...items, { ...input, id: cartItemId(input) }]
  }

  return items.map((item, index) =>
    index === existingIndex
      ? {
          ...item,
          quantity: Math.min(
            item.quantity + input.quantity,
            item.product.stock
          ),
        }
      : item
  )
}

export function setCartItemQuantity({
  items,
  itemId,
  quantity,
}: {
  items: readonly CartItem[]
  itemId: string
  quantity: number
}): readonly CartItem[] {
  return items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          quantity: Math.min(Math.max(quantity, 1), item.product.stock),
        }
      : item
  )
}

export function removeCartItem({
  items,
  itemId,
}: {
  items: readonly CartItem[]
  itemId: string
}): readonly CartItem[] {
  return items.filter((item) => item.id !== itemId)
}

export function cartItemCount(items: readonly CartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0)
}

export function cartSubtotal(items: readonly CartItem[]) {
  return items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  )
}
