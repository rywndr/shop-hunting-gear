import { randomUUID } from "node:crypto"
import { and, asc, eq, sql } from "drizzle-orm"

import type { CartItem, CartVariant } from "./config"
import type { AddCartItemRequest } from "./schema"
import { db } from "../db/client"
import { cartItem } from "../db/schema/cart"
import {
  findProduct,
  type Product,
  type ProductVariant,
} from "../products/config"
import { MOCK_PRODUCTS } from "../products/mock"

type CartInputResult =
  | {
      kind: "valid"
      product: Product
      quantity: number
      variants: readonly CartVariant[]
      variantKey: string
    }
  | { kind: "invalid"; message: string }

function validVariant(
  input: CartVariant | undefined,
  productVariant: ProductVariant
): input is CartVariant {
  return (
    input?.label === productVariant.label &&
    productVariant.options.includes(input.value)
  )
}

function resolveCartInput(input: AddCartItemRequest): CartInputResult {
  const product = findProduct(MOCK_PRODUCTS, input.productSlug)

  if (!product || product.stock === 0) {
    return { kind: "invalid", message: "Product is unavailable." }
  }

  if (
    input.variants.length !== product.variants.length ||
    !product.variants.every((variant, index) =>
      validVariant(input.variants[index], variant)
    )
  ) {
    return { kind: "invalid", message: "Invalid product variant selection." }
  }

  const quantity = Math.min(input.quantity, product.stock)
  const variants = input.variants.map(({ label, value }) => ({ label, value }))

  return {
    kind: "valid",
    product,
    quantity,
    variants,
    variantKey: JSON.stringify(
      variants.map(({ label, value }) => [label, value])
    ),
  }
}

function cartProduct(product: Product): CartItem["product"] {
  return {
    category: product.category,
    compareAtPrice: product.compareAtPrice,
    name: product.name,
    price: product.price,
    slug: product.slug,
    stock: product.stock,
  }
}

export async function cartItemsForUser(
  userId: string
): Promise<readonly CartItem[]> {
  const rows = await db
    .select({
      id: cartItem.id,
      productSlug: cartItem.productSlug,
      quantity: cartItem.quantity,
      variants: cartItem.variants,
    })
    .from(cartItem)
    .where(eq(cartItem.userId, userId))
    .orderBy(asc(cartItem.createdAt))

  return rows.flatMap((row) => {
    const product = findProduct(MOCK_PRODUCTS, row.productSlug)

    return product
      ? [
          {
            id: row.id,
            product: cartProduct(product),
            quantity: Math.min(row.quantity, product.stock),
            variants: row.variants,
          },
        ]
      : []
  })
}

export async function addCartItemForUser({
  userId,
  input,
}: {
  userId: string
  input: AddCartItemRequest
}): Promise<{ kind: "success" } | { kind: "invalid"; message: string }> {
  const resolved = resolveCartInput(input)

  if (resolved.kind === "invalid") {
    return resolved
  }

  await db
    .insert(cartItem)
    .values({
      id: randomUUID(),
      userId,
      productSlug: resolved.product.slug,
      variantKey: resolved.variantKey,
      variants: resolved.variants,
      quantity: resolved.quantity,
    })
    .onConflictDoUpdate({
      target: [cartItem.userId, cartItem.productSlug, cartItem.variantKey],
      set: {
        quantity: sql`least(${cartItem.quantity} + excluded.quantity, ${resolved.product.stock})`,
        updatedAt: new Date(),
      },
    })

  return { kind: "success" }
}

export async function updateCartItemForUser({
  userId,
  itemId,
  quantity,
}: {
  userId: string
  itemId: string
  quantity: number
}) {
  const [row] = await db
    .select({ productSlug: cartItem.productSlug })
    .from(cartItem)
    .where(and(eq(cartItem.id, itemId), eq(cartItem.userId, userId)))
    .limit(1)
  const product = row ? findProduct(MOCK_PRODUCTS, row.productSlug) : undefined

  if (!product || product.stock === 0) {
    return false
  }

  await db
    .update(cartItem)
    .set({ quantity: Math.min(quantity, product.stock) })
    .where(and(eq(cartItem.id, itemId), eq(cartItem.userId, userId)))

  return true
}

export async function removeCartItemForUser({
  userId,
  itemId,
}: {
  userId: string
  itemId: string
}) {
  await db
    .delete(cartItem)
    .where(and(eq(cartItem.id, itemId), eq(cartItem.userId, userId)))
}
