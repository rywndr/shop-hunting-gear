import { MAX_PRODUCT_IMAGES } from "@/lib/admin/product-form"

export const MAX_XLSX_BYTES = 8 * 1024 * 1024
export const MAX_ROWS = 500
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_IMAGES = MAX_PRODUCT_IMAGES
export const REMOTE_IMAGE_TIMEOUT_MS = 15_000
export const MAX_REDIRECTS = 3
export const ROW_CONCURRENCY = 3

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

export const XLSX_EXTENSION = ".xlsx"
