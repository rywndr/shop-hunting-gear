import { z } from "zod"

export const REVIEW_FIELDS = {
  orderItemId: "orderItemId",
  rating: "rating",
  body: "body",
} as const

export const REVIEW_LIMITS = {
  maxAttachments: 4,
  maxImageBytes: 5 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
} as const

export const REVIEW_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export const reviewImageMimeSchema = z.enum(REVIEW_IMAGE_MIMES)
export type ReviewImageMime = z.infer<typeof reviewImageMimeSchema>

export const reviewFormSchema = z.object({
  orderItemId: z.string().trim().min(1, "Pilih barang yang akan diulas."),
  rating: z.number().int().min(1, "Pilih nilai bintang.").max(5),
  body: z
    .string()
    .trim()
    .min(1, "Ulasan wajib diisi.")
    .max(1000, "Ulasan maksimal 1000 karakter."),
})

export type ReviewFormValues = z.infer<typeof reviewFormSchema>

const uploadFileSchema = z.object({
  mime: reviewImageMimeSchema,
  size: z.number().int().positive().max(REVIEW_LIMITS.maxImageBytes),
})

export const reviewUploadIntentRequestSchema = z
  .object({
    orderItemId: z.string().trim().min(1),
    files: z.array(uploadFileSchema).min(1).max(REVIEW_LIMITS.maxAttachments),
  })
  .refine(
    ({ files }) =>
      files.reduce((total, file) => total + file.size, 0) <=
      REVIEW_LIMITS.maxTotalBytes,
    { message: "Total gambar maksimal 20 MiB.", path: ["files"] }
  )

const preparedUploadSchema = z.object({
  mediaId: z.string().uuid(),
  uploadUrl: z.url(),
  headers: z.record(z.string(), z.string()),
})

export const reviewUploadIntentResponseSchema = z.object({
  uploadToken: z.string().min(1),
  uploads: z.array(preparedUploadSchema).max(REVIEW_LIMITS.maxAttachments),
})

export const reviewFinalizeRequestSchema = reviewFormSchema.extend({
  uploadToken: z.string().min(1).nullable(),
})

export const reviewSuccessResponseSchema = z.object({
  kind: z.literal("created"),
  reviewId: z.string(),
  orderItemId: z.string(),
})
export const reviewErrorResponseSchema = z.object({
  kind: z.literal("error"),
  error: z.string(),
})
export const reviewFinalizeResponseSchema = z.union([
  reviewSuccessResponseSchema,
  reviewErrorResponseSchema,
])

export type ReviewUploadIntentRequest = z.infer<
  typeof reviewUploadIntentRequestSchema
>
export type ReviewUploadIntentResponse = z.infer<
  typeof reviewUploadIntentResponseSchema
>
export type ReviewFinalizeRequest = z.infer<typeof reviewFinalizeRequestSchema>

export type MediaValidationResult =
  | { readonly kind: "valid" }
  | { readonly kind: "too-large"; readonly message: string }
  | { readonly kind: "unsupported"; readonly message: string }

export function isReviewImageMime(value: string): value is ReviewImageMime {
  return REVIEW_IMAGE_MIMES.some((mime) => mime === value)
}

export function validateReviewMedia(
  files: readonly { readonly mime: string; readonly size: number }[]
): MediaValidationResult {
  if (files.length > REVIEW_LIMITS.maxAttachments) {
    return { kind: "too-large", message: "Maksimal 4 gambar." }
  }

  let total = 0
  for (const file of files) {
    if (!isReviewImageMime(file.mime)) {
      return { kind: "unsupported", message: "Format gambar tidak didukung." }
    }
    if (file.size <= 0 || file.size > REVIEW_LIMITS.maxImageBytes) {
      return { kind: "too-large", message: "Ukuran gambar maksimal 5 MiB." }
    }
    total += file.size
  }

  if (total > REVIEW_LIMITS.maxTotalBytes) {
    return { kind: "too-large", message: "Total gambar maksimal 20 MiB." }
  }
  return { kind: "valid" }
}
