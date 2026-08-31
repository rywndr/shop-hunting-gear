import { z } from "zod"

import { SHIPPING_COURIERS } from "@/lib/shipping/config"

export const locationLevelSchema = z.enum([
  "province",
  "city",
  "district",
  "subdistrict",
])

export type LocationLevel = z.infer<typeof locationLevelSchema>

export const shippingLocationSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
  zipCode: z.string().nullable(),
})

export type ShippingLocation = z.infer<typeof shippingLocationSchema>

export const locationsResponseSchema = z.object({
  locations: z.array(shippingLocationSchema),
})

const courierCodeSchema = z.enum(
  SHIPPING_COURIERS.map((courier) => courier.code)
)

export const shippingOptionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("available"),
    courier: courierCodeSchema,
    courierName: z.string().min(1),
    service: z.string().min(1),
    description: z.string(),
    cost: z.number().int().nonnegative(),
    etd: z.string(),
  }),
  z.object({
    kind: z.literal("unavailable"),
    courier: courierCodeSchema,
  }),
])

export type ShippingOption = z.infer<typeof shippingOptionSchema>

export const shippingQuotesResponseSchema = z.object({
  weight: z.number().int().positive(),
  options: z.array(shippingOptionSchema),
})
