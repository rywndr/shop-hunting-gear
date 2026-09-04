import "server-only"

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { serverEnv } from "@/lib/env/server"

function config() {
  const value = serverEnv.backblazeB2
  if (!value) throw new Error("No Backblaze B2 configuration.")
  return value
}

let client: S3Client | undefined
export function b2Client() {
  if (client) return client
  const value = config()
  client = new S3Client({
    endpoint: `https://s3.${value.region}.backblazeb2.com`,
    region: value.region,
    credentials: {
      accessKeyId: value.keyId,
      secretAccessKey: value.applicationKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
  })
  return client
}

export function b2Bucket() {
  return config().bucket
}

export function b2SigningIdentity() {
  const value = config()
  return [value.keyId, value.bucket, value.region].join(":")
}

export async function putB2Object({
  key,
  body,
  contentType,
  cacheControl = "public, max-age=31536000, immutable",
}: {
  readonly key: string
  readonly body: Uint8Array
  readonly contentType: string
  readonly cacheControl?: string
}) {
  await b2Client().send(
    new PutObjectCommand({
      Bucket: b2Bucket(),
      Key: key,
      Body: body,
      ContentLength: body.byteLength,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  )
}

export async function deleteB2Objects(keys: readonly string[]) {
  const unique = [...new Set(keys)]
  if (unique.length === 0) return
  const result = await b2Client().send(
    new DeleteObjectsCommand({
      Bucket: b2Bucket(),
      Delete: { Objects: unique.map((Key) => ({ Key })) },
    })
  )
  if (result.Errors?.length)
    throw new Error("Some B2 objects could not be deleted.")
}

export function signedB2GetUrl(key: string, expiresIn: number) {
  return getSignedUrl(
    b2Client(),
    new GetObjectCommand({ Bucket: b2Bucket(), Key: key }),
    { expiresIn }
  )
}

export async function signedB2PutUrl({
  key,
  contentType,
  contentLength,
  expiresIn,
}: {
  readonly key: string
  readonly contentType: string
  readonly contentLength: number
  readonly expiresIn: number
}) {
  const uploadUrl = await getSignedUrl(
    b2Client(),
    new PutObjectCommand({
      Bucket: b2Bucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn, unhoistableHeaders: new Set(["content-type"]) }
  )
  return {
    uploadUrl,
    headers: { "Content-Type": contentType },
  }
}

export type B2ObjectMetadata =
  | { readonly kind: "not-found" }
  | {
      readonly kind: "found"
      readonly contentLength: number | null
      readonly contentType: string | null
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

export async function headB2Object(key: string): Promise<B2ObjectMetadata> {
  try {
    const result = await b2Client().send(
      new HeadObjectCommand({ Bucket: b2Bucket(), Key: key })
    )
    return {
      kind: "found",
      contentLength: result.ContentLength ?? null,
      contentType: result.ContentType ?? null,
    }
  } catch (error) {
    if (isNotFoundError(error)) return { kind: "not-found" }
    throw error
  }
}

export async function readB2ObjectBytes(key: string, maxBytes: number) {
  const result = await b2Client().send(
    new GetObjectCommand({ Bucket: b2Bucket(), Key: key })
  )
  if (!result.Body) throw new Error("B2 object has no body.")
  if (result.ContentLength !== undefined && result.ContentLength > maxBytes) {
    throw new Error("B2 object exceeds byte limit.")
  }

  const reader = result.Body.transformToWebStream().getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const item = await reader.read()
      if (item.done) break
      size += item.value.byteLength
      if (size > maxBytes) {
        await reader.cancel("B2 object exceeds byte limit.")
        throw new Error("B2 object exceeds byte limit.")
      }
      chunks.push(item.value)
    }
  } finally {
    reader.releaseLock()
  }
  return new Uint8Array(Buffer.concat(chunks, size))
}
