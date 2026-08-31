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

export type ShippingCourierCode = (typeof SHIPPING_COURIERS)[number]["code"]

export function isExcludedShippingService({
  courier,
  service,
}: {
  courier: ShippingCourierCode
  service: string
}) {
  return courier === "jne" && service.trim().toUpperCase().startsWith("JTR")
}
