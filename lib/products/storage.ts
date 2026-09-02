import "server-only"

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import sharp from "sharp"

import type { StoredProductImage } from "./schema"
import { serverEnv } from "../env/server"

const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const satisfies Readonly<Record<string, string>>

const THUMBNAIL_WIDTH = 480
const DETAIL_WIDTH = 1200
const DERIVATIVE_QUALITY = 82

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

function b2Config() {
  const config = serverEnv.backblazeB2

  if (!config) {
    throw new Error("No Backblaze B2 configuration.")
  }

  return config
}

function b2Client() {
  const config = b2Config()

  return new S3Client({
    endpoint: `https://s3.${config.region}.backblazeb2.com`,
    region: config.region,
    credentials: {
      accessKeyId: config.keyId,
      secretAccessKey: config.applicationKey,
    },
  })
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
  client,
  bucket,
  key,
  body,
  contentType,
}: {
  readonly client: S3Client
  readonly bucket: string
  readonly key: string
  readonly body: Uint8Array
  readonly contentType: ProductImageMime
}) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentLength: body.byteLength,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )
}

async function derivativeBuffers(bytes: Uint8Array) {
  const source = sharp(bytes).rotate()
  const [thumbnail, detail] = await Promise.all([
    source
      .clone()
      .resize({
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_WIDTH,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: DERIVATIVE_QUALITY })
      .toBuffer(),
    source
      .clone()
      .resize({
        width: DETAIL_WIDTH,
        height: DETAIL_WIDTH,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: DERIVATIVE_QUALITY })
      .toBuffer(),
  ])

  return { thumbnail, detail }
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

  const config = b2Config()
  const client = b2Client()
  const keys = imageObjectKeys({ productId, id, mime })
  const uploadedObjectKeys: string[] = []

  try {
    uploadedObjectKeys.push(keys.objectKey)
    await putProductObject({
      client,
      bucket: config.bucket,
      key: keys.objectKey,
      body: bytes,
      contentType: mime,
    })

    const derivatives = await derivativeBuffers(bytes)
    uploadedObjectKeys.push(keys.thumbnailObjectKey, keys.detailObjectKey)
    const derivativeUploads = await Promise.allSettled([
      putProductObject({
        client,
        bucket: config.bucket,
        key: keys.thumbnailObjectKey,
        body: derivatives.thumbnail,
        contentType: "image/webp",
      }),
      putProductObject({
        client,
        bucket: config.bucket,
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
  const config = b2Config()

  try {
    const result = await b2Client().send(
      new GetObjectCommand({ Bucket: config.bucket, Key: objectKey })
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

export async function presignedProductImageUrl({
  image,
  rendition,
  access,
}: {
  readonly image: StoredProductImage
  readonly rendition: ProductImageRendition
  readonly access: ProductImageUrlAccess
}) {
  const config = b2Config()

  return getSignedUrl(
    b2Client(),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: productImageObjectKey(image, rendition),
    }),
    { expiresIn: PRODUCT_IMAGE_SIGNED_URL_TTL_SECONDS[access] }
  )
}

export async function deleteProductImages(objectKeys: readonly string[]) {
  const uniqueObjectKeys = [...new Set(objectKeys)]

  if (uniqueObjectKeys.length === 0) {
    return
  }

  const config = b2Config()
  const result = await b2Client().send(
    new DeleteObjectsCommand({
      Bucket: config.bucket,
      Delete: { Objects: uniqueObjectKeys.map((Key) => ({ Key })) },
    })
  )

  if (result.Errors && result.Errors.length > 0) {
    throw new Error("Some product images could not be deleted.")
  }
}
