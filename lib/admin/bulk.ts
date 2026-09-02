import type { Metadata } from "next"

import { adminSection } from "@/lib/admin/config"
import { XLSX_EXTENSION } from "@/lib/admin/product-bulk/limits"

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

type BulkModeConfig = {
  readonly kind: string
  readonly slug: string
  readonly label: string
  readonly description: string
  readonly downloadLabel: string
  readonly importLabel: string
  readonly stepNotes: Readonly<Record<BulkStepKind, string>>
}

export const BULK_MODES = {
  upload: {
    kind: "upload",
    slug: "mass-upload",
    label: "Mass Upload",
    description: "Tambahkan banyak produk baru sekaligus dari satu file.",
    downloadLabel: "Download Template",
    importLabel: "Mulai Import",
    stepNotes: {
      download: "Isi satu baris template untuk setiap produk baru.",
      upload: "Setiap baris dalam file mewakili satu produk baru.",
    },
  },
  update: {
    kind: "update",
    slug: "mass-update",
    label: "Mass Update",
    description:
      "Perbarui harga, stok, berat, dan status tayang banyak produk sekaligus.",
    downloadLabel: "Download Produk",
    importLabel: "Mulai Update",
    stepNotes: {
      download:
        "File berisi produk yang sudah ada, ubah kolom yang perlu diperbarui.",
      upload:
        "ID produk menentukan produk yang diperbarui. Kolom kosong tidak mengubah data.",
    },
  },
} as const satisfies Record<string, BulkModeConfig>

export type BulkModeKind = keyof typeof BULK_MODES
export type BulkMode = (typeof BULK_MODES)[BulkModeKind]

export const BULK_MODE_ORDER = [
  "upload",
  "update",
] as const satisfies readonly BulkModeKind[]

export function isBulkMode(value: unknown): value is BulkModeKind {
  return typeof value === "string" && Object.hasOwn(BULK_MODES, value)
}

export const BULK_FILE_FORMATS = [XLSX_EXTENSION] as const

export const BULK_IMPORT_FIELD = "file"

const FILE_NAME_DATE = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Jakarta",
})

export function bulkFileName(mode: BulkModeKind) {
  switch (mode) {
    case "upload":
      return `template-mass-upload-produk${XLSX_EXTENSION}`
    case "update":
      return `mass-update-produk-${FILE_NAME_DATE.format(new Date())}${XLSX_EXTENSION}`
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

export function bulkHref({
  mode,
  step,
}: {
  mode: BulkMode
  step: BulkStepKind
}) {
  return `${CATALOG_HREF}/${mode.slug}/${step}`
}

export function bulkTemplateHref(mode: BulkMode) {
  return `/api/admin/products/bulk/${mode.kind}/template`
}

export function bulkImportHref(mode: BulkMode) {
  return `/api/admin/products/bulk/${mode.kind}/import`
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
