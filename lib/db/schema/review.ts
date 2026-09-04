import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { user } from "./auth"
import { customerOrderItem } from "./order"
import { product } from "./product"

export const productReview = pgTable(
  "product_review",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    orderItemId: text("order_item_id")
      .notNull()
      .references(() => customerOrderItem.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    authorSnapshot: text("author_snapshot").notNull(),
    variantSnapshot: text("variant_snapshot"),
    rating: integer("rating").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("productReview_orderItemId_uidx").on(table.orderItemId),
    index("productReview_productId_createdAt_idx").on(
      table.productId,
      table.createdAt
    ),
    check("productReview_rating_valid", sql`${table.rating} between 1 and 5`),
  ]
)

export const productReviewMedia = pgTable(
  "product_review_media",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => productReview.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    thumbnailObjectKey: text("thumbnail_object_key").notNull(),
    size: integer("size").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("productReviewMedia_reviewId_sortOrder_uidx").on(
      table.reviewId,
      table.sortOrder
    ),
    check(
      "productReviewMedia_sortOrder_nonnegative",
      sql`${table.sortOrder} >= 0`
    ),
    check("productReviewMedia_size_positive", sql`${table.size} > 0`),
  ]
)
