import "server-only"

import { z } from "zod"

import { serverEnv } from "@/lib/env/server"
import {
  isExcludedShippingService,
  SHIPPING_COURIERS,
  type ShippingCourierCode,
} from "@/lib/shipping/config"
import type { LocationLevel, ShippingLocation } from "@/lib/shipping/schema"

const BASE_URL = "https://rajaongkir.komerce.id/api/v1"
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

function isShippingCourierCode(value: string): value is ShippingCourierCode {
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
