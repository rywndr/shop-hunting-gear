/**
 * Single source of truth for store identity and navigation.
 */

export type NavLink = {
  readonly label: string
  readonly href: string
}

export type ContactLink = {
  readonly display: string
  readonly href: string
}

export const SITE = {
  name: "HUNTING-GEAR.NET",
  alternateName: "Hunting Gear",
  logo: {
    src: "/app-logo.png",
    width: 516,
    height: 483,
  },
  phone: {
    display: "0812-3456-7890",
    href: "tel:+6281234567890",
  },
  email: {
    display: "info@hunting-gear.net",
    href: "mailto:halo@hunting-gear.net",
  },
} as const satisfies {
  name: string
  alternateName: string
  logo: { src: string; width: number; height: number }
  phone: ContactLink
  email: ContactLink
}

export const CATEGORIES = [
  { label: "Hunting", href: "/c/hunting" },
  { label: "Fishing", href: "/c/fishing" },
  { label: "Spareparts", href: "/c/spareparts" },
  { label: "Hobbies", href: "/c/hobbies" },
] as const satisfies readonly NavLink[]

export const ACCOUNT_LINKS = [
  { label: "Masuk", href: "/masuk" },
  { label: "Daftar", href: "/daftar" },
] as const satisfies readonly NavLink[]

export const INFO_LINKS = [
  { label: "Tentang Kami", href: "/tentang-kami" },
  { label: "Cara Pemesanan", href: "/cara-pemesanan" },
  { label: "Pengiriman & Retur", href: "/pengiriman-retur" },
  { label: "Kebijakan Privasi", href: "/kebijakan-privasi" },
] as const satisfies readonly NavLink[]
