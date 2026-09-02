import assert from "node:assert/strict"
import test from "node:test"

import {
  bulkColumns,
  normalizeHeader,
  IMAGE_COLUMN_KEYS,
  UPDATE_COLUMNS,
  UPLOAD_COLUMNS,
} from "../lib/admin/product-bulk/columns"
import { MAX_PRODUCT_IMAGE_BYTES } from "../lib/admin/product-form"
import {
  megabytes,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
} from "../lib/admin/product-bulk/limits"
import { mapHeaderRow } from "../lib/admin/product-bulk/parser"
import { exportText, importText } from "../lib/admin/product-bulk/workbook"

test("upload columns cover every documented field", () => {
  assert.deepEqual(
    UPLOAD_COLUMNS.map(({ key }) => key),
    [
      "name",
      "category",
      "variant",
      "price",
      "compareAtPrice",
      "stock",
      "weight",
      "description",
      ...IMAGE_COLUMN_KEYS,
    ]
  )
  assert.equal(UPLOAD_COLUMNS.length, 14)
  assert.equal(IMAGE_COLUMN_KEYS.length, MAX_IMAGES)
})

test("update columns keep the product id required and the rest optional", () => {
  const required = UPDATE_COLUMNS.filter((column) => column.required)

  assert.deepEqual(
    required.map(({ key }) => key),
    ["id"]
  )
  assert.equal(UPDATE_COLUMNS.length, 13)
  assert.equal(
    UPDATE_COLUMNS.some(({ key }) => key === "variant"),
    false
  )
})

test("upload columns require the first image only", () => {
  const imageColumns = UPLOAD_COLUMNS.filter(({ key }) =>
    IMAGE_COLUMN_KEYS.some((imageKey) => imageKey === key)
  )

  assert.deepEqual(
    imageColumns.map(({ required }) => required),
    [true, false, false, false, false, false]
  )
})

test("header normalization ignores tags, units, casing, and spacing", () => {
  assert.equal(normalizeHeader("Nama Produk\nWAJIB"), "nama produk")
  assert.equal(normalizeHeader("Nama Produk [WAJIB]"), "nama produk")
  assert.equal(normalizeHeader("  berat  (GRAM) "), "berat")
  assert.equal(
    normalizeHeader("Harga Coret / Diskon OPSIONAL"),
    "harga coret diskon"
  )
})

function headerRow(mode: "upload" | "update") {
  return bulkColumns(mode).map(
    (column) => `${column.header}\n${column.required ? "WAJIB" : "OPSIONAL"}`
  )
}

test("header mapping accepts the generated header row", () => {
  const mapping = mapHeaderRow("upload", headerRow("upload"))

  assert.equal(mapping.kind, "columns")
  if (mapping.kind === "columns") {
    assert.equal(mapping.keyByIndex.size, UPLOAD_COLUMNS.length)
    assert.equal(mapping.keyByIndex.get(0), "name")
  }
})

test("header mapping tolerates extra columns", () => {
  const mapping = mapHeaderRow("update", [
    ...headerRow("update"),
    "Catatan Internal",
  ])

  assert.equal(mapping.kind, "columns")
})

test("header mapping rejects a missing required header", () => {
  const headers = headerRow("upload").filter(
    (header) => !header.startsWith("Kategori")
  )
  const mapping = mapHeaderRow("upload", headers)

  assert.equal(mapping.kind, "invalid")
  if (mapping.kind === "invalid") {
    assert.match(mapping.message, /Kategori/)
  }
})

test("header mapping rejects duplicate headers", () => {
  const mapping = mapHeaderRow("upload", [...headerRow("upload"), "Harga"])

  assert.equal(mapping.kind, "invalid")
  if (mapping.kind === "invalid") {
    assert.match(mapping.message, /lebih dari sekali/)
  }
})

test("exported cells neutralise formula triggers and round trip", () => {
  for (const value of ["=SUM(A1)", "+1", "-Produk", "@user", "\tTab"]) {
    const exported = exportText(value)

    assert.equal(exported.startsWith("'"), true)
    assert.equal(importText(exported), value)
  }
})

test("exported cells leave ordinary text untouched", () => {
  for (const value of ["Tenda Camping", "1500000", "hunting"]) {
    assert.equal(exportText(value), value)
    assert.equal(importText(value), value)
  }
})

test("the status column offers only states a workbook may set", () => {
  const state = bulkColumns("update").find((column) => column.key === "state")

  assert.deepEqual(
    state?.choices?.map(({ value }) => value),
    ["active", "inactive", "draft"]
  )
})

test("the remote image limit reuses the product form limit", () => {
  assert.equal(MAX_IMAGE_BYTES, MAX_PRODUCT_IMAGE_BYTES)
  assert.equal(megabytes(MAX_IMAGE_BYTES), 5)
})
