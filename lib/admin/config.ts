import { USER_LINKS, type NavLink } from "@/lib/site/config"

export const ADMIN_ROOT = "/admin"

export type AdminSectionEntry = NavLink & {
  readonly slug: string
  readonly description: string
}

export const ADMIN_SECTIONS = [
  {
    slug: "dashboard",
    label: "Dashboard",
    href: ADMIN_ROOT,
    description: "Ringkasan penjualan, pesanan terbaru, dan stok yang menipis.",
  },
  {
    slug: "orders",
    label: "Pesanan",
    href: `${ADMIN_ROOT}/orders`,
    description: "Kelola pesanan masuk, pembayaran, dan pengiriman.",
  },
  {
    slug: "tracking",
    label: "Lacak Pengiriman",
    href: `${ADMIN_ROOT}/tracking`,
    description: "Periksa status pengiriman dengan nomor resi.",
  },
  {
    slug: "products",
    label: "Produk",
    href: `${ADMIN_ROOT}/products`,
    description: "Kelola katalog, harga, varian, dan stok produk.",
  },
  {
    slug: "finance",
    label: "Keuangan",
    href: `${ADMIN_ROOT}/finance`,
    description: "Pemasukan, pengeluaran, dan rekap keuangan toko.",
  },
] as const satisfies readonly AdminSectionEntry[]

export type AdminSection = (typeof ADMIN_SECTIONS)[number]["slug"]

export function adminSection(slug: AdminSection): AdminSectionEntry {
  const section = ADMIN_SECTIONS.find((entry) => entry.slug === slug)

  if (!section) {
    throw new Error(`Bagian admin tidak dikenal: ${slug}`)
  }

  return section
}

export function isSectionActive({
  pathname,
  href,
}: {
  pathname: string
  href: string
}) {
  return href === ADMIN_ROOT ? pathname === href : pathname.startsWith(href)
}

export const ADMIN_LINK = {
  label: "Konsol Admin",
  href: ADMIN_ROOT,
} as const satisfies NavLink

export function accountMenuLinks(isAdmin: boolean): readonly NavLink[] {
  const links = Object.values(USER_LINKS)
  return isAdmin ? [ADMIN_LINK, ...links] : links
}

export const ADMIN_MENU_LINKS = [
  { label: "Lihat Toko", href: "/" },
  USER_LINKS.account,
  USER_LINKS.logout,
] as const satisfies readonly NavLink[]

export const ALL_FILTER = "all"

export const LOW_STOCK_THRESHOLD = 15
export const DASHBOARD_RECENT_ORDER_LIMIT = 5
export const DASHBOARD_SALES_HISTORY_DAYS = 60

export const DASHBOARD_SALES_PERIODS = [
  { label: "Hari Ini", days: 1 },
  { label: "7 Hari Terakhir", days: 7 },
] as const satisfies readonly {
  readonly label: string
  readonly days: number
}[]

export type SalesMetric = {
  readonly label: string
  readonly amount: number
  readonly orderCount: number
  readonly periodDays: number
  readonly change: number
}

export type MetricTrend = "up" | "down" | "flat"

export function metricTrend(change: number): MetricTrend {
  if (change > 0) {
    return "up"
  }

  if (change < 0) {
    return "down"
  }

  return "flat"
}

export type DailySales = {
  readonly date: string
  readonly amount: number
  readonly orderCount: number
}

export type SalesRange =
  | { readonly kind: "trailing"; readonly label: string; readonly days: number }
  | { readonly kind: "month"; readonly label: string }

export const SALES_RANGES = {
  "7d": { kind: "trailing", label: "7 hari", days: 7 },
  "30d": { kind: "trailing", label: "30 hari", days: 30 },
  month: { kind: "month", label: "Bulan ini" },
} as const satisfies Record<string, SalesRange>

export type SalesRangeKey = keyof typeof SALES_RANGES

export const DEFAULT_SALES_RANGE = "7d" satisfies SalesRangeKey

export function isSalesRangeKey(value: string): value is SalesRangeKey {
  return Object.hasOwn(SALES_RANGES, value)
}

export function salesInRange(
  series: readonly DailySales[],
  key: SalesRangeKey
): readonly DailySales[] {
  const latest = series.at(-1)

  if (!latest) {
    return series
  }

  const range = SALES_RANGES[key]

  switch (range.kind) {
    case "trailing":
      return series.slice(-range.days)
    case "month": {
      const month = latest.date.slice(0, "YYYY-MM".length)
      return series.filter((day) => day.date.startsWith(month))
    }
    default: {
      const _exhaustive: never = range
      return _exhaustive
    }
  }
}

export function salesTotal(series: readonly DailySales[]) {
  return series.reduce((total, day) => total + day.amount, 0)
}

export function salesOrderCount(series: readonly DailySales[]) {
  return series.reduce((total, day) => total + day.orderCount, 0)
}

function dateBefore(date: string, days: number) {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`)

  if (Number.isNaN(timestamp)) {
    throw new Error("Invalid dashboard sales date.")
  }

  return new Date(timestamp - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, date.length)
}

export function fillDailySalesDays({
  series,
  endDate,
  days,
}: {
  readonly series: readonly DailySales[]
  readonly endDate: string
  readonly days: number
}): readonly DailySales[] {
  const safeDays = Math.max(1, Math.floor(days))
  const salesByDate = new Map(series.map((day) => [day.date, day]))

  return Array.from({ length: safeDays }, (_, index) => {
    const date = dateBefore(endDate, safeDays - index - 1)

    return salesByDate.get(date) ?? { date, amount: 0, orderCount: 0 }
  })
}

export function dashboardSalesMetrics(
  series: readonly DailySales[]
): readonly SalesMetric[] {
  return DASHBOARD_SALES_PERIODS.map(({ label, days }) =>
    trailingMetric({ series, label, days })
  )
}

export function trailingMetric({
  series,
  label,
  days,
}: {
  series: readonly DailySales[]
  label: string
  days: number
}): SalesMetric {
  const period = series.slice(-days)
  const previousAmount = salesTotal(series.slice(-days * 2, -days))
  const amount = salesTotal(period)

  return {
    label,
    amount,
    orderCount: salesOrderCount(period),
    periodDays: days,
    change: previousAmount === 0 ? 0 : amount / previousAmount - 1,
  }
}
