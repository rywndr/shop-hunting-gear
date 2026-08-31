import { z } from "zod"

import { CATEGORY_SLUGS } from "@/lib/site/config"

export const cartVariantSchema = z.object({
  label: z.string().trim().min(1),
  value: z.string().trim().min(1),
})

export const cartItemsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      product: z.object({
        category: z.enum(CATEGORY_SLUGS),
        compareAtPrice: z.int().nonnegative().nullable(),
        name: z.string(),
        price: z.int().nonnegative(),
        slug: z.string(),
        stock: z.int().nonnegative(),
        weight: z.int().positive(),
      }),
      quantity: z.int().positive(),
      variants: z.array(cartVariantSchema),
    })
  ),
})

export const addCartItemSchema = z.object({
  productSlug: z.string().trim().min(1),
  quantity: z.int().positive(),
  variants: z.array(cartVariantSchema),
})

export const updateCartItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.int().positive(),
})

export const removeCartItemSchema = z.object({
  itemId: z.string().uuid(),
})

export type AddCartItemRequest = z.infer<typeof addCartItemSchema>
