import "server-only"

import { randomUUID } from "node:crypto"
import { inArray } from "drizzle-orm"
import sharp from "sharp"

import { db } from "@/lib/db/client"
import { returnPhoto } from "@/lib/db/schema/return"
import {
  deleteB2Objects,
  listB2Objects,
  putB2Object,
  type B2ListedObject,
} from "@/lib/storage/b2"
import { RETURN_PHOTO_LIMITS, returnPhotoMimeSchema } from "./schema"
import { RETURN_WINDOW_MS } from "./config"

export async function uploadReturnPhotos({
  returnId,
  files,
}: {
  readonly returnId: string
  readonly files: readonly File[]
}) {
  if (files.length < 1 || files.length > RETURN_PHOTO_LIMITS.count)
    throw new Error("Invalid return photo count.")
  const photos: { id: string; objectKey: string }[] = []
  try {
    for (const file of files) {
      const mime = returnPhotoMimeSchema.parse(file.type)
      if (file.size <= 0 || file.size > RETURN_PHOTO_LIMITS.bytes)
        throw new Error("Invalid return photo size.")
      const bytes = new Uint8Array(await file.arrayBuffer())
      const image = sharp(bytes, {
        animated: true,
        failOn: "warning",
        limitInputPixels: 50_000_000,
      })
      const metadata = await image.metadata()
      const format =
        mime === "image/jpeg" ? "jpeg" : mime === "image/png" ? "png" : "webp"
      if (
        metadata.format !== format ||
        (metadata.pages ?? 1) !== 1 ||
        !metadata.width ||
        !metadata.height
      )
        throw new Error("Invalid return photo.")
      const body = await image
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer()
      const id = randomUUID()
      const objectKey = returnPhotoObjectKey({ returnId, photoId: id })
      photos.push({ id, objectKey })
      // The configured B2 bucket must remain private. No public catalog URL or cache.
      await putB2Object({
        key: objectKey,
        body,
        contentType: "image/webp",
        cacheControl: "private, no-store",
      })
    }
    return photos
  } catch (error) {
    await cleanupReturnPhotos(photos)
    throw error
  }
}

export async function cleanupReturnPhotos(
  photos: readonly { readonly objectKey: string }[]
) {
  try {
    await deleteB2Objects(photos.map(({ objectKey }) => objectKey))
  } catch (error) {
    console.error("Return photo cleanup failed.", {
      event: "returns.photo_cleanup_failed",
      error,
    })
  }
}

// Wait out the entire submission window, not just the review staging-token
// lifetime. A server-uploaded orphan cannot start another eligible submission
// after this grace. Committed photo references have no expiry.
export const RETURN_PHOTO_GC_MAX_AGE_MS = RETURN_WINDOW_MS

const RETURN_PHOTO_PREFIX = "returns/"
const RETURN_PHOTO_KEY_PATTERN =
  /^returns\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/
const REFERENCE_QUERY_BATCH_SIZE = 500

export function returnPhotoObjectKey({
  returnId,
  photoId,
}: {
  readonly returnId: string
  readonly photoId: string
}) {
  return `${RETURN_PHOTO_PREFIX}${returnId}/${photoId}.webp`
}

export type ReturnPhotoGcObject = Pick<B2ListedObject, "key" | "lastModified">

export type ReturnPhotoGcDependencies = {
  readonly listObjects: () => Promise<readonly ReturnPhotoGcObject[]>
  readonly findReferencedKeys: (
    keys: readonly string[]
  ) => Promise<readonly string[]>
  readonly deleteObjects: (keys: readonly string[]) => Promise<void>
}

export type ReturnPhotoGcResult = {
  readonly scanned: number
  readonly stale: number
  readonly referenced: number
  readonly deleted: number
  readonly failed: number
}

export function staleReturnPhotoObjectKeys({
  objects,
  referencedKeys,
  now,
  maxAgeMs = RETURN_PHOTO_GC_MAX_AGE_MS,
}: {
  readonly objects: readonly ReturnPhotoGcObject[]
  readonly referencedKeys: readonly string[]
  readonly now: Date
  readonly maxAgeMs?: number
}) {
  const cutoff = now.getTime() - maxAgeMs
  const referenced = new Set(referencedKeys)
  const stale: string[] = []

  for (const object of objects) {
    const lastModified = object.lastModified?.getTime()
    if (
      !RETURN_PHOTO_KEY_PATTERN.test(object.key) ||
      referenced.has(object.key) ||
      lastModified === undefined ||
      !Number.isFinite(lastModified) ||
      lastModified >= cutoff
    ) {
      continue
    }
    stale.push(object.key)
  }

  return [...new Set(stale)]
}

async function findReferencedReturnPhotoKeys(keys: readonly string[]) {
  const referenced = new Set<string>()

  for (
    let index = 0;
    index < keys.length;
    index += REFERENCE_QUERY_BATCH_SIZE
  ) {
    const batch = keys.slice(index, index + REFERENCE_QUERY_BATCH_SIZE)
    if (batch.length === 0) continue
    const rows = await db
      .select({ objectKey: returnPhoto.objectKey })
      .from(returnPhoto)
      .where(inArray(returnPhoto.objectKey, batch))
    for (const row of rows) referenced.add(row.objectKey)
  }

  return [...referenced]
}

const defaultReturnPhotoGcDependencies: ReturnPhotoGcDependencies = {
  listObjects: () => listB2Objects(RETURN_PHOTO_PREFIX),
  findReferencedKeys: findReferencedReturnPhotoKeys,
  deleteObjects: deleteB2Objects,
}

export async function cleanupOrphanReturnPhotos({
  now = new Date(),
  maxAgeMs = RETURN_PHOTO_GC_MAX_AGE_MS,
  dependencies: overrides = {},
}: {
  readonly now?: Date
  readonly maxAgeMs?: number
  readonly dependencies?: Partial<ReturnPhotoGcDependencies>
} = {}): Promise<ReturnPhotoGcResult> {
  if (
    !Number.isFinite(now.getTime()) ||
    !Number.isFinite(maxAgeMs) ||
    maxAgeMs < RETURN_PHOTO_GC_MAX_AGE_MS
  ) {
    throw new Error("Invalid return photo GC age.")
  }

  const dependencies = { ...defaultReturnPhotoGcDependencies, ...overrides }
  const objects = await dependencies.listObjects()
  const scanned = objects.length
  const stale = staleReturnPhotoObjectKeys({
    objects,
    referencedKeys: [],
    now,
    maxAgeMs,
  })
  if (stale.length === 0) {
    return {
      scanned,
      stale: 0,
      referenced: 0,
      deleted: 0,
      failed: 0,
    }
  }

  const referencedDuringListing = new Set(
    await dependencies.findReferencedKeys(stale)
  )
  let referenced = 0
  let deleted = 0
  let failed = 0

  for (const objectKey of stale) {
    if (referencedDuringListing.has(objectKey)) {
      referenced += 1
      continue
    }

    // The reference may have been committed after the listing query. Check
    // again immediately before deleting the object.
    const referencedBeforeDelete = await dependencies.findReferencedKeys([
      objectKey,
    ])
    if (referencedBeforeDelete.includes(objectKey)) {
      referenced += 1
      continue
    }

    try {
      await dependencies.deleteObjects([objectKey])
      deleted += 1
    } catch (error) {
      failed += 1
      console.error("Return photo GC deletion failed.", {
        event: "returns.photo_gc_delete_failed",
        objectKey,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    scanned,
    stale: stale.length,
    referenced,
    deleted,
    failed,
  }
}
