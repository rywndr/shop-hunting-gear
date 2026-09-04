import "server-only"

import { randomUUID } from "node:crypto"
import { asc, desc, eq, sql } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { customerOrder, customerOrderItem } from "@/lib/db/schema/order"
import { product } from "@/lib/db/schema/product"
import { productReview, productReviewMedia } from "@/lib/db/schema/review"
import type { RatingStar, Review } from "@/lib/products/config"
import type { ReviewFinalizeRequest } from "./schema"
import {
  deleteReviewObjects,
  processStagedReviewImage,
  reviewMediaUrls,
  ReviewImageUploadError,
  type StoredReviewMedia,
} from "./storage"
import {
  verifyReviewUploadToken,
  type ReviewUploadTokenPayload,
} from "./upload-intent"

type EligibleReview = {
  readonly kind: "eligible"
  readonly item: Pick<typeof customerOrderItem.$inferSelect, "variants">
  readonly product: Pick<
    typeof product.$inferSelect,
    "id" | "slug" | "category"
  >
}

export type ReviewEligibilityResult =
  | EligibleReview
  | { readonly kind: "not-found" }
  | { readonly kind: "not-eligible" }
  | { readonly kind: "duplicate" }

export async function reviewEligibility({
  userId,
  orderId,
  orderItemId,
}: {
  readonly userId: string
  readonly orderId: string
  readonly orderItemId: string
}): Promise<ReviewEligibilityResult> {
  const [candidate] = await db
    .select({
      fulfillmentStatus: customerOrder.fulfillmentStatus,
      variants: customerOrderItem.variants,
      productId: product.id,
      productSlug: product.slug,
      productCategory: product.category,
      existingReviewId: productReview.id,
    })
    .from(customerOrder)
    .innerJoin(
      customerOrderItem,
      eq(customerOrderItem.orderId, customerOrder.id)
    )
    .innerJoin(product, eq(product.slug, customerOrderItem.productSlug))
    .leftJoin(
      productReview,
      eq(productReview.orderItemId, customerOrderItem.id)
    )
    .where(
      sql`${customerOrder.id} = ${orderId} and ${customerOrder.userId} = ${userId} and ${customerOrderItem.id} = ${orderItemId}`
    )
    .limit(1)

  if (!candidate) return { kind: "not-found" }
  if (candidate.fulfillmentStatus !== "completed") {
    return { kind: "not-eligible" }
  }
  if (candidate.existingReviewId) return { kind: "duplicate" }
  return {
    kind: "eligible",
    item: { variants: candidate.variants },
    product: {
      id: candidate.productId,
      slug: candidate.productSlug,
      category: candidate.productCategory,
    },
  }
}

export type CreateReviewResult =
  | {
      readonly kind: "created"
      readonly reviewId: string
      readonly orderItemId: string
      readonly productSlug: string
      readonly productCategory: (typeof product.$inferSelect)["category"]
    }
  | { readonly kind: "duplicate" }
  | { readonly kind: "not-found" }
  | { readonly kind: "not-eligible" }
  | { readonly kind: "invalid-upload" }

function variantLabel(
  variants: readonly { readonly label: string; readonly value: string }[]
) {
  const value = variants
    .map(({ label, value }) => `${label}: ${value}`)
    .join(", ")
  return value || null
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function cleanupReviewObjects({
  keys,
  event,
  reviewId,
}: {
  readonly keys: readonly string[]
  readonly event:
    "reviews.staging_cleanup_failed" | "reviews.canonical_cleanup_failed"
  readonly reviewId: string
}) {
  try {
    await deleteReviewObjects(keys)
  } catch (error) {
    console.error(
      JSON.stringify({ event, reviewId, keys, error: errorMessage(error) })
    )
  }
}

function matchingUploadPayload({
  token,
  userId,
  orderId,
  orderItemId,
}: {
  readonly token: string | null
  readonly userId: string
  readonly orderId: string
  readonly orderItemId: string
}): ReviewUploadTokenPayload | null | false {
  if (token === null) return null
  const verified = verifyReviewUploadToken(token)
  if (
    verified.kind !== "valid" ||
    verified.payload.userId !== userId ||
    verified.payload.orderId !== orderId ||
    verified.payload.orderItemId !== orderItemId
  ) {
    return false
  }
  return verified.payload
}

async function processReviewImages({
  files,
  productId,
  reviewId,
  uploaded,
  canonicalKeys,
}: {
  readonly files: ReviewUploadTokenPayload["files"]
  readonly productId: string
  readonly reviewId: string
  readonly uploaded: StoredReviewMedia[]
  readonly canonicalKeys: string[]
}) {
  for (let index = 0; index < files.length; index += 2) {
    const batch = files.slice(index, index + 2)
    const results = await Promise.allSettled(
      batch.map((file) =>
        processStagedReviewImage({ productId, reviewId, file })
      )
    )
    let failure: { readonly reason: unknown } | null = null

    for (const result of results) {
      if (result.status === "fulfilled") {
        uploaded.push(result.value)
        canonicalKeys.push(
          result.value.thumbnailObjectKey,
          result.value.objectKey
        )
      } else {
        failure ??= { reason: result.reason }
        if (result.reason instanceof ReviewImageUploadError) {
          canonicalKeys.push(...result.reason.uploadedObjectKeys)
        }
      }
    }

    if (failure) throw failure.reason
  }
}

export async function createReview({
  userId,
  author,
  orderId,
  values,
}: {
  readonly userId: string
  readonly author: string
  readonly orderId: string
  readonly values: ReviewFinalizeRequest
}): Promise<CreateReviewResult> {
  const eligibility = await reviewEligibility({
    userId,
    orderId,
    orderItemId: values.orderItemId,
  })
  if (eligibility.kind !== "eligible") return eligibility

  const upload = matchingUploadPayload({
    token: values.uploadToken,
    userId,
    orderId,
    orderItemId: values.orderItemId,
  })
  if (upload === false) return { kind: "invalid-upload" }

  const reviewId = randomUUID()
  const stagingKeys = upload?.files.map(({ stagingKey }) => stagingKey) ?? []
  const uploaded: StoredReviewMedia[] = []
  const canonicalKeys: string[] = []

  try {
    await processReviewImages({
      files: upload?.files ?? [],
      productId: eligibility.product.id,
      reviewId,
      uploaded,
      canonicalKeys,
    })

    const mediaValues =
      uploaded.length === 0
        ? sql`select null::text, null::text, null::text, null::text, null::integer, null::integer where false`
        : sql.join(
            uploaded.map(
              (item) =>
                sql`select ${item.id}, ${reviewId}, ${item.objectKey}, ${item.thumbnailObjectKey}, ${item.size}::integer, ${item.sortOrder}::integer`
            ),
            sql` union all `
          )
    const result = await db.execute<{ id: string }>(sql`
      WITH eligible AS MATERIALIZED (
        SELECT current_product.id AS product_id
        FROM customer_order AS current_order
        INNER JOIN customer_order_item AS item ON item.order_id = current_order.id
        INNER JOIN product AS current_product ON current_product.slug = item.product_slug
        WHERE current_order.id = ${orderId} AND current_order.user_id = ${userId}
          AND current_order.fulfillment_status = 'completed' AND item.id = ${values.orderItemId}
        FOR UPDATE OF current_product
      ), inserted_review AS (
        INSERT INTO product_review (id, product_id, order_item_id, user_id, author_snapshot, variant_snapshot, rating, body)
        SELECT ${reviewId}, eligible.product_id, ${values.orderItemId}, ${userId}, ${author}, ${variantLabel(eligibility.item.variants)}, ${values.rating}, ${values.body}
        FROM eligible
        ON CONFLICT (order_item_id) DO NOTHING
        RETURNING id, product_id
      ), inserted_media AS (
        INSERT INTO product_review_media (id, review_id, object_key, thumbnail_object_key, size, sort_order)
        SELECT media.* FROM (${mediaValues}) AS media(id, review_id, object_key, thumbnail_object_key, size, sort_order)
        INNER JOIN inserted_review ON inserted_review.id = media.review_id
        RETURNING id
      ), updated_rating AS (
        UPDATE product AS current_product SET ratings = jsonb_set(
          current_product.ratings, ARRAY[${String(values.rating)}],
          to_jsonb(coalesce((current_product.ratings ->> ${String(values.rating)})::integer, 0) + 1)
        ), updated_at = now()
        FROM inserted_review WHERE current_product.id = inserted_review.product_id
        RETURNING current_product.id
      )
      SELECT inserted_review.id FROM inserted_review
      WHERE (SELECT count(*) FROM inserted_media) = ${uploaded.length}
        AND (SELECT count(*) FROM updated_rating) = 1
    `)

    if (!result.rows[0]) {
      await cleanupReviewObjects({
        keys: canonicalKeys,
        event: "reviews.canonical_cleanup_failed",
        reviewId,
      })
      return { kind: "duplicate" }
    }

    return {
      kind: "created",
      reviewId,
      orderItemId: values.orderItemId,
      productSlug: eligibility.product.slug,
      productCategory: eligibility.product.category,
    }
  } catch (error) {
    await cleanupReviewObjects({
      keys: canonicalKeys,
      event: "reviews.canonical_cleanup_failed",
      reviewId,
    })
    throw error
  } finally {
    await cleanupReviewObjects({
      keys: stagingKeys,
      event: "reviews.staging_cleanup_failed",
      reviewId,
    })
  }
}

export async function storefrontReviewsForProduct(
  productId: string
): Promise<readonly Review[]> {
  const rows = await db
    .select({ review: productReview, media: productReviewMedia })
    .from(productReview)
    .leftJoin(
      productReviewMedia,
      eq(productReviewMedia.reviewId, productReview.id)
    )
    .where(eq(productReview.productId, productId))
    .orderBy(desc(productReview.createdAt), asc(productReviewMedia.sortOrder))
  const grouped = new Map<
    string,
    { review: typeof productReview.$inferSelect; media: StoredReviewMedia[] }
  >()
  for (const row of rows) {
    const entry = grouped.get(row.review.id) ?? {
      review: row.review,
      media: [],
    }
    if (row.media) entry.media.push(row.media)
    grouped.set(row.review.id, entry)
  }
  return Promise.all(
    [...grouped.values()].map(async ({ review, media }) => ({
      id: review.id,
      author: review.authorSnapshot,
      rating: review.rating as RatingStar,
      createdAt: review.createdAt.toISOString(),
      variant: review.variantSnapshot,
      body: review.body,
      media: await Promise.all(media.map(reviewMediaUrls)),
    }))
  )
}
