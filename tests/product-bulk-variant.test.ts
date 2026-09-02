import assert from "node:assert/strict"
import test from "node:test"

import {
  parseVariantCell,
  serializeVariants,
} from "../lib/admin/product-bulk/variant"
import type { StoredProductVariant } from "../lib/products/schema"

test("an empty variant cell means no variants", () => {
  const result = parseVariantCell("   ")

  assert.equal(result.kind, "variants")
  if (result.kind === "variants") {
    assert.deepEqual(result.variants, [])
  }
})

test("variant cells parse values, prices, and optional weights", () => {
  const result = parseVariantCell(
    "Ukuran: M=150000/500, L=165.000 | Warna: Hitam=150000"
  )

  assert.equal(result.kind, "variants")
  if (result.kind === "variants") {
    assert.deepEqual(result.variants, [
      {
        label: "Ukuran",
        options: [
          { value: "M", price: 150000, weight: 500, imageId: null },
          { value: "L", price: 165000, weight: null, imageId: null },
        ],
      },
      {
        label: "Warna",
        options: [
          { value: "Hitam", price: 150000, weight: null, imageId: null },
        ],
      },
    ])
  }
})

test("variants round trip through the serializer", () => {
  const variants = [
    {
      label: "Ukuran",
      options: [
        { value: "M", price: 150000, weight: 500, imageId: null },
        { value: "L", price: 165000, weight: null, imageId: null },
      ],
    },
    {
      label: "Warna",
      options: [{ value: "Hitam", price: 150000, weight: 600, imageId: null }],
    },
  ] as const satisfies readonly StoredProductVariant[]
  const serialized = serializeVariants(variants)

  assert.equal(typeof serialized, "string")
  const parsed = parseVariantCell(serialized ?? "")

  assert.equal(parsed.kind, "variants")
  if (parsed.kind === "variants") {
    assert.deepEqual(parsed.variants, variants)
  }
})

test("the serializer refuses variants that reference an option photo", () => {
  assert.equal(
    serializeVariants([
      {
        label: "Ukuran",
        options: [
          { value: "M", price: 150000, weight: null, imageId: "img-1" },
        ],
      },
    ]),
    null
  )
})

test("variant cells reject missing prices, duplicates, and bad numbers", () => {
  for (const cell of [
    "Ukuran: M",
    "Ukuran M=150000",
    "Ukuran: M=150000, M=160000",
    "Ukuran: M=50",
    "Ukuran: M=150000/0",
    "Ukuran: M=abc",
    "Ukuran: M=150000/500/600",
    "Ukuran: M=150000 | Ukuran: L=160000",
    "A: x=150000 | B: y=150000 | C: z=150000",
  ]) {
    assert.equal(parseVariantCell(cell).kind, "invalid", cell)
  }
})
