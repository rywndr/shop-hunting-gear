import assert from "node:assert/strict"
import test from "node:test"
import sharp from "sharp"

import { bulkColumns } from "../lib/admin/product-bulk/columns"
import {
  RemoteImageError,
  type RemoteImage,
} from "../lib/admin/product-bulk/remote-image"
import {
  runBulkUpdate,
  runBulkUpload,
  type BulkDependencies,
} from "../lib/admin/product-bulk/service"
import { bulkWorkbookBytes } from "../lib/admin/product-bulk/workbook"
import type { BulkProduct } from "../lib/products/service"
import type { StoredProductImage } from "../lib/products/schema"

const IMAGE_ONE = "https://cdn.example.com/foto-1.jpg"
const IMAGE_TWO = "https://cdn.example.com/foto-2.jpg"

const UPLOAD_ROW = {
  name: "Tenda Camping Ringan",
  category: "hunting",
  price: 150000,
  stock: 12,
  weight: 2500,
  description:
    "Tenda ringan dua orang dengan lapisan tahan air dan rangka kuat.",
  image1Url: IMAGE_ONE,
} as const

let pixels: Uint8Array | undefined

async function imageBytes() {
  pixels ??= new Uint8Array(
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer()
  )

  return pixels
}

function storedImage(id: string): StoredProductImage {
  return {
    id,
    objectKey: `products/p/${id}/original.png`,
    thumbnailObjectKey: `products/p/${id}/thumbnail.webp`,
    detailObjectKey: `products/p/${id}/detail.webp`,
    alt: `foto ${id}`,
  }
}

type Recorder = {
  readonly uploaded: string[]
  readonly deleted: string[][]
  readonly created: unknown[]
  readonly updated: {
    productId: string
    values: Record<string, unknown>
    state?: string
  }[]
  revalidated: number
}

function dependencies({
  products = new Map<string, BulkProduct>(),
  fetchImage,
  uploadImage,
  updateProduct,
  createProduct,
}: {
  products?: ReadonlyMap<string, BulkProduct>
  fetchImage?: (url: string) => Promise<RemoteImage>
  uploadImage?: BulkDependencies["uploadImage"]
  updateProduct?: BulkDependencies["updateProduct"]
  createProduct?: BulkDependencies["createProduct"]
} = {}): { deps: BulkDependencies; recorder: Recorder } {
  const recorder: Recorder = {
    uploaded: [],
    deleted: [],
    created: [],
    updated: [],
    revalidated: 0,
  }

  const deps: BulkDependencies = {
    fetchImage:
      fetchImage ??
      (async () => ({ bytes: await imageBytes(), mime: "image/png" })),
    uploadImage:
      uploadImage ??
      (async ({ id, alt }) => {
        recorder.uploaded.push(id)
        return { ...storedImage(id), alt }
      }),
    deleteImages: async (objectKeys) => {
      recorder.deleted.push([...objectKeys])
    },
    createProduct:
      createProduct ??
      (async (input) => {
        recorder.created.push(input)
        return input.id
      }),
    updateProduct:
      updateProduct ??
      (async (input) => {
        recorder.updated.push({
          productId: input.productId,
          values: { ...input.values },
          state: input.state,
        })
      }),
    loadProducts: async () => products,
    revalidate: () => {
      recorder.revalidated += 1
    },
  }

  return { deps, recorder }
}

function uploadWorkbook(
  rows: readonly Partial<Record<string, string | number | null>>[]
) {
  return bulkWorkbookBytes({ mode: "upload", rows })
}

function updateWorkbook(
  rows: readonly Partial<Record<string, string | number | null>>[]
) {
  return bulkWorkbookBytes({ mode: "update", rows })
}

function bulkProduct(overrides: Partial<BulkProduct> = {}): BulkProduct {
  return {
    id: "1700000000123",
    name: "Tenda Camping Ringan",
    price: 150000,
    compareAtPrice: null,
    stock: 10,
    weight: 2500,
    state: "active",
    images: [storedImage("old-1")],
    variants: [],
    ...overrides,
  }
}

test("valid rows import while an invalid row fails on its own", async () => {
  const bytes = await uploadWorkbook([
    UPLOAD_ROW,
    { ...UPLOAD_ROW, name: "Ransel Hunting 45L", category: "outdoor" },
    { ...UPLOAD_ROW, name: "Ransel Hunting 45L", image2Url: IMAGE_TWO },
  ])
  const { deps, recorder } = dependencies()
  const result = await runBulkUpload(bytes, deps)

  assert.equal(result.kind, "summary")
  if (result.kind === "summary") {
    assert.equal(result.summary.total, 3)
    assert.equal(result.summary.successful, 2)
    assert.equal(result.summary.failed, 1)
    assert.equal(result.summary.rows.map(({ row }) => row).join(","), "2,3,4")
    assert.match(
      result.summary.rows[1]?.message ?? "",
      /Kategori "outdoor" tidak dikenal/
    )
  }

  assert.equal(recorder.created.length, 2)
  assert.equal(recorder.uploaded.length, 3)
  assert.equal(recorder.revalidated, 1)
})

test("new products land as drafts with a generated id and slug", async () => {
  const bytes = await uploadWorkbook([UPLOAD_ROW])
  const { deps, recorder } = dependencies()
  await runBulkUpload(bytes, deps)

  const [created] = recorder.created as {
    id: string
    slug: string
    state: string
    images: readonly StoredProductImage[]
    description: readonly string[]
  }[]

  assert.equal(created?.state, "draft")
  assert.match(created?.id ?? "", /^\d+$/)
  assert.match(created?.slug ?? "", /^tenda-camping-ringan-\d{8}$/)
  assert.equal(created?.images.length, 1)
  assert.equal(created?.description.length, 1)
})

test("a failing later image cleans up the images already uploaded", async () => {
  const bytes = await uploadWorkbook([{ ...UPLOAD_ROW, image2Url: IMAGE_TWO }])
  const { deps, recorder } = dependencies({
    fetchImage: async (url) => {
      if (url === IMAGE_TWO) {
        throw new RemoteImageError({ failure: "unreachable" })
      }

      return { bytes: await imageBytes(), mime: "image/png" }
    },
  })
  const result = await runBulkUpload(bytes, deps)

  assert.equal(result.kind, "summary")
  if (result.kind === "summary") {
    assert.equal(result.summary.failed, 1)
    assert.equal(
      result.summary.rows[0]?.message,
      "Gambar 2 tidak dapat diunduh."
    )
  }

  assert.equal(recorder.created.length, 0)
  assert.deepEqual(recorder.deleted.length, 1)
  assert.equal(recorder.deleted[0]?.length, 3)
  assert.equal(recorder.revalidated, 0)
})

test("a database failure cleans up the images uploaded for that row", async () => {
  const bytes = await uploadWorkbook([UPLOAD_ROW])
  const { deps, recorder } = dependencies({
    createProduct: async () => {
      throw new Error("insert failed")
    },
  })
  const result = await runBulkUpload(bytes, deps)

  assert.equal(result.kind, "summary")
  if (result.kind === "summary") {
    assert.equal(result.summary.failed, 1)
    assert.match(result.summary.rows[0]?.message ?? "", /belum tersimpan/)
  }

  assert.equal(recorder.deleted[0]?.length, 3)
})

test("an unknown product id fails without touching the database", async () => {
  const bytes = await updateWorkbook([{ id: "9999", stock: 4 }])
  const { deps, recorder } = dependencies()
  const result = await runBulkUpdate(bytes, deps)

  assert.equal(result.kind, "summary")
  if (result.kind === "summary") {
    assert.equal(result.summary.failed, 1)
    assert.equal(result.summary.rows[0]?.message, "ID produk tidak ditemukan.")
  }

  assert.equal(recorder.updated.length, 0)
})

test("a row without effective changes is skipped", async () => {
  const current = bulkProduct()
  const bytes = await updateWorkbook([
    {
      id: current.id,
      name: current.name,
      price: current.price,
      stock: current.stock,
      weight: current.weight,
      state: current.state,
    },
  ])
  const { deps, recorder } = dependencies({
    products: new Map([[current.id, current]]),
  })
  const result = await runBulkUpdate(bytes, deps)

  assert.equal(result.kind, "summary")
  if (result.kind === "summary") {
    assert.equal(result.summary.skipped, 1)
    assert.equal(result.summary.rows[0]?.message, "Tidak ada perubahan.")
  }

  assert.equal(recorder.updated.length, 0)
  assert.equal(recorder.revalidated, 0)
})

test("blank optional cells preserve the current values", async () => {
  const current = bulkProduct({ compareAtPrice: 199000 })
  const bytes = await updateWorkbook([{ id: current.id, stock: 3 }])
  const { deps, recorder } = dependencies({
    products: new Map([[current.id, current]]),
  })
  const result = await runBulkUpdate(bytes, deps)

  assert.equal(result.kind, "summary")
  if (result.kind === "summary") {
    assert.equal(result.summary.successful, 1)
  }

  assert.deepEqual(recorder.updated[0]?.values, { stock: 3 })
  assert.equal(recorder.updated[0]?.state, undefined)
})

test("a new price that invalidates the stored compare-at price fails the row", async () => {
  const current = bulkProduct({ compareAtPrice: 160000 })
  const bytes = await updateWorkbook([{ id: current.id, price: 180000 }])
  const { deps, recorder } = dependencies({
    products: new Map([[current.id, current]]),
  })
  const result = await runBulkUpdate(bytes, deps)

  assert.equal(result.kind, "summary")
  if (result.kind === "summary") {
    assert.equal(
      result.summary.rows[0]?.message,
      "Harga Coret / Diskon harus lebih besar dari Harga."
    )
  }

  assert.equal(recorder.updated.length, 0)
})

test("a deleted product is never resurrected by an update row", async () => {
  const current = bulkProduct({ state: "deleted" })
  const bytes = await updateWorkbook([
    { id: current.id, state: "active", stock: 7 },
  ])
  const { deps, recorder } = dependencies({
    products: new Map([[current.id, current]]),
  })
  const result = await runBulkUpdate(bytes, deps)

  assert.equal(result.kind, "summary")
  if (result.kind === "summary") {
    assert.match(result.summary.rows[0]?.message ?? "", /Dihapus/)
  }

  assert.equal(recorder.updated.length, 0)
})

test("blank image columns keep the stored gallery untouched", async () => {
  const current = bulkProduct()
  const bytes = await updateWorkbook([{ id: current.id, stock: 2 }])
  const { deps, recorder } = dependencies({
    products: new Map([[current.id, current]]),
  })
  await runBulkUpdate(bytes, deps)

  assert.equal(recorder.uploaded.length, 0)
  assert.equal(recorder.deleted.length, 0)
  assert.equal("images" in (recorder.updated[0]?.values ?? {}), false)
})

test("populated image columns replace the gallery and drop the old objects last", async () => {
  const current = bulkProduct({
    variants: [
      {
        label: "Ukuran",
        options: [
          { value: "M", price: 150000, weight: 500, imageId: "old-1" },
          { value: "L", price: 160000, weight: null, imageId: null },
        ],
      },
    ],
  })
  const order: string[] = []
  const bytes = await updateWorkbook([
    { id: current.id, image1Url: IMAGE_ONE, image2Url: IMAGE_TWO },
  ])
  const { deps, recorder } = dependencies({
    products: new Map([[current.id, current]]),
    updateProduct: async () => {
      order.push("update")
    },
  })
  const tracked: BulkDependencies = {
    ...deps,
    deleteImages: async (objectKeys) => {
      order.push("delete")
      recorder.deleted.push([...objectKeys])
    },
  }
  const result = await runBulkUpdate(bytes, tracked)

  assert.equal(result.kind, "summary")
  if (result.kind === "summary") {
    assert.equal(result.summary.successful, 1)
  }

  assert.deepEqual(order, ["update", "delete"])
  assert.equal(recorder.uploaded.length, 2)
  assert.deepEqual(recorder.deleted[0], [
    "products/p/old-1/original.png",
    "products/p/old-1/thumbnail.webp",
    "products/p/old-1/detail.webp",
  ])
})

test("replacing the gallery clears variant photo references", async () => {
  const current = bulkProduct({
    variants: [
      {
        label: "Ukuran",
        options: [
          { value: "M", price: 150000, weight: 500, imageId: "old-1" },
          { value: "L", price: 160000, weight: null, imageId: null },
        ],
      },
    ],
  })
  const bytes = await updateWorkbook([{ id: current.id, image1Url: IMAGE_ONE }])
  const { deps, recorder } = dependencies({
    products: new Map([[current.id, current]]),
  })
  await runBulkUpdate(bytes, deps)

  assert.deepEqual(recorder.updated[0]?.values.variants, [
    {
      label: "Ukuran",
      options: [
        { value: "M", price: 150000, weight: 500, imageId: null },
        { value: "L", price: 160000, weight: null, imageId: null },
      ],
    },
  ])
})

test("a variant without photo references stays untouched", async () => {
  const current = bulkProduct({
    variants: [
      {
        label: "Ukuran",
        options: [{ value: "M", price: 150000, weight: 500, imageId: null }],
      },
    ],
  })
  const bytes = await updateWorkbook([{ id: current.id, image1Url: IMAGE_ONE }])
  const { deps, recorder } = dependencies({
    products: new Map([[current.id, current]]),
  })
  await runBulkUpdate(bytes, deps)

  assert.equal(recorder.updated[0]?.values.variants, undefined)
})

test("a failed gallery replacement keeps the old images", async () => {
  const current = bulkProduct()
  const bytes = await updateWorkbook([
    { id: current.id, image1Url: IMAGE_ONE, image2Url: IMAGE_TWO },
  ])
  const { deps, recorder } = dependencies({
    products: new Map([[current.id, current]]),
    fetchImage: async (url) => {
      if (url === IMAGE_TWO) {
        throw new RemoteImageError({ failure: "too-large" })
      }

      return { bytes: await imageBytes(), mime: "image/png" }
    },
  })
  const result = await runBulkUpdate(bytes, deps)

  assert.equal(result.kind, "summary")
  if (result.kind === "summary") {
    assert.match(result.summary.rows[0]?.message ?? "", /melebihi batas ukuran/)
  }

  assert.equal(recorder.updated.length, 0)
  assert.equal(recorder.deleted.length, 1)
  assert.deepEqual(recorder.deleted[0], [
    `products/p/${recorder.uploaded[0]}/original.png`,
    `products/p/${recorder.uploaded[0]}/thumbnail.webp`,
    `products/p/${recorder.uploaded[0]}/detail.webp`,
  ])
})

test("the workbook header row must match the shared column metadata", async () => {
  const bytes = await updateWorkbook([{ id: "1" }])
  const headers = bulkColumns("update").map(({ header }) => header)

  assert.equal(headers[0], "ID Produk")
  assert.ok(bytes.byteLength > 0)
})
