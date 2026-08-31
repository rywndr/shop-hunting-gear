import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { user } from "./auth"

export const address = pgTable(
  "address",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    recipient: text("recipient").notNull(),
    phone: text("phone").notNull(),
    street: text("street").notNull(),
    province: text("province").notNull(),
    provinceId: integer("province_id"),
    city: text("city").notNull(),
    cityId: integer("city_id"),
    district: text("district").notNull(),
    districtId: integer("district_id"),
    subdistrict: text("subdistrict").notNull(),
    subdistrictId: integer("subdistrict_id"),
    postalCode: text("postal_code").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("address_userId_idx").on(table.userId),
    uniqueIndex("address_userId_primary_uidx")
      .on(table.userId)
      .where(sql`${table.isPrimary}`),
  ]
)
