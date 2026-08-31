import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import type { RatingBreakdown, Review } from "../../products/config"
import type {
  StoredProductImage,
  StoredProductVariant,
} from "../../products/schema"
import type { CategorySlug } from "../../site/config"

export type {
  StoredProductImage,
  StoredProductVariant,
} from "../../products/schema"

export const product = pgTable(
  "product",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: text("category").$type<CategorySlug>().notNull(),
    description: jsonb("description")
      .$type<readonly [string, ...string[]]>()
      .notNull(),
    images: jsonb("images")
      .$type<readonly [StoredProductImage, ...StoredProductImage[]]>()
      .notNull(),
    variants: jsonb("variants")
      .$type<readonly StoredProductVariant[]>()
      .notNull(),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    stock: integer("stock").notNull(),
    sold: integer("sold").default(0).notNull(),
    weight: integer("weight").notNull(),
    ratings: jsonb("ratings").$type<RatingBreakdown>().notNull(),
    reviews: jsonb("reviews").$type<readonly Review[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_slug_uidx").on(table.slug),
    index("product_category_idx").on(table.category),
    check(
      "product_category_valid",
      sql`${table.category} in ('hunting', 'fishing', 'spareparts', 'hobbies')`
    ),
    check("product_price_positive", sql`${table.price} > 0`),
    check(
      "product_compare_at_price_valid",
      sql`${table.compareAtPrice} is null or ${table.compareAtPrice} > ${table.price}`
    ),
    check("product_stock_nonnegative", sql`${table.stock} >= 0`),
    check("product_sold_nonnegative", sql`${table.sold} >= 0`),
    check("product_weight_positive", sql`${table.weight} > 0`),
  ]
)

export const productListing = pgTable(
  "product_listing",
  {
    productId: text("product_id")
      .primaryKey()
      .references(() => product.id, { onDelete: "cascade" }),
    state: text("state")
      .$type<"active" | "inactive" | "draft" | "deleted">()
      .notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("productListing_state_updatedAt_idx").on(
      table.state,
      table.updatedAt
    ),
    check(
      "productListing_state_valid",
      sql`${table.state} in ('active', 'inactive', 'draft', 'deleted')`
    ),
  ]
)
