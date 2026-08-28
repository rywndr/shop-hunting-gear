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

export type Category = NavLink & {
  readonly slug: string
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
  { slug: "hunting", label: "Hunting", href: "/c/hunting" },
  { slug: "fishing", label: "Fishing", href: "/c/fishing" },
  { slug: "spareparts", label: "Spareparts", href: "/c/spareparts" },
  { slug: "hobbies", label: "Hobbies", href: "/c/hobbies" },
] as const satisfies readonly Category[]

export type CategorySlug = (typeof CATEGORIES)[number]["slug"]

export function categoryBySlug(slug: CategorySlug): Category {
  const category = CATEGORIES.find((candidate) => candidate.slug === slug)

  if (!category) {
    throw new Error(`Kategori tidak dikenal: ${slug}`)
  }

  return category
}

export const AUTH_ROUTES = {
  signIn: "/masuk",
  register: "/daftar",
  forgotPassword: "/lupa-sandi",
} as const satisfies Record<string, string>

export const AUTH_SHOWCASE = {
  image: "/auth/bottomland-2.webp",
  alt: "Pemburu berkamuflase duduk bersandar di pohon sambil memegang busur.",
  focus: "38% 45%",
  title: "Perlengkapan yang menemani setiap perjalanan",
  body: "Kamuflase, joran, sparepart, dan aksesori outdoor dalam satu toko.",
} as const satisfies {
  image: string
  alt: string
  focus: string
  title: string
  body: string
}

export const ACCOUNT_LINKS = [
  { label: "Masuk", href: AUTH_ROUTES.signIn },
  { label: "Daftar", href: AUTH_ROUTES.register },
] as const satisfies readonly NavLink[]

export const IS_LOGGED_IN = true

export const USER_LINKS = {
  account: { label: "Akun", href: "/akun" },
  history: { label: "History", href: "/history" },
  logout: { label: "Keluar", href: "/keluar" },
} as const satisfies Record<string, NavLink>

export const INFO_LINKS = [
  { label: "Tentang Kami", href: "/tentang-kami" },
  { label: "Cara Pemesanan", href: "/cara-pemesanan" },
  { label: "Pengiriman & Retur", href: "/pengiriman-retur" },
  { label: "Kebijakan Privasi", href: "/kebijakan-privasi" },
] as const satisfies readonly NavLink[]

export type HeroSlide = {
  readonly image: string
  readonly alt: string
  readonly focus: string
  readonly eyebrow: string
  readonly title: string
  readonly body: string
  readonly cta: NavLink
}

export const HERO_SLIDES = [
  {
    image: "/carousel/shadowgrassblades-15.webp",
    alt: "Dua pemburu berdiri di rawa saat matahari terbit.",
    focus: "72% 40%",
    eyebrow: "Hunting",
    title: "Berangkat sebelum fajar",
    body: "Kamuflase, tas, dan perlengkapan berburu.",
    cta: { label: "Belanja Sekarang", href: "/c/hunting" },
  },
  {
    image: "/carousel/breakupinfinity-2.webp",
    alt: "Dua orang mendayung perahu aluminium di danau yang tenang.",
    focus: "62% 45%",
    eyebrow: "Fishing",
    title: "Air tenang, alat siap",
    body: "Joran, reel, dan aksesoris untuk seharian di air.",
    cta: { label: "Mulai Belanja", href: "/c/fishing" },
  },
  {
    image: "/carousel/brush-16.webp",
    alt: "Pemburu duduk di depan tenda dan api unggun dengan latar gunung bersalju.",
    focus: "58% 50%",
    eyebrow: "Hobbies",
    title: "Bermalam di alam",
    body: "Aksesori dan perlengkapan penunjang untuk aktivitas outdoor",
    cta: { label: "Lihat Produk", href: "/c/hobbies" },
  },
] as const satisfies readonly HeroSlide[]
