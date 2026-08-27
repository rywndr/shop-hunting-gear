/**
 * Single source of truth for store identity and navigation.
 */

export type NavLink = {
  readonly label: string
  readonly href: string
}

export type PhoneContact = {
  readonly display: string
  readonly href: string
}

export const SITE = {
  name: "HUNTING-GEAR.NET",
  logo: {
    src: "/app-logo.png",
    width: 516,
    height: 483,
  },
  phone: {
    display: "0812-3456-7890",
    href: "tel:+6281234567890",
  },
} as const satisfies {
  name: string
  logo: { src: string; width: number; height: number }
  phone: PhoneContact
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
