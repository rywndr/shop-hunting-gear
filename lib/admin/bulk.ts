import type { Metadata } from "next"

import type { Listing } from "@/lib/admin/catalog"
import { adminSection } from "@/lib/admin/config"
import type { Product } from "@/lib/products/config"

const CATALOG_HREF = adminSection("products").href

type BulkStepMeta = {
  readonly label: string
}

export const BULK_STEPS = {
  download: { label: "Download" },
  upload: { label: "Upload" },
} as const satisfies Record<string, BulkStepMeta>

export type BulkStepKind = keyof typeof BULK_STEPS

export const BULK_STEP_ORDER = [
  "download",
  "upload",
] as const satisfies readonly BulkStepKind[]

export const DEFAULT_BULK_STEP = "download" satisfies BulkStepKind

export function isBulkStep(value: unknown): value is BulkStepKind {
  return typeof value === "string" && Object.hasOwn(BULK_STEPS, value)
}

type ProductColumnKey = keyof Pick<
  Product,
  "name" | "category" | "price" | "compareAtPrice" | "stock" | "description"
>

type ListingColumnKey = keyof Pick<Listing, "id" | "state">

export type BulkColumnKey = ProductColumnKey | ListingColumnKey | "variant"

export type BulkColumnMeta = {
  readonly label: string
  readonly align: "start" | "end"
}

export const BULK_COLUMNS = {
  id: { label: "ID produk", align: "start" },
  name: { label: "Nama produk", align: "start" },
  category: { label: "Kategori", align: "start" },
  variant: { label: "Varian", align: "start" },
  price: { label: "Harga", align: "end" },
  compareAtPrice: { label: "Diskon", align: "end" },
  stock: { label: "Stok", align: "end" },
  description: { label: "Deskripsi", align: "start" },
  state: { label: "Status tayang", align: "start" },
} as const satisfies Record<BulkColumnKey, BulkColumnMeta>

export type BulkColumn = {
  readonly key: BulkColumnKey
  readonly required: boolean
}

export function bulkColumnRequirement(required: boolean) {
  return required ? "Wajib" : "Opsional"
}

type BulkModeConfig = {
  readonly slug: string
  readonly label: string
  readonly description: string
  readonly stepNotes: Readonly<Record<BulkStepKind, string>>
  readonly columns: readonly BulkColumn[]
}

export const BULK_MODES = {
  upload: {
    slug: "mass-upload",
    label: "Mass Upload",
    description: "Tambahkan banyak produk baru sekaligus dari satu file.",
    stepNotes: {
      download: "Isi satu baris template untuk setiap produk baru.",
      upload: "Setiap baris dalam file mewakili satu produk baru.",
    },
    columns: [
      { key: "name", required: true },
      { key: "category", required: true },
      { key: "variant", required: false },
      { key: "price", required: true },
      { key: "compareAtPrice", required: false },
      { key: "stock", required: true },
      { key: "description", required: true },
    ],
  },
  update: {
    slug: "mass-update",
    label: "Mass Update",
    description:
      "Perbarui harga, stok, dan status tayang banyak produk sekaligus.",
    stepNotes: {
      download:
        "Template berisi produk yang sudah ada, ubah kolom yang perlu diperbarui.",
      upload:
        "ID produk menentukan produk yang diperbarui. Kolom kosong tidak mengubah data.",
    },
    columns: [
      { key: "id", required: true },
      { key: "name", required: false },
      { key: "variant", required: false },
      { key: "price", required: false },
      { key: "stock", required: false },
      { key: "state", required: false },
    ],
  },
} as const satisfies Record<string, BulkModeConfig>

export type BulkModeKind = keyof typeof BULK_MODES
export type BulkMode = (typeof BULK_MODES)[BulkModeKind]

export const BULK_MODE_ORDER = [
  "upload",
  "update",
] as const satisfies readonly BulkModeKind[]

export const BULK_FILE_FORMATS = [".xlsx", ".csv"] as const

export function bulkHref({
  mode,
  step,
}: {
  mode: BulkMode
  step: BulkStepKind
}) {
  return `${CATALOG_HREF}/${mode.slug}/${step}`
}

export function bulkMetadata({
  mode,
  step,
}: {
  mode: BulkMode
  step: BulkStepKind
}): Metadata {
  return {
    title: `${mode.label} · ${BULK_STEPS[step].label}`,
    description: mode.stepNotes[step],
  }
}
