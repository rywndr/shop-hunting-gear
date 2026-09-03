export const SHIPPING_COURIERS = [
  { code: "jne", label: "JNE", logoSrc: "/logos/jne.svg" },
  {
    code: "jnt",
    label: "J&T Express",
    logoSrc: "/logos/jnt-express.svg",
  },
  { code: "sicepat", label: "SiCepat", logoSrc: "/logos/sicepat.svg" },
  { code: "tiki", label: "TIKI", logoSrc: "/logos/tiki.svg" },
  { code: "pos", label: "POS Indonesia", logoSrc: "/logos/pos-indo.svg" },
] as const

export type RajaOngkirCourierCode = (typeof SHIPPING_COURIERS)[number]["code"]

// Official availability:
// https://www.rajaongkir.com/docs/shipping-cost/getting_started/courier_availability
// This list is separate from SHIPPING_COURIERS because SiCepat is available
// for quotes but not for AWB tracking.
export const RAJA_ONGKIR_TRACKING_COURIERS = [
  { code: "jne", label: "JNE" },
  { code: "sap", label: "SAP Express" },
  { code: "ninja", label: "Ninja" },
  { code: "jnt", label: "J&T Express" },
  { code: "tiki", label: "TIKI" },
  { code: "wahana", label: "Wahana Express" },
  { code: "pos", label: "POS Indonesia" },
  { code: "lion", label: "Lion Parcel" },
] as const

export type RajaOngkirTrackingCourierCode =
  (typeof RAJA_ONGKIR_TRACKING_COURIERS)[number]["code"]

// Store managed shipping is excluded from RajaOngkir quotes.
export const MANUAL_SHIPPING_COURIER = "manual"

export type ShippingCourierCode =
  RajaOngkirCourierCode | typeof MANUAL_SHIPPING_COURIER

const SHIPPING_COURIER_TRACKING_MAP = [
  { shippingCourier: "jne", courier: "jne" },
  { shippingCourier: "jnt", courier: "jnt" },
  { shippingCourier: "tiki", courier: "tiki" },
  { shippingCourier: "pos", courier: "pos" },
] as const satisfies readonly {
  shippingCourier: ShippingCourierCode
  courier: RajaOngkirTrackingCourierCode
}[]

export function trackingCourierForShippingCourier(
  shippingCourier: string
): RajaOngkirTrackingCourierCode | null {
  return (
    SHIPPING_COURIER_TRACKING_MAP.find(
      (mapping) => mapping.shippingCourier === shippingCourier
    )?.courier ?? null
  )
}

export function rajaOngkirTrackingCourier(
  courier: string
): RajaOngkirTrackingCourierCode | null {
  return (
    RAJA_ONGKIR_TRACKING_COURIERS.find(
      (supported) => supported.code === courier
    )?.code ?? null
  )
}

export function shippingOptionId({
  courier,
  service,
}: {
  courier: ShippingCourierCode
  service: string
}) {
  return `${courier}:${service}`
}

export function isExcludedShippingService({
  courier,
  service,
}: {
  courier: ShippingCourierCode
  service: string
}) {
  return courier === "jne" && service.trim().toUpperCase().startsWith("JTR")
}
