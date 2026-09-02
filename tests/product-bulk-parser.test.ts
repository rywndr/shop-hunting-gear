import assert from "node:assert/strict"
import test from "node:test"

import {
  parseUpdateRows,
  parseUploadRows,
} from "../lib/admin/product-bulk/parser"
import type { BulkCell, BulkSheetRow } from "../lib/admin/product-bulk/types"
import type { BulkColumnKey } from "../lib/admin/product-bulk/columns"

const IMAGE = "https://cdn.example.com/foto-1.jpg"

function cell(value: string | number | BulkCell): BulkCell {
  if (typeof value === "number") {
    return { kind: "number", value }
  }

  if (typeof value === "string") {
    return value === "" ? { kind: "empty" } : { kind: "text", value }
  }

  return value
}

function sheetRow(
  values: Partial<Record<BulkColumnKey, string | number | BulkCell>>,
  row = 2
): BulkSheetRow {
  return {
    row,
    cells: Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, cell(value)])
    ),
  }
}

const VALID_UPLOAD = {
  name: "Tenda Camping Ringan",
  category: "hunting",
  price: 150000,
  stock: 12,
  weight: 2500,
  description:
    "Tenda ringan untuk pendakian dua orang dengan lapisan tahan air dan rangka alumunium.",
  image1Url: IMAGE,
} as const satisfies Partial<Record<BulkColumnKey, string | number>>

function uploadRow(
  overrides: Partial<Record<BulkColumnKey, string | number | BulkCell>> = {}
) {
  const [result] = parseUploadRows([
    sheetRow({ ...VALID_UPLOAD, ...overrides }),
  ])

  return result
}

function updateRow(
  overrides: Partial<Record<BulkColumnKey, string | number | BulkCell>> = {}
) {
  const [result] = parseUpdateRows([
    sheetRow({ id: "1700000000123", ...overrides }),
  ])

  return result
}

test("a complete upload row parses into product values", () => {
  const result = uploadRow()

  assert.equal(result?.kind, "valid")
  if (result?.kind === "valid") {
    assert.equal(result.values.name, VALID_UPLOAD.name)
    assert.equal(result.values.category, "hunting")
    assert.equal(result.values.price, 150000)
    assert.equal(result.values.compareAtPrice, null)
    assert.equal(result.values.weight, 2500)
    assert.deepEqual(result.values.imageUrls, [IMAGE])
    assert.deepEqual(result.values.variants, [])
  }
})

test("currency formatting and thousand separators parse as integers", () => {
  const result = uploadRow({ price: "Rp 1.500.000" })

  assert.equal(result?.kind, "valid")
  if (result?.kind === "valid") {
    assert.equal(result.values.price, 1500000)
  }
})

test("variant prices drive the stored product price", () => {
  const result = uploadRow({ variant: "Ukuran: M=120000, L=140000" })

  assert.equal(result?.kind, "valid")
  if (result?.kind === "valid") {
    assert.equal(result.values.price, 120000)
  }
})

test("upload rows reject missing required values", () => {
  for (const key of [
    "name",
    "category",
    "price",
    "stock",
    "weight",
    "description",
    "image1Url",
  ] as const) {
    const result = uploadRow({ [key]: "" })

    assert.equal(result?.kind, "invalid", key)
  }
})

test("upload rows reject an unknown category", () => {
  const result = uploadRow({ category: "outdoor" })

  assert.equal(result?.kind, "invalid")
  if (result?.kind === "invalid") {
    assert.match(result.message, /outdoor/)
  }
})

test("upload rows reject prices below the minimum and fractional numbers", () => {
  assert.equal(uploadRow({ price: 10 })?.kind, "invalid")
  assert.equal(uploadRow({ price: 1500.5 })?.kind, "invalid")
  assert.equal(uploadRow({ price: "150,5" })?.kind, "invalid")
})

test("upload rows reject a compare-at price below the price", () => {
  assert.equal(uploadRow({ compareAtPrice: 150000 })?.kind, "invalid")
  assert.equal(uploadRow({ compareAtPrice: 140000 })?.kind, "invalid")
  assert.equal(uploadRow({ compareAtPrice: 200000 })?.kind, "valid")
})

test("upload rows reject negative stock and zero weight", () => {
  assert.equal(uploadRow({ stock: -1 })?.kind, "invalid")
  assert.equal(uploadRow({ stock: 0 })?.kind, "valid")
  assert.equal(uploadRow({ weight: 0 })?.kind, "invalid")
  assert.equal(uploadRow({ weight: -5 })?.kind, "invalid")
  assert.equal(uploadRow({ weight: 1.5 })?.kind, "invalid")
})

test("upload rows reject formula cells", () => {
  const result = uploadRow({ price: { kind: "formula" } })

  assert.equal(result?.kind, "invalid")
  if (result?.kind === "invalid") {
    assert.match(result.message, /rumus/)
  }
})

test("upload rows reject non-https and malformed image urls", () => {
  assert.equal(
    uploadRow({ image1Url: "http://cdn.example.com/a.jpg" })?.kind,
    "invalid"
  )
  assert.equal(
    uploadRow({ image1Url: "ftp://cdn.example.com/a.jpg" })?.kind,
    "invalid"
  )
  assert.equal(uploadRow({ image1Url: "bukan-url" })?.kind, "invalid")
  assert.equal(
    uploadRow({ image1Url: "https://user:pass@cdn.example.com/a.jpg" })?.kind,
    "invalid"
  )
})

test("upload rows reject a gap between image slots", () => {
  const result = uploadRow({
    image2Url: "",
    image3Url: "https://cdn.example.com/foto-3.jpg",
  })

  assert.equal(result?.kind, "invalid")
  if (result?.kind === "invalid") {
    assert.match(result.message, /berurutan/)
  }
})

test("upload rows accept contiguous image slots", () => {
  const result = uploadRow({
    image2Url: "https://cdn.example.com/foto-2.jpg",
    image3Url: "https://cdn.example.com/foto-3.jpg",
  })

  assert.equal(result?.kind, "valid")
  if (result?.kind === "valid") {
    assert.equal(result.values.imageUrls.length, 3)
  }
})

test("update rows keep blank optional cells undefined", () => {
  const result = updateRow({ stock: 5 })

  assert.equal(result?.kind, "valid")
  if (result?.kind === "valid") {
    assert.equal(result.values.stock, 5)
    assert.equal(result.values.name, undefined)
    assert.equal(result.values.price, undefined)
    assert.equal(result.values.weight, undefined)
    assert.equal(result.values.compareAtPrice, undefined)
    assert.equal(result.values.imageUrls, undefined)
  }
})

test("update rows treat a dash as clearing the compare-at price", () => {
  const result = updateRow({ compareAtPrice: "-" })

  assert.equal(result?.kind, "valid")
  if (result?.kind === "valid") {
    assert.equal(result.values.compareAtPrice, null)
  }
})

test("update rows require the product id", () => {
  const [result] = parseUpdateRows([sheetRow({ id: "", stock: 3 })])

  assert.equal(result?.kind, "invalid")
})

test("update rows reject an unknown listing state", () => {
  const result = updateRow({ state: "tayang" })

  assert.equal(result?.kind, "invalid")
  if (result?.kind === "invalid") {
    assert.match(result.message, /tayang/)
  }
})

test("update rows accept listing state keys and Indonesian labels", () => {
  for (const [value, expected] of [
    ["active", "active"],
    ["Aktif", "active"],
    ["draft", "draft"],
    ["Non-Aktif", "inactive"],
  ] as const) {
    const result = updateRow({ state: value })

    assert.equal(result?.kind, "valid", value)
    if (result?.kind === "valid") {
      assert.equal(result.values.state, expected)
    }
  }
})

test("duplicate product ids in one workbook fail both rows", () => {
  const results = parseUpdateRows([
    sheetRow({ id: "1700000000123", stock: 1 }, 2),
    sheetRow({ id: "1700000000123", stock: 2 }, 3),
  ])

  assert.deepEqual(
    results.map(({ kind }) => kind),
    ["invalid", "invalid"]
  )
  assert.match(
    results[0]?.kind === "invalid" ? results[0].message : "",
    /lebih dari sekali/
  )
})

test("update rows require the first image slot when a gallery is replaced", () => {
  const result = updateRow({
    image2Url: "https://cdn.example.com/foto-2.jpg",
  })

  assert.equal(result?.kind, "invalid")
})

test("update rows reject deleted as a target status", () => {
  for (const value of ["deleted", "Dihapus"]) {
    const result = updateRow({ state: value })

    assert.equal(result?.kind, "invalid", value)
    if (result?.kind === "invalid") {
      assert.match(result.message, /tidak dikenal/)
    }
  }
})
