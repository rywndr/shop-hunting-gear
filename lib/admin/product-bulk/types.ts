import { z } from "zod"

import { ALL_FILTER } from "@/lib/admin/config"
import type { ListingState } from "@/lib/admin/catalog"
import type { StoredProductVariant } from "@/lib/products/schema"
import type { CategorySlug } from "@/lib/site/config"

import type { BulkColumnKey } from "./columns"

export type BulkCell =
  | { readonly kind: "empty" }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "formula" }
  | { readonly kind: "unsupported" }

export type BulkSheetRow = {
  readonly row: number
  readonly cells: Readonly<Partial<Record<BulkColumnKey, BulkCell>>>
}

export type BulkSheet =
  | { readonly kind: "sheet"; readonly rows: readonly BulkSheetRow[] }
  | { readonly kind: "invalid"; readonly message: string }

export type UploadRowValues = {
  readonly name: string
  readonly category: CategorySlug
  readonly variants: readonly StoredProductVariant[]
  readonly price: number
  readonly compareAtPrice: number | null
  readonly stock: number
  readonly weight: number
  readonly description: readonly [string, ...string[]]
  readonly imageUrls: readonly [string, ...string[]]
}

export type UpdateRowValues = {
  readonly id: string
  readonly name?: string
  readonly price?: number
  readonly compareAtPrice?: number | null
  readonly stock?: number
  readonly weight?: number
  readonly state?: ListingState
  readonly imageUrls?: readonly [string, ...string[]]
}

export type BulkParsedRow<TValues> =
  | { readonly kind: "valid"; readonly row: number; readonly values: TValues }
  | { readonly kind: "invalid"; readonly row: number; readonly message: string }

const rowNumberSchema = z.number().int().positive()

export const bulkRowResultSchema = z.discriminatedUnion("status", [
  z.object({
    row: rowNumberSchema,
    status: z.literal("success"),
    productId: z.string().min(1),
    productName: z.string().optional(),
    message: z.string().optional(),
  }),
  z.object({
    row: rowNumberSchema,
    status: z.literal("error"),
    productId: z.string().min(1).optional(),
    productName: z.string().optional(),
    message: z.string().min(1),
  }),
  z.object({
    row: rowNumberSchema,
    status: z.literal("skipped"),
    productId: z.string().min(1).optional(),
    productName: z.string().optional(),
    message: z.string().min(1),
  }),
])

export type BulkRowResult = z.infer<typeof bulkRowResultSchema>
export type BulkRowStatus = BulkRowResult["status"]

export const bulkImportSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  successful: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  rows: z.array(bulkRowResultSchema),
})

export type BulkImportSummary = z.infer<typeof bulkImportSummarySchema>

export const bulkImportErrorSchema = z.object({ error: z.string().min(1) })

export function bulkImportSummary(
  rows: readonly BulkRowResult[]
): BulkImportSummary {
  return {
    total: rows.length,
    successful: rows.filter(({ status }) => status === "success").length,
    failed: rows.filter(({ status }) => status === "error").length,
    skipped: rows.filter(({ status }) => status === "skipped").length,
    rows: [...rows].sort((first, second) => first.row - second.row),
  }
}

type BulkRowStatusMeta = {
  readonly label: string
  readonly badge: "default" | "destructive" | "secondary"
}

export const BULK_ROW_STATUSES = {
  success: { label: "Berhasil", badge: "default" },
  error: { label: "Gagal", badge: "destructive" },
  skipped: { label: "Dilewati", badge: "secondary" },
} as const satisfies Record<BulkRowStatus, BulkRowStatusMeta>

export type BulkResultFilter = typeof ALL_FILTER | BulkRowStatus

export const BULK_RESULT_FILTER_ORDER = [
  ALL_FILTER,
  "success",
  "error",
  "skipped",
] as const satisfies readonly BulkResultFilter[]

export function isBulkResultFilter(value: unknown): value is BulkResultFilter {
  return (
    value === ALL_FILTER ||
    (typeof value === "string" && Object.hasOwn(BULK_ROW_STATUSES, value))
  )
}

export function bulkResultFilterLabel(filter: BulkResultFilter) {
  return filter === ALL_FILTER ? "Semua" : BULK_ROW_STATUSES[filter].label
}

export function bulkResultFilterCount({
  filter,
  summary,
}: {
  filter: BulkResultFilter
  summary: BulkImportSummary
}) {
  switch (filter) {
    case ALL_FILTER:
      return summary.total
    case "success":
      return summary.successful
    case "error":
      return summary.failed
    case "skipped":
      return summary.skipped
    default: {
      const _exhaustive: never = filter
      return _exhaustive
    }
  }
}
