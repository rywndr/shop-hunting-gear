import "dotenv/config"
import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { db } from "../lib/db/client"
import { user } from "../lib/db/schema/auth"
import { customerOrder } from "../lib/db/schema/order"
import { returnPhoto, returnRequest } from "../lib/db/schema/return"

import {
  cleanupOrphanReturnPhotos,
  returnPhotoObjectKey,
  RETURN_PHOTO_GC_MAX_AGE_MS,
  type ReturnPhotoGcDependencies,
  type ReturnPhotoGcObject,
} from "../lib/returns/photos"

const now = new Date("2026-09-07T00:00:00.000Z")
const staleDate = new Date(now.getTime() - RETURN_PHOTO_GC_MAX_AGE_MS - 1)
const recentDate = new Date(now.getTime() - RETURN_PHOTO_GC_MAX_AGE_MS + 1)

function photoKey() {
  return returnPhotoObjectKey({ returnId: randomUUID(), photoId: randomUUID() })
}

function object(key: string, lastModified: Date): ReturnPhotoGcObject {
  return { key, lastModified }
}

function dependencies({
  objects,
  referencedKeys = [],
  onDelete,
}: {
  readonly objects: ReturnPhotoGcObject[]
  readonly referencedKeys?: readonly string[]
  readonly onDelete?: (keys: readonly string[]) => Promise<void>
}) {
  const deleted: string[] = []
  const references = new Set(referencedKeys)
  const result: ReturnPhotoGcDependencies = {
    listObjects: async () => objects,
    findReferencedKeys: async (keys) =>
      keys.filter((key) => references.has(key)),
    deleteObjects: async (keys) => {
      if (onDelete) {
        await onDelete(keys)
      }
      deleted.push(...keys)
      for (const key of keys) {
        const index = objects.findIndex((item) => item.key === key)
        if (index >= 0) objects.splice(index, 1)
      }
    },
  }
  return { dependencies: result, deleted }
}

test("GC deletes only stale, unreferenced return photos", async () => {
  const referencedKey = photoKey()
  const recentKey = photoKey()
  const staleKey = photoKey()
  const objects = [
    object(referencedKey, staleDate),
    object(recentKey, recentDate),
    object(staleKey, staleDate),
    object("reviews/review-1/detail.webp", staleDate),
    object("returns/return-1/not-a-photo.txt", staleDate),
  ]
  const fake = dependencies({
    objects,
    referencedKeys: [referencedKey],
  })

  const result = await cleanupOrphanReturnPhotos({
    now,
    dependencies: fake.dependencies,
  })

  assert.deepEqual(fake.deleted, [staleKey])
  assert.deepEqual(result, {
    scanned: 5,
    stale: 2,
    referenced: 1,
    deleted: 1,
    failed: 0,
  })
})

test("GC keeps a reference committed after the first reference check", async () => {
  const staleKey = photoKey()
  const objects = [object(staleKey, staleDate)]
  let referenceChecks = 0
  const dependencies: ReturnPhotoGcDependencies = {
    listObjects: async () => objects,
    findReferencedKeys: async (keys) => {
      referenceChecks += 1
      return referenceChecks === 2 ? keys : []
    },
    deleteObjects: async () => {
      throw new Error("The committed reference must prevent deletion.")
    },
  }

  const result = await cleanupOrphanReturnPhotos({
    now,
    dependencies,
  })

  assert.equal(referenceChecks, 2)
  assert.equal(result.deleted, 0)
  assert.equal(result.referenced, 1)
})

test("GC is idempotent when a later run sees the object already deleted", async () => {
  const staleKey = photoKey()
  const objects = [object(staleKey, staleDate)]
  const fake = dependencies({ objects })

  const first = await cleanupOrphanReturnPhotos({
    now,
    dependencies: fake.dependencies,
  })
  const second = await cleanupOrphanReturnPhotos({
    now,
    dependencies: fake.dependencies,
  })

  assert.equal(first.deleted, 1)
  assert.equal(second.deleted, 0)
  assert.deepEqual(fake.deleted, [staleKey])
})

test("GC logs a deletion failure and retries it on the next run", async () => {
  const staleKey = photoKey()
  const objects = [object(staleKey, staleDate)]
  let attempts = 0
  const errors: unknown[][] = []
  const previousError = console.error
  console.error = (...args: unknown[]) => {
    errors.push(args)
  }
  const dependencies: ReturnPhotoGcDependencies = {
    listObjects: async () => objects,
    findReferencedKeys: async () => [],
    deleteObjects: async () => {
      attempts += 1
      if (attempts === 1) throw new Error("B2 unavailable")
      objects.splice(0, 1)
    },
  }

  try {
    const failed = await cleanupOrphanReturnPhotos({ now, dependencies })
    const recovered = await cleanupOrphanReturnPhotos({ now, dependencies })

    assert.equal(failed.failed, 1)
    assert.equal(failed.deleted, 0)
    assert.equal(recovered.deleted, 1)
    assert.equal(attempts, 2)
    assert.equal(errors.length, 1)
    assert.match(String(errors[0]?.[0]), /Return photo GC deletion failed/)
    assert.deepEqual(errors[0]?.[1], {
      event: "returns.photo_gc_delete_failed",
      objectKey: staleKey,
      error: "B2 unavailable",
    })
  } finally {
    console.error = previousError
  }
})

test("GC uses committed database photo references after an ambiguous response", async () => {
  const id = randomUUID()
  const objectKey = returnPhotoObjectKey({ returnId: id, photoId: id })
  const staleKey = photoKey()
  const deleted: string[] = []
  try {
    await db
      .insert(user)
      .values({ id, name: "GC fixture", email: `${id}@example.test` })
    await db.insert(customerOrder).values({
      id,
      userId: id,
      sourceKind: "manual",
      paymentStatus: "paid",
      fulfillmentStatus: "completed",
      completedAt: new Date(),
      shippingCourier: "manual",
      shippingCourierName: "Manual",
      shippingService: "Pickup",
      shippingCost: 0,
      grossAmount: 100,
      addressSnapshot: {
        recipient: "Fixture",
        phone: "08123456789",
        street: "Street",
        province: "Province",
        city: "City",
        district: "District",
        subdistrict: "Village",
        postalCode: "12345",
      },
    })
    await db
      .insert(returnRequest)
      .values({ id, orderId: id, reason: "damaged", details: "Fixture" })
    await db.insert(returnPhoto).values({ id, returnId: id, objectKey })
    // Only storage is mocked; use the production database reference lookup.
    const result = await cleanupOrphanReturnPhotos({
      now,
      dependencies: {
        listObjects: async () => [
          object(objectKey, staleDate),
          object(staleKey, staleDate),
        ],
        deleteObjects: async (keys) => {
          deleted.push(...keys)
        },
      },
    })
    assert.equal(result.referenced, 1)
    assert.deepEqual(deleted, [staleKey])
  } finally {
    await db.delete(returnPhoto).where(eq(returnPhoto.id, id))
    await db.delete(returnRequest).where(eq(returnRequest.id, id))
    await db.delete(customerOrder).where(eq(customerOrder.id, id))
    await db.delete(user).where(eq(user.id, id))
  }
})
