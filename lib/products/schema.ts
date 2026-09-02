import { z } from "zod"

import { isCategorySlug, type CategorySlug } from "../site/config"

const legacyStoredProductImageSchema = z
  .object({
    id: z.string().min(1),
    objectKey: z.string().min(1),
    alt: z.string().trim().min(1),
  })
  .strict()

const derivedStoredProductImageSchema = z
  .object({
    id: z.string().min(1),
    objectKey: z.string().min(1),
    thumbnailObjectKey: z.string().min(1),
    detailObjectKey: z.string().min(1),
    alt: z.string().trim().min(1),
  })
  .strict()

// The required derivative keys discriminate new records without changing the
// JSON shape of legacy records.
export const storedProductImageSchema = z.union([
  derivedStoredProductImageSchema,
  legacyStoredProductImageSchema,
])

export type StoredProductImage = z.infer<typeof storedProductImageSchema>

export const storedVariantOptionSchema = z.object({
  value: z.string().trim().min(1),
  price: z.number().int().positive(),
  weight: z.number().int().positive().nullable(),
  imageId: z.string().min(1).nullable(),
})

export const storedProductVariantSchema = z.object({
  label: z.string().trim().min(1),
  options: z.array(storedVariantOptionSchema).nonempty(),
})

export type StoredProductVariant = z.infer<typeof storedProductVariantSchema>

const reviewSchema = z.object({
  id: z.string().min(1),
  author: z.string().min(1),
  rating: z.union([
    z.literal(5),
    z.literal(4),
    z.literal(3),
    z.literal(2),
    z.literal(1),
  ]),
  createdAt: z.string().min(1),
  variant: z.string().nullable(),
  body: z.string().min(1),
})

const ratingBreakdownSchema = z.object({
  5: z.number().int().nonnegative(),
  4: z.number().int().nonnegative(),
  3: z.number().int().nonnegative(),
  2: z.number().int().nonnegative(),
  1: z.number().int().nonnegative(),
})

export const storedProductDataSchema = z.object({
  category: z.custom<CategorySlug>(isCategorySlug),
  description: z.array(z.string().trim().min(1)).nonempty(),
  images: z.array(storedProductImageSchema).nonempty(),
  variants: z.array(storedProductVariantSchema),
  ratings: ratingBreakdownSchema,
  reviews: z.array(reviewSchema),
})
