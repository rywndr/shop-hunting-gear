import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_PRICE,
  MAX_STOCK,
  MAX_WEIGHT,
  MIN_DESCRIPTION_LENGTH,
  MIN_NAME_LENGTH,
  MIN_PRICE,
} from "@/lib/admin/product-form"
import { descriptionParagraphs } from "@/lib/products/identity"

import {
  bulkColumnByHeader,
  bulkColumns,
  categoryFromCell,
  listingStateFromCell,
  normalizeHeader,
  CLEAR_VALUE,
  IMAGE_COLUMN_KEYS,
  type BulkColumnKey,
  type BulkColumnMeta,
  type BulkColumnMode,
} from "./columns"
import { parseVariantCell } from "./variant"
import type {
  BulkCell,
  BulkParsedRow,
  BulkSheetRow,
  UpdateRowValues,
  UploadRowValues,
} from "./types"

export type HeaderMapping =
  | {
      readonly kind: "columns"
      readonly keyByIndex: ReadonlyMap<number, BulkColumnKey>
    }
  | { readonly kind: "invalid"; readonly message: string }

export function mapHeaderRow(
  mode: BulkColumnMode,
  headers: readonly (string | null)[]
): HeaderMapping {
  const byHeader = bulkColumnByHeader(mode)
  const keyByIndex = new Map<number, BulkColumnKey>()
  const seen = new Set<BulkColumnKey>()

  for (const [index, header] of headers.entries()) {
    const normalized = normalizeHeader(header ?? "")
    const column = normalized === "" ? undefined : byHeader.get(normalized)

    if (!column) {
      continue
    }

    if (seen.has(column.key)) {
      return {
        kind: "invalid",
        message: `Kolom "${column.header}" muncul lebih dari sekali.`,
      }
    }

    seen.add(column.key)
    keyByIndex.set(index, column.key)
  }

  const missing = bulkColumns(mode).filter(({ key }) => !seen.has(key))

  if (missing.length > 0) {
    return {
      kind: "invalid",
      message: `Kolom berikut tidak ditemukan: ${missing
        .map(({ header }) => header)
        .join(", ")}.`,
    }
  }

  return { kind: "columns", keyByIndex }
}

class RowError extends Error {}

function fail(message: string): never {
  throw new RowError(message)
}

type ReadCell =
  | { readonly kind: "empty" }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }

function readCell(
  column: BulkColumnMeta,
  cell: BulkCell | undefined
): ReadCell {
  if (!cell || cell.kind === "empty") {
    return { kind: "empty" }
  }

  switch (cell.kind) {
    case "formula":
      fail(`${column.label} tidak boleh berisi rumus.`)
    case "unsupported":
      fail(`${column.label} berisi nilai yang tidak didukung.`)
    case "number":
      return cell
    case "text": {
      const value = cell.value.trim()
      return value === "" ? { kind: "empty" } : { kind: "text", value }
    }
    default: {
      const _exhaustive: never = cell
      return _exhaustive
    }
  }
}

const THOUSANDS = /^\d{1,3}([.,]\d{3})+$/
const DIGITS = /^\d+$/

function parseInteger(column: BulkColumnMeta, cell: ReadCell): number | null {
  switch (cell.kind) {
    case "empty":
      return null
    case "number":
      if (!Number.isSafeInteger(cell.value)) {
        fail(`${column.label} harus berupa bilangan bulat.`)
      }
      return cell.value
    case "text": {
      const stripped = cell.value.replace(/rp/gi, "").replace(/\s/g, "")
      const digits = THOUSANDS.test(stripped)
        ? stripped.replace(/[.,]/g, "")
        : stripped

      if (!DIGITS.test(digits)) {
        fail(`${column.label} harus berupa bilangan bulat tanpa Rp atau titik.`)
      }

      const parsed = Number(digits)

      if (!Number.isSafeInteger(parsed)) {
        fail(`${column.label} harus berupa bilangan bulat.`)
      }

      return parsed
    }
    default: {
      const _exhaustive: never = cell
      return _exhaustive
    }
  }
}

function parseText(cell: ReadCell): string | null {
  switch (cell.kind) {
    case "empty":
      return null
    case "number":
      return String(cell.value)
    case "text":
      return cell.value
    default: {
      const _exhaustive: never = cell
      return _exhaustive
    }
  }
}

function boundedInteger({
  column,
  value,
  min,
  max,
}: {
  column: BulkColumnMeta
  value: number
  min: number
  max: number
}) {
  if (value < min || value > max) {
    fail(`${column.label} harus antara ${min} dan ${max}.`)
  }

  return value
}

function boundedText({
  column,
  value,
  min,
  max,
}: {
  column: BulkColumnMeta
  value: string
  min: number
  max: number
}) {
  if (value.length < min) {
    fail(`${column.label} minimal ${min} karakter.`)
  }

  if (value.length > max) {
    fail(`${column.label} maksimal ${max} karakter.`)
  }

  return value
}

function imageUrl(column: BulkColumnMeta, value: string) {
  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    return fail(`${column.label} tidak valid.`)
  }

  if (parsed.protocol !== "https:") {
    fail(`${column.label} harus memakai HTTPS.`)
  }

  if (parsed.username !== "" || parsed.password !== "") {
    fail(`${column.label} tidak boleh memuat kredensial.`)
  }

  return parsed.toString()
}

type ColumnReader = {
  readonly column: (key: BulkColumnKey) => BulkColumnMeta
  readonly cell: (key: BulkColumnKey) => ReadCell
}

function columnReader(mode: BulkColumnMode, row: BulkSheetRow): ColumnReader {
  const columns = new Map(
    bulkColumns(mode).map((column) => [column.key, column])
  )

  function column(key: BulkColumnKey) {
    const meta = columns.get(key)

    if (!meta) {
      throw new Error(`Missing bulk column metadata for ${key}.`)
    }

    return meta
  }

  return {
    column,
    cell: (key) => readCell(column(key), row.cells[key]),
  }
}

function imageUrls(reader: ColumnReader, requireFirst: boolean) {
  const slots = IMAGE_COLUMN_KEYS.map((key) => {
    const column = reader.column(key)
    const cell = reader.cell(key)
    const value = parseText(cell)

    return { column, value: value === null ? null : imageUrl(column, value) }
  })
  const filled = slots.filter(({ value }) => value !== null).length

  if (filled === 0) {
    if (requireFirst) {
      fail(`${slots[0]?.column.label ?? "URL Gambar 1"} wajib diisi.`)
    }

    return null
  }

  for (const [index, slot] of slots.entries()) {
    if (index < filled && slot.value === null) {
      fail(
        `${slot.column.label} kosong. Isi URL Gambar berurutan tanpa melewati slot.`
      )
    }
  }

  const urls = slots.flatMap(({ value }) => (value === null ? [] : [value]))
  const [first, ...others] = urls

  if (first === undefined) {
    fail(`${slots[0]?.column.label ?? "URL Gambar 1"} wajib diisi.`)
  }

  return [first, ...others] as const
}

function comparePrice({
  reader,
  price,
  compareAtPrice,
}: {
  reader: ColumnReader
  price: number
  compareAtPrice: number | null
}) {
  if (compareAtPrice !== null && compareAtPrice <= price) {
    fail(
      `${reader.column("compareAtPrice").label} harus lebih besar dari ${
        reader.column("price").label
      }.`
    )
  }
}

function uploadRowValues(row: BulkSheetRow): UploadRowValues {
  const reader = columnReader("upload", row)
  const nameColumn = reader.column("name")
  const name = parseText(reader.cell("name"))

  if (name === null) {
    fail(`${nameColumn.label} wajib diisi.`)
  }

  boundedText({
    column: nameColumn,
    value: name,
    min: MIN_NAME_LENGTH,
    max: MAX_NAME_LENGTH,
  })

  const categoryColumn = reader.column("category")
  const categoryText = parseText(reader.cell("category"))

  if (categoryText === null) {
    fail(`${categoryColumn.label} wajib diisi.`)
  }

  const category = categoryFromCell(categoryText)

  if (!category) {
    fail(`${categoryColumn.label} "${categoryText}" tidak dikenal.`)
  }

  const variantText = parseText(reader.cell("variant")) ?? ""
  const variantResult = parseVariantCell(variantText)

  if (variantResult.kind === "invalid") {
    fail(variantResult.message)
  }

  const priceColumn = reader.column("price")
  const priceValue = parseInteger(priceColumn, reader.cell("price"))

  if (priceValue === null) {
    fail(`${priceColumn.label} wajib diisi.`)
  }

  boundedInteger({
    column: priceColumn,
    value: priceValue,
    min: MIN_PRICE,
    max: MAX_PRICE,
  })

  const variantPrices = variantResult.variants.flatMap(({ options }) =>
    options.map(({ price }) => price)
  )
  const price =
    variantPrices.length > 0 ? Math.min(...variantPrices) : priceValue

  const compareAtPrice =
    optionalInteger({
      column: reader.column("compareAtPrice"),
      cell: reader.cell("compareAtPrice"),
      min: MIN_PRICE,
      max: MAX_PRICE,
    }) ?? null

  comparePrice({ reader, price, compareAtPrice })

  const stockColumn = reader.column("stock")
  const stockValue = parseInteger(stockColumn, reader.cell("stock"))

  if (stockValue === null) {
    fail(`${stockColumn.label} wajib diisi.`)
  }

  const weightColumn = reader.column("weight")
  const weightValue = parseInteger(weightColumn, reader.cell("weight"))

  if (weightValue === null) {
    fail(`${weightColumn.label} wajib diisi.`)
  }

  const descriptionColumn = reader.column("description")
  const descriptionText = parseText(reader.cell("description"))

  if (descriptionText === null) {
    fail(`${descriptionColumn.label} wajib diisi.`)
  }

  boundedText({
    column: descriptionColumn,
    value: descriptionText,
    min: MIN_DESCRIPTION_LENGTH,
    max: MAX_DESCRIPTION_LENGTH,
  })

  const urls = imageUrls(reader, true)

  if (urls === null) {
    fail(`${reader.column("image1Url").label} wajib diisi.`)
  }

  return {
    name,
    category,
    variants: variantResult.variants,
    price,
    compareAtPrice,
    stock: boundedInteger({
      column: stockColumn,
      value: stockValue,
      min: 0,
      max: MAX_STOCK,
    }),
    weight: boundedInteger({
      column: weightColumn,
      value: weightValue,
      min: 1,
      max: MAX_WEIGHT,
    }),
    description: descriptionParagraphs(descriptionText),
    imageUrls: urls,
  }
}

function optionalInteger({
  column,
  cell,
  min,
  max,
}: {
  column: BulkColumnMeta
  cell: ReadCell
  min: number
  max: number
}) {
  const value = parseInteger(column, cell)

  return value === null
    ? undefined
    : boundedInteger({ column, value, min, max })
}

function updateRowValues(row: BulkSheetRow): UpdateRowValues {
  const reader = columnReader("update", row)
  const idColumn = reader.column("id")
  const id = parseText(reader.cell("id"))

  if (id === null) {
    fail(`${idColumn.label} wajib diisi.`)
  }

  const nameColumn = reader.column("name")
  const nameText = parseText(reader.cell("name"))
  const name =
    nameText === null
      ? undefined
      : boundedText({
          column: nameColumn,
          value: nameText,
          min: MIN_NAME_LENGTH,
          max: MAX_NAME_LENGTH,
        })

  const price = optionalInteger({
    column: reader.column("price"),
    cell: reader.cell("price"),
    min: MIN_PRICE,
    max: MAX_PRICE,
  })

  const compareAtColumn = reader.column("compareAtPrice")
  const compareAtCell = reader.cell("compareAtPrice")
  const compareAtPrice =
    compareAtCell.kind === "text" && compareAtCell.value === CLEAR_VALUE
      ? null
      : optionalInteger({
          column: compareAtColumn,
          cell: compareAtCell,
          min: MIN_PRICE,
          max: MAX_PRICE,
        })

  const stock = optionalInteger({
    column: reader.column("stock"),
    cell: reader.cell("stock"),
    min: 0,
    max: MAX_STOCK,
  })

  const weight = optionalInteger({
    column: reader.column("weight"),
    cell: reader.cell("weight"),
    min: 1,
    max: MAX_WEIGHT,
  })

  const stateColumn = reader.column("state")
  const stateText = parseText(reader.cell("state"))
  const state = stateText === null ? undefined : listingStateFromCell(stateText)

  if (stateText !== null && state === undefined) {
    fail(`${stateColumn.label} "${stateText}" tidak dikenal.`)
  }

  const urls = imageUrls(reader, false)

  return {
    id,
    name,
    price,
    compareAtPrice,
    stock,
    weight,
    state,
    imageUrls: urls ?? undefined,
  }
}

function parsedRow<TValues>(
  row: BulkSheetRow,
  read: (row: BulkSheetRow) => TValues
): BulkParsedRow<TValues> {
  try {
    return { kind: "valid", row: row.row, values: read(row) }
  } catch (error) {
    if (error instanceof RowError) {
      return { kind: "invalid", row: row.row, message: error.message }
    }

    throw error
  }
}

export function parseUploadRows(
  rows: readonly BulkSheetRow[]
): readonly BulkParsedRow<UploadRowValues>[] {
  return rows.map((row) => parsedRow(row, uploadRowValues))
}

export function parseUpdateRows(
  rows: readonly BulkSheetRow[]
): readonly BulkParsedRow<UpdateRowValues>[] {
  const parsed = rows.map((row) => parsedRow(row, updateRowValues))
  const counts = new Map<string, number>()

  for (const row of parsed) {
    if (row.kind === "valid") {
      counts.set(row.values.id, (counts.get(row.values.id) ?? 0) + 1)
    }
  }

  return parsed.map((row) =>
    row.kind === "valid" && (counts.get(row.values.id) ?? 0) > 1
      ? {
          kind: "invalid",
          row: row.row,
          message: `ID produk "${row.values.id}" muncul lebih dari sekali dalam file.`,
        }
      : row
  )
}
