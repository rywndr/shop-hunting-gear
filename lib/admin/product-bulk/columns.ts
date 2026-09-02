import {
  isListingState,
  LISTING_STATES,
  type ListingState,
} from "@/lib/admin/catalog"
import { CATEGORIES, type CategorySlug } from "@/lib/site/config"

export const IMAGE_COLUMN_KEYS = [
  "image1Url",
  "image2Url",
  "image3Url",
  "image4Url",
  "image5Url",
  "image6Url",
] as const

export type BulkImageColumnKey = (typeof IMAGE_COLUMN_KEYS)[number]

export type BulkColumnKey =
  | "id"
  | "name"
  | "category"
  | "variant"
  | "price"
  | "compareAtPrice"
  | "stock"
  | "weight"
  | "description"
  | "state"
  | BulkImageColumnKey

export type BulkColumnType =
  "id" | "text" | "longText" | "integer" | "enum" | "url"

export type BulkColumnChoice = {
  readonly value: string
  readonly label: string
}

export type BulkColumnMeta = {
  readonly key: BulkColumnKey
  readonly label: string
  readonly header: string
  readonly required: boolean
  readonly type: BulkColumnType
  readonly align: "start" | "end"
  readonly width: number
  readonly choices?: readonly BulkColumnChoice[]
  readonly help?: string
}

export const CATEGORY_CHOICES = CATEGORIES.map(({ slug, label }) => ({
  value: slug,
  label,
})) satisfies readonly BulkColumnChoice[]

export const STATE_CHOICES = Object.entries(LISTING_STATES).map(
  ([value, { label }]) => ({ value, label })
) satisfies readonly BulkColumnChoice[]

export const CLEAR_VALUE = "-"

function imageColumn(
  key: BulkImageColumnKey,
  slot: number,
  required: boolean
): BulkColumnMeta {
  return {
    key,
    label: `URL Gambar ${slot}`,
    header: `URL Gambar ${slot}`,
    required,
    type: "url",
    align: "start",
    width: 34,
    help:
      slot === 1
        ? "Tautan HTTPS publik ke foto utama. Format JPG, PNG, atau WebP."
        : "Tautan HTTPS publik. Isi berurutan tanpa melewati slot.",
  }
}

const NAME_COLUMN = {
  key: "name",
  label: "Nama Produk",
  header: "Nama Produk",
  type: "text",
  align: "start",
  width: 34,
  help: "Minimal 5 karakter.",
} as const satisfies Omit<BulkColumnMeta, "required">

const PRICE_COLUMN = {
  key: "price",
  label: "Harga",
  header: "Harga",
  type: "integer",
  align: "end",
  width: 14,
  help: "Angka bulat tanpa Rp atau titik.",
} as const satisfies Omit<BulkColumnMeta, "required">

const COMPARE_AT_PRICE_COLUMN = {
  key: "compareAtPrice",
  label: "Harga Coret / Diskon",
  header: "Harga Coret / Diskon",
  type: "integer",
  align: "end",
  width: 18,
  help: "Harus lebih besar dari Harga.",
} as const satisfies Omit<BulkColumnMeta, "required">

const STOCK_COLUMN = {
  key: "stock",
  label: "Stok",
  header: "Stok",
  type: "integer",
  align: "end",
  width: 10,
  help: "Angka bulat minimal 0.",
} as const satisfies Omit<BulkColumnMeta, "required">

const WEIGHT_COLUMN = {
  key: "weight",
  label: "Berat (gram)",
  header: "Berat (gram)",
  type: "integer",
  align: "end",
  width: 14,
  help: "Angka bulat dalam gram, minimal 1.",
} as const satisfies Omit<BulkColumnMeta, "required">

export const UPLOAD_COLUMNS = [
  { ...NAME_COLUMN, required: true },
  {
    key: "category",
    label: "Kategori",
    header: "Kategori",
    required: true,
    type: "enum",
    align: "start",
    width: 16,
    choices: CATEGORY_CHOICES,
    help: "Pilih salah satu kategori yang tersedia.",
  },
  {
    key: "variant",
    label: "Varian",
    header: "Varian",
    required: false,
    type: "text",
    align: "start",
    width: 40,
    help: "Format: Label: pilihan=harga/berat, pilihan=harga",
  },
  { ...PRICE_COLUMN, required: true },
  { ...COMPARE_AT_PRICE_COLUMN, required: false },
  { ...STOCK_COLUMN, required: true },
  { ...WEIGHT_COLUMN, required: true },
  {
    key: "description",
    label: "Deskripsi",
    header: "Deskripsi",
    required: true,
    type: "longText",
    align: "start",
    width: 48,
    help: "Minimal 30 karakter.",
  },
  ...IMAGE_COLUMN_KEYS.map((key, index) =>
    imageColumn(key, index + 1, index === 0)
  ),
] as const satisfies readonly BulkColumnMeta[]

export const UPDATE_COLUMNS = [
  {
    key: "id",
    label: "ID Produk",
    header: "ID Produk",
    required: true,
    type: "id",
    align: "start",
    width: 20,
    help: "Jangan diubah. Kolom ini menentukan produk yang diperbarui.",
  },
  { ...NAME_COLUMN, required: false },
  { ...PRICE_COLUMN, required: false },
  { ...COMPARE_AT_PRICE_COLUMN, required: false },
  { ...STOCK_COLUMN, required: false },
  { ...WEIGHT_COLUMN, required: false },
  {
    key: "state",
    label: "Status Tayang",
    header: "Status Tayang",
    required: false,
    type: "enum",
    align: "start",
    width: 16,
    choices: STATE_CHOICES,
    help: "Pilih salah satu status yang tersedia.",
  },
  ...IMAGE_COLUMN_KEYS.map((key, index) => imageColumn(key, index + 1, false)),
] as const satisfies readonly BulkColumnMeta[]

export type BulkColumnMode = "upload" | "update"

export function bulkColumns(mode: BulkColumnMode): readonly BulkColumnMeta[] {
  switch (mode) {
    case "upload":
      return UPLOAD_COLUMNS
    case "update":
      return UPDATE_COLUMNS
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

export function bulkColumnRequirement(required: boolean) {
  return required ? "Wajib" : "Opsional"
}

export function bulkColumnTag(required: boolean) {
  return required ? "WAJIB" : "OPSIONAL"
}

/** Ignores workbook hints, letter case, and spacing when matching headers. */
export function normalizeHeader(value: string) {
  return value
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\b(wajib|opsional)\b/gi, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function bulkColumnByHeader(
  mode: BulkColumnMode
): ReadonlyMap<string, BulkColumnMeta> {
  return new Map(
    bulkColumns(mode).map((column) => [normalizeHeader(column.header), column])
  )
}

export function categoryFromCell(value: string): CategorySlug | undefined {
  const normalized = value.trim().toLowerCase()

  for (const { slug, label } of CATEGORIES) {
    if (slug === normalized || label.toLowerCase() === normalized) {
      return slug
    }
  }

  return undefined
}

export function listingStateFromCell(value: string): ListingState | undefined {
  const normalized = value.trim().toLowerCase()

  for (const [state, { label }] of Object.entries(LISTING_STATES)) {
    if (
      isListingState(state) &&
      (state === normalized || label.toLowerCase() === normalized)
    ) {
      return state
    }
  }

  return undefined
}
