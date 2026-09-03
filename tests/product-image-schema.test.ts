import assert from "node:assert/strict"
import test from "node:test"

import { storedProductImageSchema } from "../lib/products/schema"

const legacyImage = {
  id: "legacy-image",
  objectKey: "products/legacy/legacy-image.jpg",
  alt: "Foto produk lama",
}

const derivedImage = {
  id: "new-image",
  objectKey: "products/new/new-image/original.jpg",
  thumbnailObjectKey: "products/new/new-image/thumbnail.webp",
  detailObjectKey: "products/new/new-image/detail.webp",
  alt: "Foto produk baru",
}

test("legacy product image metadata remains valid", () => {
  const result = storedProductImageSchema.safeParse(legacyImage)

  assert.equal(result.success, true)
  if (result.success) {
    assert.deepEqual(result.data, legacyImage)
  }
})

test("stored product image metadata accepts a remembered source URL", () => {
  const sourceUrl = "https://cdn.example.com/products/image.jpg"

  assert.equal(
    storedProductImageSchema.safeParse({ ...legacyImage, sourceUrl }).success,
    true
  )
  assert.equal(
    storedProductImageSchema.safeParse({ ...derivedImage, sourceUrl }).success,
    true
  )
})

test("new product image metadata requires both derivatives", () => {
  const result = storedProductImageSchema.safeParse(derivedImage)

  assert.equal(result.success, true)
  if (result.success) {
    assert.deepEqual(result.data, derivedImage)
  }

  assert.equal(
    storedProductImageSchema.safeParse({
      ...derivedImage,
      detailObjectKey: undefined,
    }).success,
    false
  )
})
