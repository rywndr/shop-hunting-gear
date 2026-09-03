import "server-only"

import { z } from "zod"

import { serverEnv } from "@/lib/env/server"
import {
  isExcludedShippingService,
  rajaOngkirTrackingCourier,
  SHIPPING_COURIERS,
  type RajaOngkirCourierCode,
} from "@/lib/shipping/config"
import { trackingSchema } from "@/lib/admin/shipment"
import type { RajaOngkirTrackingInput } from "@/lib/shipping/tracking"
import {
  shipmentTrackingSchema,
  type LocationLevel,
  type ShipmentTracking,
  type ShippingLocation,
} from "@/lib/shipping/schema"

const BASE_URL = "https://rajaongkir.komerce.id/api/v1"
export const RAJA_ONGKIR_TRACKING_ENDPOINT = `${BASE_URL}/track/waybill`
const LOCATION_CACHE_SECONDS = 60 * 60 * 24 * 30
const QUOTE_CACHE_SECONDS = 60 * 60

const apiMetaSchema = z.object({
  message: z.string(),
  code: z.number(),
  status: z.string(),
})

const apiLocationSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1),
  zip_code: z.union([z.string(), z.number()]).optional(),
})

const locationsApiResponseSchema = z.object({
  meta: apiMetaSchema,
  data: z.array(apiLocationSchema),
})

const apiQuoteSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().toLowerCase(),
  service: z.string().trim().min(1),
  description: z.string().trim().default(""),
  cost: z.coerce.number().int().nonnegative(),
  etd: z.union([z.string(), z.number()]).transform(String),
})

const quotesApiResponseSchema = z.object({
  meta: apiMetaSchema,
  data: z.array(apiQuoteSchema),
})

const trackingTextSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().min(1))

const optionalTrackingTextSchema = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((value) => {
    if (value === null || value === undefined) return null

    const text = String(value).trim()
    return text === "" ? null : text
  })

const trackingApiMetaSchema = z.object({
  message: z.string(),
  code: z.number().int(),
  status: z.union([z.string(), z.boolean()]),
})

const trackingSummaryApiSchema = z.object({
  courier_code: trackingTextSchema,
  courier_name: trackingTextSchema,
  waybill_number: trackingTextSchema,
  service_code: optionalTrackingTextSchema,
  waybill_date: optionalTrackingTextSchema,
  shipper_name: optionalTrackingTextSchema,
  receiver_name: optionalTrackingTextSchema,
  origin: optionalTrackingTextSchema,
  destination: optionalTrackingTextSchema,
  status: optionalTrackingTextSchema,
})

const trackingDetailsApiSchema = z.object({
  waybill_number: optionalTrackingTextSchema,
  waybill_date: optionalTrackingTextSchema,
  waybill_time: optionalTrackingTextSchema,
  weight: optionalTrackingTextSchema,
  origin: optionalTrackingTextSchema,
  destination: optionalTrackingTextSchema,
  shipper_name: optionalTrackingTextSchema,
  shipper_address1: optionalTrackingTextSchema,
  shipper_address2: optionalTrackingTextSchema,
  shipper_address3: optionalTrackingTextSchema,
  shipper_city: optionalTrackingTextSchema,
  receiver_name: optionalTrackingTextSchema,
  receiver_address1: optionalTrackingTextSchema,
  receiver_address2: optionalTrackingTextSchema,
  receiver_address3: optionalTrackingTextSchema,
  receiver_city: optionalTrackingTextSchema,
})

const trackingDeliveryStatusApiSchema = z.object({
  status: optionalTrackingTextSchema,
  pod_receiver: optionalTrackingTextSchema,
  pod_date: optionalTrackingTextSchema,
  pod_time: optionalTrackingTextSchema,
})

const trackingManifestApiSchema = z.object({
  manifest_code: optionalTrackingTextSchema,
  manifest_description: optionalTrackingTextSchema,
  manifest_date: optionalTrackingTextSchema,
  manifest_time: optionalTrackingTextSchema,
  city_name: optionalTrackingTextSchema,
})

const trackingDataApiSchema = z.object({
  delivered: z.boolean(),
  summary: trackingSummaryApiSchema,
  details: trackingDetailsApiSchema,
  delivery_status: trackingDeliveryStatusApiSchema,
  manifest: z.array(trackingManifestApiSchema),
})

const trackingApiResponseSchema = z.object({
  meta: trackingApiMetaSchema,
  data: trackingDataApiSchema.nullable(),
})

export type RajaOngkirTrackingFailureKind =
  | "invalid-input"
  | "unauthorized"
  | "not-found"
  | "network"
  | "invalid-response"
  | "upstream"

export class RajaOngkirTrackingError extends Error {
  readonly kind: RajaOngkirTrackingFailureKind
  readonly status: number | null

  constructor(
    kind: RajaOngkirTrackingFailureKind,
    status: number | null = null
  ) {
    super(`RajaOngkir tracking request failed: ${kind}.`)
    this.name = "RajaOngkirTrackingError"
    this.kind = kind
    this.status = status
  }
}

function trackingFailureForStatus(status: number) {
  switch (status) {
    case 400:
      return "invalid-input" as const
    case 401:
      return "unauthorized" as const
    case 404:
      return "not-found" as const
    default:
      return "upstream" as const
  }
}

function normalizedTrackingResponse(
  data: z.infer<typeof trackingDataApiSchema>
): ShipmentTracking {
  return shipmentTrackingSchema.parse({
    delivered: data.delivered,
    summary: {
      courierCode: data.summary.courier_code,
      courierName: data.summary.courier_name,
      waybillNumber: data.summary.waybill_number,
      serviceCode: data.summary.service_code,
      waybillDate: data.summary.waybill_date,
      origin: data.summary.origin ?? data.details.origin,
      destination: data.summary.destination ?? data.details.destination,
      status: data.summary.status,
      receiverName: data.summary.receiver_name ?? data.details.receiver_name,
    },
    deliveryStatus: {
      status: data.delivery_status.status,
      podReceiver: data.delivery_status.pod_receiver,
      podDate: data.delivery_status.pod_date,
      podTime: data.delivery_status.pod_time,
    },
    // The API calls this array the manifest/history. Preserve its order.
    manifest: data.manifest.map((event) => ({
      description: event.manifest_description,
      date: event.manifest_date,
      time: event.manifest_time,
      city: event.city_name,
    })),
  })
}

export function parseRajaOngkirTrackingResponse(
  payload: unknown
): ShipmentTracking {
  const payloadWithMeta = z.object({ meta: z.unknown() }).safeParse(payload)
  const meta = trackingApiMetaSchema.safeParse(
    payloadWithMeta.success ? payloadWithMeta.data.meta : undefined
  )

  if (meta.success && meta.data.code !== 200) {
    throw new RajaOngkirTrackingError(
      trackingFailureForStatus(meta.data.code),
      meta.data.code
    )
  }

  const parsed = trackingApiResponseSchema.safeParse(payload)

  if (!parsed.success || parsed.data.data === null) {
    throw new RajaOngkirTrackingError("invalid-response")
  }

  return normalizedTrackingResponse(parsed.data.data)
}

function locationPath(level: LocationLevel, parentId?: number) {
  switch (level) {
    case "province":
      return "destination/province"
    case "city":
      return `destination/city/${parentId}`
    case "district":
      return `destination/district/${parentId}`
    case "subdistrict":
      return `destination/sub-district/${parentId}`
    default: {
      const _exhaustive: never = level
      return _exhaustive
    }
  }
}

function normalizedZipCode(value: string | number | undefined) {
  const text = value === undefined ? "" : String(value)
  return /^\d{5}$/.test(text) ? text : null
}

export async function rajaOngkirLocations({
  level,
  parentId,
}: {
  level: LocationLevel
  parentId?: number
}): Promise<readonly ShippingLocation[]> {
  if (level !== "province" && parentId === undefined) {
    throw new Error("No parent location ID.")
  }

  const response = await fetch(`${BASE_URL}/${locationPath(level, parentId)}`, {
    headers: { key: serverEnv.rajaOngkirApiKey },
    next: { revalidate: LOCATION_CACHE_SECONDS },
  })
  const payload: unknown = await response.json()
  const parsed = locationsApiResponseSchema.safeParse(payload)

  if (!response.ok || !parsed.success) {
    throw new Error("Invalid RajaOngkir location response.")
  }

  return parsed.data.data.map((location) => ({
    id: location.id,
    name: location.name,
    zipCode: normalizedZipCode(location.zip_code),
  }))
}

function isShippingCourierCode(value: string): value is RajaOngkirCourierCode {
  return SHIPPING_COURIERS.some((courier) => courier.code === value)
}

export async function rajaOngkirShippingOptions({
  destinationId,
  weight,
}: {
  destinationId: number
  weight: number
}) {
  const body = new URLSearchParams({
    origin: String(serverEnv.rajaOngkirOriginId),
    destination: String(destinationId),
    weight: String(weight),
    courier: SHIPPING_COURIERS.map((courier) => courier.code).join(":"),
  })
  const response = await fetch(`${BASE_URL}/calculate/domestic-cost`, {
    method: "POST",
    headers: {
      key: serverEnv.rajaOngkirApiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "force-cache",
    next: { revalidate: QUOTE_CACHE_SECONDS },
  })
  const payload: unknown = await response.json()

  if (response.status === 400) {
    return SHIPPING_COURIERS.map((courier) => ({
      kind: "unavailable" as const,
      courier: courier.code,
    }))
  }

  const parsed = quotesApiResponseSchema.safeParse(payload)

  if (!response.ok || !parsed.success) {
    throw new Error("Invalid RajaOngkir shipping cost response.")
  }

  const available = parsed.data.data.flatMap((quote) =>
    isShippingCourierCode(quote.code) &&
    !isExcludedShippingService({
      courier: quote.code,
      service: quote.service,
    })
      ? [
          {
            kind: "available" as const,
            courier: quote.code,
            courierName: quote.name,
            service: quote.service,
            description: quote.description,
            cost: quote.cost,
            etd: quote.etd,
          },
        ]
      : []
  )
  const returnedCouriers = new Set(available.map((quote) => quote.courier))
  const unavailable = SHIPPING_COURIERS.filter(
    (courier) => !returnedCouriers.has(courier.code)
  ).map((courier) => ({
    kind: "unavailable" as const,
    courier: courier.code,
  }))

  return [...available, ...unavailable]
}

export async function rajaOngkirAddressMatches({
  provinceId,
  province,
  cityId,
  city,
  districtId,
  district,
  subdistrictId,
  subdistrict,
}: {
  provinceId: number
  province: string
  cityId: number
  city: string
  districtId: number
  district: string
  subdistrictId: number
  subdistrict: string
}) {
  const [provinces, cities, districts, subdistricts] = await Promise.all([
    rajaOngkirLocations({ level: "province" }),
    rajaOngkirLocations({ level: "city", parentId: provinceId }),
    rajaOngkirLocations({ level: "district", parentId: cityId }),
    rajaOngkirLocations({ level: "subdistrict", parentId: districtId }),
  ])
  const contains = (
    locations: readonly ShippingLocation[],
    id: number,
    name: string
  ) =>
    locations.some((location) => location.id === id && location.name === name)

  return (
    contains(provinces, provinceId, province) &&
    contains(cities, cityId, city) &&
    contains(districts, districtId, district) &&
    contains(subdistricts, subdistrictId, subdistrict)
  )
}

export async function rajaOngkirTracking({
  awb,
  courier,
  lastPhoneNumber,
}: RajaOngkirTrackingInput): Promise<ShipmentTracking> {
  const parsedAwb = trackingSchema.safeParse(awb)
  const parsedCourier = rajaOngkirTrackingCourier(courier)
  const parsedPhone = z
    .string()
    .regex(/^\d{5}$/)
    .safeParse(lastPhoneNumber)

  if (!parsedAwb.success || !parsedCourier || !parsedPhone.success) {
    throw new RajaOngkirTrackingError("invalid-input")
  }

  const body = new URLSearchParams({
    awb: parsedAwb.data,
    courier: parsedCourier,
    last_phone_number: parsedPhone.data,
  })
  const apiKey = serverEnv.rajaOngkirApiKey

  let response: Response

  try {
    response = await fetch(RAJA_ONGKIR_TRACKING_ENDPOINT, {
      method: "POST",
      headers: {
        key: apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    })
  } catch {
    throw new RajaOngkirTrackingError("network")
  }

  if (!response.ok) {
    throw new RajaOngkirTrackingError(
      trackingFailureForStatus(response.status),
      response.status
    )
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    throw new RajaOngkirTrackingError("invalid-response", response.status)
  }

  try {
    return parseRajaOngkirTrackingResponse(payload)
  } catch (error) {
    if (error instanceof RajaOngkirTrackingError) {
      throw error
    }

    throw new RajaOngkirTrackingError("invalid-response", response.status)
  }
}
