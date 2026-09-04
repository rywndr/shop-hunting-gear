import assert from "node:assert/strict"
import test from "node:test"
import sharp from "sharp"

import { mergeReviews } from "../lib/reviews/merge"
import {
  REVIEW_LIMITS,
  reviewFormSchema,
  reviewUploadIntentRequestSchema,
  validateReviewMedia,
} from "../lib/reviews/schema"
import { validateReviewImageBytes } from "../lib/reviews/storage"
import {
  signReviewUploadToken,
  verifyReviewUploadToken,
  type ReviewUploadTokenPayload,
} from "../lib/reviews/upload-intent"

const image = { mime: "image/jpeg", size: 1024 }
const secret = "test-review-upload-secret-with-enough-entropy"

function tokenPayload(overrides: Partial<ReviewUploadTokenPayload> = {}) {
  return {
    version: 1,
    userId: "user-1",
    orderId: "order-1",
    orderItemId: "item-1",
    uploadSessionId: "11111111-1111-4111-8111-111111111111",
    files: [
      {
        mediaId: "22222222-2222-4222-8222-222222222222",
        stagingKey:
          "review-uploads/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/source",
        expectedMime: "image/jpeg" as const,
        expectedSize: 1024,
        sortOrder: 0,
      },
    ],
    expiresAt: 2_000_000,
    ...overrides,
  } satisfies ReviewUploadTokenPayload
}

test("review fields require rating 1-5 and a trimmed body", () => {
  assert.equal(
    reviewFormSchema.safeParse({ orderItemId: "item", rating: 0, body: "baik" })
      .success,
    false
  )
  assert.equal(
    reviewFormSchema.safeParse({ orderItemId: "item", rating: 6, body: "baik" })
      .success,
    false
  )
  assert.equal(
    reviewFormSchema.safeParse({ orderItemId: "item", rating: 5, body: "   " })
      .success,
    false
  )
  assert.equal(
    reviewFormSchema.safeParse({
      orderItemId: "item",
      rating: 5,
      body: "x".repeat(1001),
    }).success,
    false
  )
  const parsed = reviewFormSchema.parse({
    orderItemId: " item ",
    rating: 5,
    body: "  bagus  ",
  })
  assert.equal(parsed.orderItemId, "item")
  assert.equal(parsed.body, "bagus")
})

test("review images validate count, MIME, individual size, and total size", () => {
  assert.equal(validateReviewMedia([image]).kind, "valid")
  assert.equal(
    validateReviewMedia(Array.from({ length: 5 }, () => image)).kind,
    "too-large"
  )
  assert.equal(
    validateReviewMedia([{ mime: "video/mp4", size: 100 }]).kind,
    "unsupported"
  )
  assert.equal(
    validateReviewMedia([
      { mime: "image/png", size: REVIEW_LIMITS.maxImageBytes + 1 },
    ]).kind,
    "too-large"
  )
  assert.equal(
    validateReviewMedia([
      { mime: "image/png", size: REVIEW_LIMITS.maxImageBytes },
      { mime: "image/png", size: REVIEW_LIMITS.maxImageBytes },
      { mime: "image/png", size: REVIEW_LIMITS.maxImageBytes },
      { mime: "image/png", size: REVIEW_LIMITS.maxImageBytes },
    ]).kind,
    "valid"
  )
  assert.equal(
    reviewUploadIntentRequestSchema.safeParse({
      orderItemId: "item",
      files: [{ mime: "video/webm", size: 1 }],
    }).success,
    false
  )
})

test("upload tokens reject tampering and expiration", () => {
  const token = signReviewUploadToken(tokenPayload(), secret)
  const valid = verifyReviewUploadToken(token, { secret, now: 1_000_000 })
  assert.equal(valid.kind, "valid")
  assert.equal(
    verifyReviewUploadToken(`${token.slice(0, -1)}x`, {
      secret,
      now: 1_000_000,
    }).kind,
    "invalid"
  )
  assert.equal(
    verifyReviewUploadToken(token, { secret, now: 2_000_000 }).kind,
    "expired"
  )
})

test("upload token binds user, order, and item", () => {
  const token = signReviewUploadToken(tokenPayload(), secret)
  const result = verifyReviewUploadToken(token, { secret, now: 1_000_000 })
  assert.equal(result.kind, "valid")
  if (result.kind !== "valid") return
  assert.notEqual(result.payload.userId, "user-2")
  assert.notEqual(result.payload.orderId, "order-2")
  assert.notEqual(result.payload.orderItemId, "item-2")
})

test("review image validation accepts JPEG, PNG, and WebP", async () => {
  const source = sharp({
    create: { width: 8, height: 8, channels: 3, background: "red" },
  })
  const [jpeg, png, webp] = await Promise.all([
    source.clone().jpeg().toBuffer(),
    source.clone().png().toBuffer(),
    source.clone().webp().toBuffer(),
  ])
  await validateReviewImageBytes({ bytes: jpeg, expectedMime: "image/jpeg" })
  await validateReviewImageBytes({ bytes: png, expectedMime: "image/png" })
  await validateReviewImageBytes({ bytes: webp, expectedMime: "image/webp" })
  await assert.rejects(
    validateReviewImageBytes({ bytes: png, expectedMime: "image/jpeg" })
  )
  await assert.rejects(
    validateReviewImageBytes({
      bytes: new Uint8Array([1, 2, 3]),
      expectedMime: "image/png",
    })
  )
})

test("relational and legacy reviews merge newest first", () => {
  const base = {
    author: "Pembeli",
    rating: 5 as const,
    variant: null,
    body: "Bagus",
  }
  const merged = mergeReviews(
    [{ ...base, id: "legacy", createdAt: "2025-01-01T00:00:00Z" }],
    [{ ...base, id: "customer", createdAt: "2026-01-01T00:00:00Z", media: [] }]
  )
  assert.deepEqual(
    merged.map(({ id }) => id),
    ["customer", "legacy"]
  )
})
