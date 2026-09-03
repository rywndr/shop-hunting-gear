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

export const shipmentTrackingEventSchema = z.object({
  description: z.string().nullable(),
  date: z.string().nullable(),
  time: z.string().nullable(),
  city: z.string().nullable(),
})

export const shipmentTrackingSchema = z.object({
  delivered: z.boolean(),
  summary: z.object({
    courierCode: z.string().min(1),
    courierName: z.string().min(1),
    waybillNumber: z.string().min(1),
    serviceCode: z.string().nullable(),
    waybillDate: z.string().nullable(),
    origin: z.string().nullable(),
    destination: z.string().nullable(),
    status: z.string().nullable(),
    receiverName: z.string().nullable(),
  }),
  deliveryStatus: z.object({
    status: z.string().nullable(),
    podReceiver: z.string().nullable(),
    podDate: z.string().nullable(),
    podTime: z.string().nullable(),
  }),
  manifest: z.array(shipmentTrackingEventSchema),
})

export type ShipmentTracking = z.infer<typeof shipmentTrackingSchema>

export const shipmentTrackingActionResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("success"), data: shipmentTrackingSchema }),
  z.object({
    kind: z.literal("needs-details"),
    awb: z.string().min(1),
  }),
  z.object({ kind: z.literal("error"), message: z.string().min(1) }),
])

export type ShipmentTrackingActionResult = z.infer<
  typeof shipmentTrackingActionResultSchema
>
