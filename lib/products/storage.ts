import "server-only"

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

import type { StoredProductImage } from "../db/schema/product"
import { serverEnv } from "../env/server"

const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const satisfies Readonly<Record<string, string>>

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
  const objectKey = `products/${productId}/${id}.${IMAGE_EXTENSIONS[mime]}`

  await b2Client().send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: bytes,
      ContentLength: bytes.byteLength,
      ContentType: mime,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )

  return {
    id,
    objectKey,
    alt,
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
      readonly bytes: Uint8Array<ArrayBuffer>
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

    const bytes = Uint8Array.from(await result.Body.transformToByteArray())

    return {
      kind: "found",
      bytes,
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

export async function deleteProductImages(objectKeys: readonly string[]) {
  if (objectKeys.length === 0) {
    return
  }

  const config = b2Config()

  await b2Client().send(
    new DeleteObjectsCommand({
      Bucket: config.bucket,
      Delete: { Objects: objectKeys.map((Key) => ({ Key })) },
    })
  )
}
