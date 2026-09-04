import "server-only"

import { GetObjectCommand } from "@aws-sdk/client-s3"
import { unstable_cache } from "next/cache"

import { webpDerivativeBuffers } from "./image-derivatives"
import type { StoredProductImage } from "./schema"
import {
  b2Bucket,
  b2Client,
  b2SigningIdentity,
  deleteB2Objects,
  putB2Object,
  signedB2GetUrl,
} from "../storage/b2"

const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const satisfies Readonly<Record<string, string>>

const THUMBNAIL_WIDTH = 480
const DETAIL_WIDTH = 1200

export const PRODUCT_IMAGE_SIGNED_URL_TTL_SECONDS = {
  storefront: 12 * 60 * 60,
  admin: 15 * 60,
} as const

export type ProductImageUrlAccess =
  keyof typeof PRODUCT_IMAGE_SIGNED_URL_TTL_SECONDS
export type ProductImageRendition = "original" | "thumbnail" | "detail"
export type ProductImageMime = keyof typeof IMAGE_EXTENSIONS

export function isProductImageMime(value: string): value is ProductImageMime {
  return Object.hasOwn(IMAGE_EXTENSIONS, value)
}

function imageObjectKeys({
  productId,
  id,
  mime,
}: {
  readonly productId: string
  readonly id: string
  readonly mime: ProductImageMime
}) {
  const base = `products/${productId}/${id}`

  return {
    objectKey: `${base}/original.${IMAGE_EXTENSIONS[mime]}`,
    thumbnailObjectKey: `${base}/thumbnail.webp`,
    detailObjectKey: `${base}/detail.webp`,
  }
}

export function productImageObjectKey(
  image: StoredProductImage,
  rendition: ProductImageRendition
) {
  if (rendition === "original") {
    return image.objectKey
  }

  if ("thumbnailObjectKey" in image) {
    return rendition === "thumbnail"
      ? image.thumbnailObjectKey
      : image.detailObjectKey
  }

  return image.objectKey
}

export function productImageObjectKeys(image: StoredProductImage) {
  return "thumbnailObjectKey" in image
    ? [image.objectKey, image.thumbnailObjectKey, image.detailObjectKey]
    : [image.objectKey]
}

async function putProductObject({
  key,
  body,
  contentType,
}: {
  readonly key: string
  readonly body: Uint8Array
  readonly contentType: ProductImageMime
}) {
  await putB2Object({ key, body, contentType })
}

export class ProductImageUploadError extends Error {
  readonly uploadedObjectKeys: readonly string[]

  constructor(uploadedObjectKeys: readonly string[], cause: unknown) {
    super("Product image upload failed.", { cause })
    this.name = "ProductImageUploadError"
    this.uploadedObjectKeys = uploadedObjectKeys
  }
}

export async function uploadProductImage({
  id,
  productId,
  alt,
  mime,
  bytes,
}: {
  id: string
  productId: string
  alt: string
  mime: string
  bytes: Uint8Array
}): Promise<StoredProductImage> {
  if (!isProductImageMime(mime)) {
    throw new Error("Unsupported product image type.")
  }

  const keys = imageObjectKeys({ productId, id, mime })
  const uploadedObjectKeys: string[] = []

  try {
    uploadedObjectKeys.push(keys.objectKey)
    await putProductObject({
      key: keys.objectKey,
      body: bytes,
      contentType: mime,
    })

    const derivatives = await webpDerivativeBuffers({
      bytes,
      thumbnailSize: THUMBNAIL_WIDTH,
      detailSize: DETAIL_WIDTH,
    })
    uploadedObjectKeys.push(keys.thumbnailObjectKey, keys.detailObjectKey)
    const derivativeUploads = await Promise.allSettled([
      putProductObject({
        key: keys.thumbnailObjectKey,
        body: derivatives.thumbnail,
        contentType: "image/webp",
      }),
      putProductObject({
        key: keys.detailObjectKey,
        body: derivatives.detail,
        contentType: "image/webp",
      }),
    ])

    for (const upload of derivativeUploads) {
      if (upload.status === "rejected") {
        throw upload.reason
      }
    }

    return {
      id,
      objectKey: keys.objectKey,
      thumbnailObjectKey: keys.thumbnailObjectKey,
      detailObjectKey: keys.detailObjectKey,
      alt,
    }
  } catch (error) {
    try {
      await deleteProductImages(uploadedObjectKeys)
    } catch {
      // The caller retries cleanup with the keys carried by the error.
    }

    throw new ProductImageUploadError(uploadedObjectKeys, error)
  }
}

function isNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (("name" in error &&
      (error.name === "NoSuchKey" || error.name === "NotFound")) ||
      ("$metadata" in error &&
        typeof error.$metadata === "object" &&
        error.$metadata !== null &&
        "httpStatusCode" in error.$metadata &&
        error.$metadata.httpStatusCode === 404))
  )
}

export type ProductImageDownload =
  | { readonly kind: "not-found" }
  | {
      readonly kind: "found"
      readonly body: ReadableStream<Uint8Array>
      readonly contentLength: number | null
      readonly mime: ProductImageMime
      readonly etag: string | null
      readonly lastModified: string | null
    }

export async function downloadProductImage(
  objectKey: string
): Promise<ProductImageDownload> {
  try {
    const result = await b2Client().send(
      new GetObjectCommand({ Bucket: b2Bucket(), Key: objectKey })
    )

    const mime = result.ContentType ?? ""

    if (!result.Body || !isProductImageMime(mime)) {
      throw new Error("Invalid stored product image.")
    }

    return {
      kind: "found",
      body: result.Body.transformToWebStream(),
      contentLength: result.ContentLength ?? null,
      mime,
      etag: result.ETag ?? null,
      lastModified: result.LastModified?.toUTCString() ?? null,
    }
  } catch (error) {
    if (isNotFoundError(error)) {
      return { kind: "not-found" }
    }

    throw error
  }
}

const STOREFRONT_URL_CACHE_TTL_SECONDS = 3 * 60 * 60

function cachedStorefrontProductImageUrl(
  objectKey: string,
  rendition: ProductImageRendition
) {
  const cacheWindow = Math.floor(
    Date.now() / (STOREFRONT_URL_CACHE_TTL_SECONDS * 1000)
  )

  return unstable_cache(
    async () =>
      signedB2GetUrl(
        objectKey,
        PRODUCT_IMAGE_SIGNED_URL_TTL_SECONDS.storefront
      ),
    [
      "product-image-storefront-url",
      b2SigningIdentity(),
      objectKey,
      rendition,
      String(cacheWindow),
    ],
    { revalidate: STOREFRONT_URL_CACHE_TTL_SECONDS }
  )()
}

export async function presignedProductImageUrl({
  image,
  rendition,
  access,
}: {
  readonly image: StoredProductImage
  readonly rendition: ProductImageRendition
  readonly access: ProductImageUrlAccess
}) {
  const objectKey = productImageObjectKey(image, rendition)

  if (access === "storefront") {
    return cachedStorefrontProductImageUrl(objectKey, rendition)
  }

  return signedB2GetUrl(objectKey, PRODUCT_IMAGE_SIGNED_URL_TTL_SECONDS[access])
}

export async function deleteProductImages(objectKeys: readonly string[]) {
  const uniqueObjectKeys = [...new Set(objectKeys)]

  if (uniqueObjectKeys.length === 0) {
    return
  }

  await deleteB2Objects(uniqueObjectKeys)
}
