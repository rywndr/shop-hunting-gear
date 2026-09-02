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

// Store managed shipping is excluded from RajaOngkir quotes.
export const MANUAL_SHIPPING_COURIER = "manual"

export type ShippingCourierCode =
  | RajaOngkirCourierCode
  | typeof MANUAL_SHIPPING_COURIER

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
