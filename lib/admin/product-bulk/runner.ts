import "server-only"

import { revalidatePath } from "next/cache"

import {
  adminBulkProductRows,
  adminBulkProductsByIds,
  createProduct,
  updateBulkProduct,
} from "@/lib/products/service"
import { deleteProductImages, uploadProductImage } from "@/lib/products/storage"

import type { BulkColumnMode } from "./columns"
import { fetchRemoteImage } from "./remote-image"
import { runBulkUpdate, runBulkUpload, type BulkDependencies } from "./service"
import { bulkWorkbookBytes, type BulkWorkbookRow } from "./workbook"

const DEPENDENCIES: BulkDependencies = {
  fetchImage: (url) => fetchRemoteImage(url),
  uploadImage: uploadProductImage,
  deleteImages: deleteProductImages,
  createProduct,
  updateProduct: updateBulkProduct,
  loadProducts: adminBulkProductsByIds,
  revalidate: () => {
    revalidatePath("/")
    revalidatePath("/admin/produk")
  },
}

export function runBulkImport({
  mode,
  bytes,
}: {
  mode: BulkColumnMode
  bytes: ArrayBuffer
}) {
  switch (mode) {
    case "upload":
      return runBulkUpload(bytes, DEPENDENCIES)
    case "update":
      return runBulkUpdate(bytes, DEPENDENCIES)
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

async function updateWorkbookRows(): Promise<readonly BulkWorkbookRow[]> {
  const products = await adminBulkProductRows()

  return products.map(
    ({ id, name, price, compareAtPrice, stock, weight, state }) => ({
      id,
      name,
      price,
      compareAtPrice,
      stock,
      weight,
      state,
    })
  )
}

export async function bulkWorkbookFor(mode: BulkColumnMode) {
  switch (mode) {
    case "upload":
      return bulkWorkbookBytes({ mode, rows: [] })
    case "update":
      return bulkWorkbookBytes({ mode, rows: await updateWorkbookRows() })
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}
