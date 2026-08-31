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
import { sql } from "drizzle-orm"

import type { CartVariant } from "../../cart/config"
import { user } from "./auth"

export const cartItem = pgTable(
  "cart_item",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productSlug: text("product_slug").notNull(),
    variantKey: text("variant_key").notNull(),
    variants: jsonb("variants").$type<readonly CartVariant[]>().notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("cartItem_quantity_positive", sql`${table.quantity} > 0`),
    uniqueIndex("cartItem_userId_productSlug_variantKey_uidx").on(
      table.userId,
      table.productSlug,
      table.variantKey
    ),
    index("cartItem_userId_idx").on(table.userId),
  ]
)
