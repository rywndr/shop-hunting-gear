import "server-only"

import { unstable_cache } from "next/cache"
import sharp from "sharp"

import { webpDerivativeBuffers } from "@/lib/products/image-derivatives"
import {
  b2SigningIdentity,
  deleteB2Objects,
  headB2Object,
  putB2Object,
  readB2ObjectBytes,
  signedB2GetUrl,
} from "@/lib/storage/b2"
import { REVIEW_LIMITS, type ReviewImageMime } from "./schema"
import type { ReviewUploadTokenPayload } from "./upload-intent"

const MAX_IMAGE_PIXELS = 50_000_000
const MAX_IMAGE_DIMENSION = 20_000
const URL_TTL_SECONDS = 12 * 60 * 60
const URL_CACHE_TTL_SECONDS = 3 * 60 * 60
const REVIEW_CACHE_CONTROL = "public, max-age=86400"

const SHARP_FORMAT_BY_MIME = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
} as const satisfies Readonly<Record<ReviewImageMime, string>>

export type StoredReviewMedia = {
  readonly id: string
  readonly objectKey: string
  readonly thumbnailObjectKey: string
  readonly size: number
  readonly sortOrder: number
}

export class ReviewImageValidationError extends Error {
  constructor(message = "Invalid review image.", options?: ErrorOptions) {
    super(message, options)
    this.name = "ReviewImageValidationError"
  }
}

export class ReviewImageUploadError extends Error {
  readonly uploadedObjectKeys: readonly string[]

  constructor(uploadedObjectKeys: readonly string[], cause: unknown) {
    super("Review image upload failed.", { cause })
    this.name = "ReviewImageUploadError"
    this.uploadedObjectKeys = uploadedObjectKeys
  }
}

export async function validateReviewImageBytes({
  bytes,
  expectedMime,
}: {
  readonly bytes: Uint8Array
  readonly expectedMime: ReviewImageMime
}) {
  try {
    const metadata = await sharp(bytes, {
      animated: true,
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).metadata()
    if (
      metadata.format !== SHARP_FORMAT_BY_MIME[expectedMime] ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > MAX_IMAGE_DIMENSION ||
      metadata.height > MAX_IMAGE_DIMENSION ||
      metadata.width * metadata.height > MAX_IMAGE_PIXELS ||
      (metadata.pages ?? 1) !== 1
    ) {
      throw new ReviewImageValidationError()
    }
  } catch (error) {
    if (error instanceof ReviewImageValidationError) throw error
    throw new ReviewImageValidationError("Invalid review image.", {
      cause: error,
    })
  }
}

export function reviewCanonicalObjectKeys({
  productId,
  reviewId,
  mediaId,
}: {
  readonly productId: string
  readonly reviewId: string
  readonly mediaId: string
}) {
  const base = `reviews/${productId}/${reviewId}/${mediaId}`
  return {
    thumbnailObjectKey: `${base}/thumbnail.webp`,
    objectKey: `${base}/detail.webp`,
  }
}

export async function processStagedReviewImage({
  productId,
  reviewId,
  file,
}: {
  readonly productId: string
  readonly reviewId: string
  readonly file: ReviewUploadTokenPayload["files"][number]
}): Promise<StoredReviewMedia> {
  const metadata = await headB2Object(file.stagingKey)
  if (
    metadata.kind !== "found" ||
    metadata.contentLength !== file.expectedSize ||
    metadata.contentType !== file.expectedMime
  ) {
    throw new ReviewImageValidationError(
      "Staged review image does not match upload token."
    )
  }

  const bytes = await readB2ObjectBytes(
    file.stagingKey,
    REVIEW_LIMITS.maxImageBytes
  )
  if (bytes.byteLength !== file.expectedSize) {
    throw new ReviewImageValidationError("Staged review image size changed.")
  }
  await validateReviewImageBytes({ bytes, expectedMime: file.expectedMime })

  const derivatives = await webpDerivativeBuffers({
    bytes,
    thumbnailSize: 640,
    detailSize: 1440,
  })
  const keys = reviewCanonicalObjectKeys({
    productId,
    reviewId,
    mediaId: file.mediaId,
  })
  const uploadedObjectKeys: string[] = []

  try {
    uploadedObjectKeys.push(keys.thumbnailObjectKey)
    await putB2Object({
      key: keys.thumbnailObjectKey,
      body: derivatives.thumbnail,
      contentType: "image/webp",
      cacheControl: REVIEW_CACHE_CONTROL,
    })
    uploadedObjectKeys.push(keys.objectKey)
    await putB2Object({
      key: keys.objectKey,
      body: derivatives.detail,
      contentType: "image/webp",
      cacheControl: REVIEW_CACHE_CONTROL,
    })
  } catch (error) {
    try {
      await deleteB2Objects(uploadedObjectKeys)
    } catch {
      // The service retries cleanup with the keys carried by this error.
    }
    throw new ReviewImageUploadError(uploadedObjectKeys, error)
  }

  return {
    id: file.mediaId,
    objectKey: keys.objectKey,
    thumbnailObjectKey: keys.thumbnailObjectKey,
    size: derivatives.detail.byteLength,
    sortOrder: file.sortOrder,
  }
}

export function deleteReviewObjects(keys: readonly string[]) {
  return deleteB2Objects(keys)
}

function cachedReviewImageUrl(
  objectKey: string,
  rendition: "thumbnail" | "detail"
) {
  const cacheWindow = Math.floor(Date.now() / (URL_CACHE_TTL_SECONDS * 1000))
  return unstable_cache(
    async () => signedB2GetUrl(objectKey, URL_TTL_SECONDS),
    [
      "review-image-storefront-url",
      b2SigningIdentity(),
      objectKey,
      rendition,
      String(cacheWindow),
    ],
    { revalidate: URL_CACHE_TTL_SECONDS }
  )()
}

export async function reviewMediaUrls(
  media: Pick<StoredReviewMedia, "id" | "objectKey" | "thumbnailObjectKey">
) {
  const [url, thumbnailUrl] = await Promise.all([
    cachedReviewImageUrl(media.objectKey, "detail"),
    cachedReviewImageUrl(media.thumbnailObjectKey, "thumbnail"),
  ])
  return { id: media.id, url, thumbnailUrl }
}
