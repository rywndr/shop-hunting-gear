import { randomUUID } from "node:crypto"

import { LISTING_STATES } from "@/lib/admin/catalog"
import {
  newProductId,
  productImageAlt,
  productSlug,
} from "@/lib/products/identity"
import type {
  StoredProductImage,
  StoredProductVariant,
} from "@/lib/products/schema"
import type {
  createProduct,
  updateBulkProduct,
  BulkProduct,
} from "@/lib/products/service"
import {
  ProductImageUploadError,
  productImageObjectKeys,
  type uploadProductImage,
} from "@/lib/products/storage"

import type { BulkColumnMode } from "./columns"
import { ROW_CONCURRENCY } from "./limits"
import { parseUpdateRows, parseUploadRows } from "./parser"
import {
  remoteImageMessage,
  RemoteImageError,
  type RemoteImage,
} from "./remote-image"
import {
  bulkImportSummary,
  type BulkImportSummary,
  type BulkParsedRow,
  type BulkRowResult,
  type UpdateRowValues,
  type UploadRowValues,
} from "./types"
import { readBulkSheet } from "./workbook"

const NEW_PRODUCT_STATE = "draft" as const

export type BulkDependencies = {
  readonly fetchImage: (url: string) => Promise<RemoteImage>
  readonly uploadImage: typeof uploadProductImage
  readonly deleteImages: (objectKeys: readonly string[]) => Promise<void>
  readonly createProduct: typeof createProduct
  readonly updateProduct: typeof updateBulkProduct
  readonly loadProducts: (
    productIds: readonly string[]
  ) => Promise<ReadonlyMap<string, BulkProduct>>
  readonly revalidate: () => void
}

export type BulkRunResult =
  | { readonly kind: "summary"; readonly summary: BulkImportSummary }
  | { readonly kind: "invalid"; readonly message: string }

class BulkRowFailure extends Error {}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function reportRowFailure({
  mode,
  row,
  productId,
  error,
}: {
  mode: BulkColumnMode
  row: number
  productId: string | undefined
  error: unknown
}) {
  console.error(
    JSON.stringify({
      event: "admin.product_bulk_import_row_failed",
      mode,
      row,
      productId,
      error: errorMessage(error),
    })
  )
}

async function mapWithConcurrency<TItem, TResult>({
  items,
  limit,
  task,
}: {
  items: readonly TItem[]
  limit: number
  task: (item: TItem) => Promise<TResult>
}): Promise<readonly TResult[]> {
  const results: TResult[] = Array.from({ length: items.length })
  let cursor = 0

  async function worker() {
    for (;;) {
      const index = cursor
      cursor += 1
      const item = items[index]

      if (item === undefined) {
        return
      }

      results[index] = await task(item)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  )

  return results
}

/** Uploads the full gallery before the database write starts. */
async function importGallery({
  productId,
  name,
  urls,
  objectKeys,
  dependencies,
}: {
  productId: string
  name: string
  urls: readonly [string, ...string[]]
  objectKeys: Set<string>
  dependencies: BulkDependencies
}): Promise<readonly [StoredProductImage, ...StoredProductImage[]]> {
  const images: StoredProductImage[] = []

  for (const [index, url] of urls.entries()) {
    let remote: RemoteImage

    try {
      remote = await dependencies.fetchImage(url)
    } catch (error) {
      if (error instanceof RemoteImageError) {
        throw new BulkRowFailure(remoteImageMessage({ slot: index + 1, error }))
      }

      throw error
    }

    const stored = await dependencies.uploadImage({
      id: randomUUID(),
      productId,
      alt: productImageAlt({ name, index }),
      mime: remote.mime,
      bytes: remote.bytes,
    })

    for (const objectKey of productImageObjectKeys(stored)) {
      objectKeys.add(objectKey)
    }

    images.push({ ...stored, sourceUrl: url })
  }

  const [first, ...others] = images

  if (!first) {
    throw new BulkRowFailure("URL Gambar 1 wajib diisi.")
  }

  return [first, ...others]
}

async function cleanupObjectKeys({
  productId,
  objectKeys,
  dependencies,
}: {
  productId: string
  objectKeys: readonly string[]
  dependencies: BulkDependencies
}) {
  if (objectKeys.length === 0) {
    return
  }

  try {
    await dependencies.deleteImages(objectKeys)
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "admin.product_bulk_image_cleanup_failed",
        productId,
        error: errorMessage(error),
      })
    )
  }
}

function rowFailure({
  mode,
  row,
  productId,
  productName,
  error,
  fallback,
}: {
  mode: BulkColumnMode
  row: number
  productId?: string
  productName?: string
  error: unknown
  fallback: string
}): BulkRowResult {
  if (error instanceof BulkRowFailure) {
    return {
      row,
      status: "error",
      productId,
      productName,
      message: error.message,
    }
  }

  reportRowFailure({ mode, row, productId, error })

  return { row, status: "error", productId, productName, message: fallback }
}

async function runUploadRow({
  parsed,
  dependencies,
}: {
  parsed: Extract<BulkParsedRow<UploadRowValues>, { kind: "valid" }>
  dependencies: BulkDependencies
}): Promise<BulkRowResult> {
  const { row, values } = parsed
  const productId = newProductId()
  const objectKeys = new Set<string>()

  try {
    const images = await importGallery({
      productId,
      name: values.name,
      urls: values.imageUrls,
      objectKeys,
      dependencies,
    })

    await dependencies.createProduct({
      id: productId,
      slug: productSlug({ name: values.name, id: productId }),
      name: values.name,
      category: values.category,
      description: values.description,
      images,
      variants: values.variants,
      price: values.price,
      compareAtPrice: values.compareAtPrice,
      stock: values.stock,
      weight: values.weight,
      state: NEW_PRODUCT_STATE,
    })

    return {
      row,
      status: "success",
      productId,
      productName: values.name,
      message: `Produk dibuat sebagai ${LISTING_STATES[NEW_PRODUCT_STATE].label}.`,
    }
  } catch (error) {
    if (error instanceof ProductImageUploadError) {
      for (const objectKey of error.uploadedObjectKeys) {
        objectKeys.add(objectKey)
      }
    }

    await cleanupObjectKeys({
      productId,
      objectKeys: [...objectKeys],
      dependencies,
    })

    return rowFailure({
      mode: "upload",
      row,
      productId,
      productName: values.name,
      error,
      fallback: "Produk belum tersimpan. Coba lagi atau periksa log server.",
    })
  }
}

/** Clears variant image references when gallery replacement removes them. */
function clearedVariantImages(
  variants: readonly StoredProductVariant[]
): readonly StoredProductVariant[] | undefined {
  const referencesImages = variants.some(({ options }) =>
    options.some(({ imageId }) => imageId !== null)
  )

  if (!referencesImages) {
    return undefined
  }

  return variants.map(({ label, options }) => {
    const [first, ...others] = options

    return {
      label,
      options: [
        { ...first, imageId: null },
        ...others.map((option) => ({ ...option, imageId: null })),
      ],
    }
  })
}

type UpdateChanges = {
  name?: string
  price?: number
  compareAtPrice?: number | null
  stock?: number
  weight?: number
}

function sourceUrlsMatch({
  submitted,
  images,
}: {
  submitted: readonly string[]
  images: readonly StoredProductImage[]
}) {
  return (
    submitted.length === images.length &&
    submitted.every((url, index) => images[index]?.sourceUrl === url)
  )
}

function updateChanges({
  values,
  current,
}: {
  values: UpdateRowValues
  current: BulkProduct
}): UpdateChanges {
  const changes: UpdateChanges = {}

  if (values.name !== undefined && values.name !== current.name) {
    changes.name = values.name
  }

  if (values.price !== undefined && values.price !== current.price) {
    changes.price = values.price
  }

  if (
    values.compareAtPrice !== undefined &&
    values.compareAtPrice !== current.compareAtPrice
  ) {
    changes.compareAtPrice = values.compareAtPrice
  }

  if (values.stock !== undefined && values.stock !== current.stock) {
    changes.stock = values.stock
  }

  if (values.weight !== undefined && values.weight !== current.weight) {
    changes.weight = values.weight
  }

  return changes
}

async function runUpdateRow({
  parsed,
  current,
  dependencies,
}: {
  parsed: Extract<BulkParsedRow<UpdateRowValues>, { kind: "valid" }>
  current: BulkProduct
  dependencies: BulkDependencies
}): Promise<BulkRowResult> {
  const { row, values } = parsed
  const productId = current.id
  const productName = values.name ?? current.name

  if (current.state === "deleted") {
    return {
      row,
      status: "error",
      productId,
      productName,
      message: `Produk berstatus ${LISTING_STATES.deleted.label} dan tidak dapat diperbarui.`,
    }
  }

  const changes = updateChanges({ values, current })
  const galleryChanged =
    values.imageUrls !== undefined &&
    !sourceUrlsMatch({ submitted: values.imageUrls, images: current.images })
  const state =
    values.state !== undefined && values.state !== current.state
      ? values.state
      : undefined
  const price = changes.price ?? current.price
  const compareAtPrice =
    changes.compareAtPrice === undefined
      ? current.compareAtPrice
      : changes.compareAtPrice

  if (compareAtPrice !== null && compareAtPrice <= price) {
    return {
      row,
      status: "error",
      productId,
      productName,
      message: "Harga Coret / Diskon harus lebih besar dari Harga.",
    }
  }

  if (
    Object.keys(changes).length === 0 &&
    state === undefined &&
    !galleryChanged
  ) {
    return {
      row,
      status: "skipped",
      productId,
      productName,
      message: "Tidak ada perubahan.",
    }
  }

  if (values.imageUrls === undefined || !galleryChanged) {
    try {
      await dependencies.updateProduct({ productId, values: changes, state })
    } catch (error) {
      return rowFailure({
        mode: "update",
        row,
        productId,
        productName,
        error,
        fallback: "Perubahan belum tersimpan. Coba lagi.",
      })
    }

    return {
      row,
      status: "success",
      productId,
      productName,
      message: "Produk diperbarui.",
    }
  }

  const objectKeys = new Set<string>()

  try {
    const images = await importGallery({
      productId,
      name: productName,
      urls: values.imageUrls,
      objectKeys,
      dependencies,
    })

    await dependencies.updateProduct({
      productId,
      values: {
        ...changes,
        images,
        variants: clearedVariantImages(current.variants),
      },
      state,
    })

    await cleanupObjectKeys({
      productId,
      objectKeys: current.images.flatMap((image) =>
        productImageObjectKeys(image)
      ),
      dependencies,
    })

    return {
      row,
      status: "success",
      productId,
      productName,
      message: "Produk dan galeri foto diperbarui.",
    }
  } catch (error) {
    if (error instanceof ProductImageUploadError) {
      for (const objectKey of error.uploadedObjectKeys) {
        objectKeys.add(objectKey)
      }
    }

    await cleanupObjectKeys({
      productId,
      objectKeys: [...objectKeys],
      dependencies,
    })

    return rowFailure({
      mode: "update",
      row,
      productId,
      productName,
      error,
      fallback: "Perubahan belum tersimpan. Foto lama tetap dipakai.",
    })
  }
}

function invalidRowResults<TValues>(
  rows: readonly BulkParsedRow<TValues>[]
): readonly BulkRowResult[] {
  return rows.flatMap((row) =>
    row.kind === "invalid"
      ? [{ row: row.row, status: "error", message: row.message } as const]
      : []
  )
}

function validRows<TValues>(rows: readonly BulkParsedRow<TValues>[]) {
  return rows.flatMap((row) => (row.kind === "valid" ? [row] : []))
}

function finish({
  results,
  dependencies,
}: {
  results: readonly BulkRowResult[]
  dependencies: BulkDependencies
}): BulkRunResult {
  const summary = bulkImportSummary(results)

  if (summary.successful > 0) {
    dependencies.revalidate()
  }

  return { kind: "summary", summary }
}

export async function runBulkUpload(
  bytes: ArrayBuffer,
  dependencies: BulkDependencies
): Promise<BulkRunResult> {
  const sheet = await readBulkSheet({ bytes, mode: "upload" })

  if (sheet.kind === "invalid") {
    return { kind: "invalid", message: sheet.message }
  }

  const parsed = parseUploadRows(sheet.rows)
  const processed = await mapWithConcurrency({
    items: validRows(parsed),
    limit: ROW_CONCURRENCY,
    task: (row) => runUploadRow({ parsed: row, dependencies }),
  })

  return finish({
    results: [...invalidRowResults(parsed), ...processed],
    dependencies,
  })
}

export async function runBulkUpdate(
  bytes: ArrayBuffer,
  dependencies: BulkDependencies
): Promise<BulkRunResult> {
  const sheet = await readBulkSheet({ bytes, mode: "update" })

  if (sheet.kind === "invalid") {
    return { kind: "invalid", message: sheet.message }
  }

  const parsed = parseUpdateRows(sheet.rows)
  const valid = validRows(parsed)
  const products = await dependencies.loadProducts(
    valid.map(({ values }) => values.id)
  )
  const unknown = valid.flatMap((row) =>
    products.has(row.values.id)
      ? []
      : [
          {
            row: row.row,
            status: "error",
            productId: row.values.id,
            message: "ID produk tidak ditemukan.",
          } as const,
        ]
  )
  const known = valid.flatMap((row) => {
    const current = products.get(row.values.id)
    return current ? [{ parsed: row, current }] : []
  })
  const processed = await mapWithConcurrency({
    items: known,
    limit: ROW_CONCURRENCY,
    task: ({ parsed: row, current }) =>
      runUpdateRow({ parsed: row, current, dependencies }),
  })

  return finish({
    results: [...invalidRowResults(parsed), ...unknown, ...processed],
    dependencies,
  })
}
