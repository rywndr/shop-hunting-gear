import { z } from "zod"

import { trackingSchema } from "@/lib/admin/shipment"
import {
  rajaOngkirTrackingCourier,
  trackingCourierForShippingCourier,
  type RajaOngkirTrackingCourierCode,
} from "@/lib/shipping/config"

export type RajaOngkirTrackingInput = {
  readonly awb: string
  readonly courier: RajaOngkirTrackingCourierCode
  readonly lastPhoneNumber: string
}

export type StoredShipmentFields = {
  readonly tracking: string | null
  readonly shippingCourier: string
  readonly phone: string | null
}

export type TrackingInputPreparation =
  | { readonly kind: "ready"; readonly input: RajaOngkirTrackingInput }
  | { readonly kind: "missing-tracking" }
  | { readonly kind: "unsupported-courier" }
  | { readonly kind: "invalid-phone" }

export const customTrackingRequestSchema = z.object({
  awb: trackingSchema,
  courier: z.string().trim().optional(),
  lastPhoneNumber: z.string().trim().optional(),
})

export type CustomTrackingRequest = z.input<typeof customTrackingRequestSchema>

export function lastFivePhoneDigits(phone: string | null) {
  if (phone === null) return null

  const digits = phone.replace(/\D/g, "")
  return digits.length >= 5 ? digits.slice(-5) : null
}

export function canTrackSavedShipment({
  fulfillmentStatus,
  tracking,
  shippingCourier,
}: {
  readonly fulfillmentStatus: string
  readonly tracking: string | null
  readonly shippingCourier: string
}) {
  return (
    (fulfillmentStatus === "shipped" || fulfillmentStatus === "completed") &&
    trackingSchema.safeParse(tracking).success &&
    trackingCourierForShippingCourier(shippingCourier) !== null
  )
}

export function trackingInputFromOrder({
  tracking,
  shippingCourier,
  phone,
}: StoredShipmentFields): TrackingInputPreparation {
  const parsedTracking = trackingSchema.safeParse(tracking)

  if (!parsedTracking.success) {
    return { kind: "missing-tracking" }
  }

  const courier = trackingCourierForShippingCourier(shippingCourier)

  if (!courier) {
    return { kind: "unsupported-courier" }
  }

  const lastPhoneNumber = lastFivePhoneDigits(phone)

  if (!lastPhoneNumber) {
    return { kind: "invalid-phone" }
  }

  return {
    kind: "ready",
    input: {
      awb: parsedTracking.data,
      courier,
      lastPhoneNumber,
    },
  }
}

export function trackingCourierFromCustomValue(value: string) {
  return rajaOngkirTrackingCourier(value.trim())
}
