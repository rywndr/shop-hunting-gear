import { ALL_FILTER } from "@/lib/admin/config"
import type { OrderStatusMeta } from "@/lib/orders/config"
import type { Product } from "@/lib/products/config"
import { categoryBySlug, type CategorySlug } from "@/lib/site/config"

type BadgeVariant = OrderStatusMeta["badge"]

export type ListingStateMeta = {
  readonly label: string
  readonly badge: BadgeVariant
  readonly editable: boolean
  readonly actions: readonly ListingActionKind[]
}

export const LISTING_ACTIONS = {
  activate: { label: "Aktifkan" },
  deactivate: { label: "Nonaktifkan" },
  delete: { label: "Hapus" },
  restore: { label: "Pulihkan" },
} as const satisfies Record<string, { readonly label: string }>

export type ListingActionKind = keyof typeof LISTING_ACTIONS

export const LISTING_STATES = {
  active: {
    label: "Aktif",
    badge: "default",
    editable: true,
    actions: ["deactivate", "delete"],
  },
  inactive: {
    label: "Non-Aktif",
    badge: "secondary",
    editable: true,
    actions: ["activate", "delete"],
  },
  draft: {
    label: "Draf",
    badge: "outline",
    editable: true,
    actions: ["delete"],
  },
  deleted: {
    label: "Dihapus",
    badge: "destructive",
    editable: false,
    actions: ["restore"],
  },
} as const satisfies Record<string, ListingStateMeta>

export type ListingState = keyof typeof LISTING_STATES

export type ListingProduct = Pick<
  Product,
  "category" | "name" | "price" | "slug" | "stock" | "variants"
>

export type Listing<TProduct extends ListingProduct = ListingProduct> = {
  readonly id: string
  readonly uploadedAt: string
  readonly updatedAt: string
  readonly product: TProduct
  readonly state: ListingState
}

export function listingVariantNames(listing: Listing): readonly string[] {
  if (listing.product.variants.length === 0) {
    return []
  }

  return listing.product.variants.reduce<readonly string[]>(
    (combinations, variant) =>
      combinations.flatMap((combination) =>
        variant.options.map((option) =>
          [combination, option].filter(Boolean).join(" / ")
        )
      ),
    [""]
  )
}

export type ListingStateFilter = typeof ALL_FILTER | ListingState
export type ListingCategoryFilter = typeof ALL_FILTER | CategorySlug

export const LISTING_STATE_FILTER_ORDER = [
  ALL_FILTER,
  "active",
  "inactive",
  "draft",
  "deleted",
] as const satisfies readonly ListingStateFilter[]

export const LISTING_TABS = {
  all: ALL_FILTER,
  active: "active",
  deactivate: "inactive",
  draft: "draft",
  deleted: "deleted",
} as const satisfies Record<string, ListingStateFilter>

export type ListingTab = keyof typeof LISTING_TABS

export function listingTab(filter: ListingStateFilter): ListingTab {
  switch (filter) {
    case ALL_FILTER:
      return "all"
    case "active":
      return "active"
    case "inactive":
      return "deactivate"
    case "draft":
      return "draft"
    case "deleted":
      return "deleted"
    default: {
      const _exhaustive: never = filter
      return _exhaustive
    }
  }
}

export function listingFilterFromTab(tab: string | null): ListingStateFilter {
  switch (tab) {
    case "active":
      return LISTING_TABS.active
    case "deactivate":
      return LISTING_TABS.deactivate
    case "draft":
      return LISTING_TABS.draft
    case "deleted":
      return LISTING_TABS.deleted
    case "all":
    default:
      return LISTING_TABS.all
  }
}

export type SelectionActionLayout =
  | {
      readonly kind: "button"
      readonly action: ListingActionKind
    }
  | {
      readonly kind: "menu"
      readonly actions: readonly ListingActionKind[]
    }
  | {
      readonly kind: "button-menu"
      readonly action: ListingActionKind
      readonly menuActions: readonly ListingActionKind[]
    }

export const SELECTION_ACTIONS = {
  all: { kind: "menu", actions: ["deactivate", "delete"] },
  active: { kind: "menu", actions: ["deactivate", "delete"] },
  inactive: {
    kind: "button-menu",
    action: "activate",
    menuActions: ["delete"],
  },
  draft: { kind: "menu", actions: ["delete"] },
  deleted: { kind: "button", action: "restore" },
} as const satisfies Record<ListingStateFilter, SelectionActionLayout>

export function isListingStateFilter(
  value: unknown
): value is ListingStateFilter {
  return (
    value === ALL_FILTER ||
    (typeof value === "string" && Object.hasOwn(LISTING_STATES, value))
  )
}

export function listingStateFilterLabel(filter: ListingStateFilter) {
  return filter === ALL_FILTER ? "Semua" : LISTING_STATES[filter].label
}

export function listingCategoryFilterLabel(filter: ListingCategoryFilter) {
  return filter === ALL_FILTER ? "Semua Kategori" : categoryBySlug(filter).label
}

export const SORT_DIRECTIONS = {
  asc: "terendah",
  desc: "tertinggi",
} as const satisfies Record<string, string>

export type SortDirection = keyof typeof SORT_DIRECTIONS

export type ListingSortColumnMeta = {
  readonly label: string
  readonly directionLabels: Readonly<Record<SortDirection, string>>
  readonly value: (listing: Listing) => number
}

export const LISTING_SORT_COLUMNS = {
  status: {
    label: "Status",
    directionLabels: { asc: "terlama", desc: "terbaru" },
    value: (listing) => Date.parse(listing.updatedAt),
  },
  price: {
    label: "Harga",
    directionLabels: SORT_DIRECTIONS,
    value: (listing) => listing.product.price,
  },
  stock: {
    label: "Stok",
    directionLabels: SORT_DIRECTIONS,
    value: (listing) => listing.product.stock,
  },
} as const satisfies Record<string, ListingSortColumnMeta>

export type ListingSortColumn = keyof typeof LISTING_SORT_COLUMNS

export type ListingSort = {
  readonly column: ListingSortColumn
  readonly direction: SortDirection
}

export type ListingSortKey = `${ListingSortColumn}-${SortDirection}`

export const LISTING_SORTS = {
  "status-asc": { column: "status", direction: "asc" },
  "status-desc": { column: "status", direction: "desc" },
  "price-asc": { column: "price", direction: "asc" },
  "price-desc": { column: "price", direction: "desc" },
  "stock-asc": { column: "stock", direction: "asc" },
  "stock-desc": { column: "stock", direction: "desc" },
} as const satisfies Record<ListingSortKey, ListingSort>

export const LISTING_SORT_ORDER = [
  "status-asc",
  "status-desc",
  "price-asc",
  "price-desc",
  "stock-asc",
  "stock-desc",
] as const satisfies readonly ListingSortKey[]

export function listingSortKey(sort: ListingSort): ListingSortKey {
  return `${sort.column}-${sort.direction}`
}

export function listingSortLabel(sort: ListingSort) {
  const { label, directionLabels } = LISTING_SORT_COLUMNS[sort.column]

  return `${label} ${directionLabels[sort.direction]}`
}

export type ListingQuery = {
  readonly state: ListingStateFilter
  readonly category: ListingCategoryFilter
  readonly search: string
  readonly sort: ListingSort | null
}

function matchesState(listing: Listing, filter: ListingStateFilter) {
  return filter === ALL_FILTER
    ? listing.state !== "deleted"
    : listing.state === filter
}

function sortListings(
  listings: readonly Listing[],
  sort: ListingSort
): readonly Listing[] {
  const { value } = LISTING_SORT_COLUMNS[sort.column]
  const direction = sort.direction === "asc" ? 1 : -1

  return [...listings].sort((a, b) => (value(a) - value(b)) * direction)
}

export function queryListings(
  listings: readonly Listing[],
  query: ListingQuery
): readonly Listing[] {
  const search = query.search.trim().toLocaleLowerCase("id-ID")
  const matched = listings.filter(
    (listing) =>
      matchesState(listing, query.state) &&
      (query.category === ALL_FILTER ||
        listing.product.category === query.category) &&
      listing.product.name.toLocaleLowerCase("id-ID").includes(search)
  )

  return query.sort === null ? matched : sortListings(matched, query.sort)
}

export function listingForTable(
  listing: Listing<Product>
): Listing<ListingProduct> {
  const { category, name, price, slug, stock, variants } = listing.product

  return {
    id: listing.id,
    uploadedAt: listing.uploadedAt,
    updatedAt: listing.updatedAt,
    state: listing.state,
    product: { category, name, price, slug, stock, variants },
  }
}
