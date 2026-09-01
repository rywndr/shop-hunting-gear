import "server-only"

import "server-only"

import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm"

import {
  isListingState,
  type Listing,
  type ListingCategoryFilter,
  type ListingQuery,
  type ListingSort,
  type ListingSortColumn,
  type ListingState,
  type ListingStateFilter,
} from "../admin/catalog"
import { ALL_FILTER } from "../admin/config"
import { canAccessAdmin, getCurrentSession } from "../auth/session"
import { db } from "../db/client"
import {
  product as productTable,
  productListing,
  type StoredProductImage,
  type StoredProductVariant,
} from "../db/schema/product"
import { productImageHref, type Product, type RatingBreakdown } from "./config"
import { storedProductDataSchema, storedProductImageSchema } from "./schema"

const EMPTY_RATINGS = {
  5: 0,
  4: 0,
  3: 0,
  2: 0,
  1: 0,
} as const satisfies RatingBreakdown

type ProductRow = typeof productTable.$inferSelect

async function assertAdminAccess() {
  if (!canAccessAdmin(await getCurrentSession())) {
    throw new Error("Unauthorized admin product access.")
  }
}

export type EditableProduct = Pick<
  ProductRow,
  | "id"
  | "name"
  | "category"
  | "description"
  | "images"
  | "variants"
  | "price"
  | "compareAtPrice"
  | "stock"
  | "weight"
> & { readonly imageUrls: readonly string[] }

function isMissingProductTable(error: unknown) {
  let current = error

  for (let depth = 0; depth < 4; depth += 1) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      current.code === "42P01"
    ) {
      return true
    }

    if (!(current instanceof Error)) {
      return false
    }

    current = current.cause
  }

  return false
}

async function readProductTables<T>({
  query,
  missingTableValue,
}: {
  query: () => Promise<T>
  missingTableValue: T
}) {
  try {
    return await query()
  } catch (error) {
    if (isMissingProductTable(error)) {
      return missingTableValue
    }

    throw error
  }
}

function domainProduct(row: ProductRow): Product {
  const parsed = storedProductDataSchema.safeParse(row)

  if (!parsed.success) {
    throw new Error("Invalid stored product data.")
  }

  const [firstDescription, ...otherDescriptions] = parsed.data.description
  const [firstImage, ...otherImages] = parsed.data.images

  return {
    slug: row.slug,
    name: row.name,
    category: parsed.data.category,
    price: row.price,
    compareAtPrice: row.compareAtPrice,
    stock: row.stock,
    sold: row.sold,
    weight: row.weight,
    description: [firstDescription, ...otherDescriptions],
    images: [
      {
        id: firstImage.id,
        alt: firstImage.alt,
        url: productImageHref({ productId: row.id, imageId: firstImage.id }),
      },
      ...otherImages.map(({ id, alt }) => ({
        id,
        alt,
        url: productImageHref({ productId: row.id, imageId: id }),
      })),
    ],
    variants: parsed.data.variants.map(({ label, options }) => {
      const [firstOption, ...otherOptions] = options

      return {
        label,
        options: [firstOption.value, ...otherOptions.map(({ value }) => value)],
      }
    }),
    ratings: parsed.data.ratings,
    reviews: parsed.data.reviews,
  }
}

export async function storefrontProducts(): Promise<readonly Product[]> {
  const rows = await readProductTables({
    query: () =>
      db
        .select({ product: productTable })
        .from(productTable)
        .innerJoin(
          productListing,
          eq(productListing.productId, productTable.id)
        )
        .where(eq(productListing.state, "active"))
        .orderBy(asc(productTable.createdAt)),
    missingTableValue: [],
  })

  return rows.map(({ product }) => domainProduct(product))
}

export async function storefrontProductBySlug(
  slug: string
): Promise<Product | undefined> {
  const rows = await readProductTables({
    query: () =>
      db
        .select({ product: productTable })
        .from(productTable)
        .innerJoin(
          productListing,
          eq(productListing.productId, productTable.id)
        )
        .where(
          and(eq(productTable.slug, slug), eq(productListing.state, "active"))
        )
        .limit(1),
    missingTableValue: [],
  })
  const [row] = rows

  return row ? domainProduct(row.product) : undefined
}

export async function adminProductListings(): Promise<
  readonly Listing<Product>[]
> {
  await assertAdminAccess()

  const rows = await readProductTables({
    query: () =>
      db
        .select({ product: productTable, listing: productListing })
        .from(productTable)
        .innerJoin(
          productListing,
          eq(productListing.productId, productTable.id)
        )
        .orderBy(asc(productListing.uploadedAt)),
    missingTableValue: [],
  })

  return rows.map(({ product, listing }) => ({
    id: product.id,
    product: domainProduct(product),
    state: listing.state,
    uploadedAt: listing.uploadedAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  }))
}

function listingFilter({
  state,
  category,
  search,
}: {
  readonly state: ListingStateFilter
  readonly category: ListingCategoryFilter
  readonly search: string
}) {
  const stateCondition =
    state === ALL_FILTER
      ? ne(productListing.state, "deleted")
      : eq(productListing.state, state)
  const categoryCondition =
    category === ALL_FILTER ? undefined : eq(productTable.category, category)
  const normalizedSearch = search.trim()
  const searchCondition = normalizedSearch
    ? or(
        ilike(productTable.name, `%${normalizedSearch}%`),
        ilike(productTable.id, `%${normalizedSearch}%`)
      )
    : undefined

  return and(stateCondition, categoryCondition, searchCondition)
}

function listingSortColumn(column: ListingSortColumn) {
  switch (column) {
    case "status":
      return productListing.updatedAt
    case "price":
      return productTable.price
    case "stock":
      return productTable.stock
    default: {
      const _exhaustive: never = column
      return _exhaustive
    }
  }
}

function listingOrder(sort: ListingSort | null) {
  if (sort === null) {
    return [asc(productListing.uploadedAt)]
  }

  const column = listingSortColumn(sort.column)

  return [
    sort.direction === "asc" ? asc(column) : desc(column),
    asc(productListing.uploadedAt),
  ]
}

function emptyListingStateCounts() {
  return {
    all: 0,
    active: 0,
    inactive: 0,
    draft: 0,
    deleted: 0,
  } satisfies Record<ListingStateFilter, number>
}

export type ListingPage = {
  readonly listings: readonly Listing<Product>[]
  readonly counts: Readonly<Record<ListingStateFilter, number>>
  readonly total: number
}

export async function adminListingPage({
  state,
  category,
  search,
  sort,
  page,
  pageSize,
}: ListingQuery & {
  readonly page: number
  readonly pageSize: number
}): Promise<ListingPage> {
  await assertAdminAccess()

  const where = listingFilter({ state, category, search })
  const safePage = Math.max(1, Math.floor(page))
  const safePageSize = Math.max(1, Math.floor(pageSize))
  const { totalRows, countRows, rows } = await readProductTables({
    query: async () => {
      const [totalRows, countRows, rows] = await Promise.all([
        db
          .select({ total: sql<number>`count(*)` })
          .from(productTable)
          .innerJoin(
            productListing,
            eq(productListing.productId, productTable.id)
          )
          .where(where),
        db
          .select({
            state: productListing.state,
            total: sql<number>`count(*)`,
          })
          .from(productListing)
          .groupBy(productListing.state),
        db
          .select({ product: productTable, listing: productListing })
          .from(productTable)
          .innerJoin(
            productListing,
            eq(productListing.productId, productTable.id)
          )
          .where(where)
          .orderBy(...listingOrder(sort))
          .limit(safePageSize)
          .offset((safePage - 1) * safePageSize),
      ])

      return { totalRows, countRows, rows }
    },
    missingTableValue: {
      totalRows: [] as { total: number }[],
      countRows: [] as { state: ListingState; total: number }[],
      rows: [] as {
        product: ProductRow
        listing: typeof productListing.$inferSelect
      }[],
    },
  })
  const counts = emptyListingStateCounts()

  for (const row of countRows) {
    const total = Number(row.total)
    counts[row.state] += total

    if (row.state !== "deleted") {
      counts.all += total
    }
  }

  return {
    listings: rows.map(({ product, listing }) => ({
      id: product.id,
      product: domainProduct(product),
      state: listing.state,
      uploadedAt: listing.uploadedAt.toISOString(),
      updatedAt: listing.updatedAt.toISOString(),
    })),
    counts,
    total: Number(totalRows[0]?.total ?? 0),
  }
}

export async function adminProductForEdit(
  productId: string
): Promise<EditableProduct | undefined> {
  await assertAdminAccess()

  const rows = await readProductTables({
    query: () =>
      db
        .select()
        .from(productTable)
        .where(eq(productTable.id, productId))
        .limit(1),
    missingTableValue: [],
  })
  const [row] = rows
  if (!row) return undefined

  const parsed = storedProductDataSchema.safeParse(row)
  if (!parsed.success) throw new Error("Invalid stored product data.")
  const [firstDescription, ...otherDescriptions] = parsed.data.description
  const [firstImage, ...otherImages] = parsed.data.images

  return {
    id: row.id,
    name: row.name,
    category: parsed.data.category,
    description: [firstDescription, ...otherDescriptions],
    images: [firstImage, ...otherImages],
    imageUrls: parsed.data.images.map(({ id }) =>
      productImageHref({ productId: row.id, imageId: id })
    ),
    variants: parsed.data.variants,
    price: row.price,
    compareAtPrice: row.compareAtPrice,
    stock: row.stock,
    weight: row.weight,
  }
}

export async function updateProductDetails({
  productId,
  values,
}: {
  productId: string
  values: {
    readonly name: string
    readonly category: Product["category"]
    readonly description: readonly [string, ...string[]]
    readonly images: readonly [StoredProductImage, ...StoredProductImage[]]
    readonly variants: readonly StoredProductVariant[]
    readonly price: number
    readonly compareAtPrice: number | null
    readonly stock: number
    readonly weight: number
  }
}) {
  await assertAdminAccess()

  await db
    .update(productTable)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(productTable.id, productId))
}

export async function storedProductImage({
  productId,
  imageId,
}: {
  productId: string
  imageId: string
}): Promise<
  | {
      readonly image: StoredProductImage
      readonly state: ListingState
    }
  | undefined
> {
  const rows = await readProductTables({
    query: () =>
      db
        .select({ images: productTable.images, state: productListing.state })
        .from(productTable)
        .innerJoin(
          productListing,
          eq(productListing.productId, productTable.id)
        )
        .where(eq(productTable.id, productId))
        .limit(1),
    missingTableValue: [],
  })
  const [row] = rows

  if (!row) {
    return undefined
  }

  const images = storedProductImageSchema.array().safeParse(row.images)

  if (!images.success || !isListingState(row.state)) {
    throw new Error("Invalid stored product image data.")
  }

  const image = images.data.find(({ id }) => id === imageId)
  return image ? { image, state: row.state } : undefined
}

export async function createProduct({
  id,
  slug,
  name,
  category,
  description,
  images,
  variants,
  price,
  compareAtPrice,
  stock,
  weight,
  state,
}: {
  id: string
  slug: string
  name: string
  category: Product["category"]
  description: Product["description"]
  images: readonly [StoredProductImage, ...StoredProductImage[]]
  variants: readonly StoredProductVariant[]
  price: number
  compareAtPrice: number | null
  stock: number
  weight: number
  state: Extract<ListingState, "active" | "draft">
}) {
  await assertAdminAccess()

  await db.batch([
    db.insert(productTable).values({
      id,
      slug,
      name,
      category,
      description,
      images,
      variants,
      price,
      compareAtPrice,
      stock,
      weight,
      ratings: EMPTY_RATINGS,
      reviews: [],
    }),
    db.insert(productListing).values({ productId: id, state }),
  ])

  return id
}

export async function updateProductListingState({
  productIds,
  state,
}: {
  productIds: readonly string[]
  state: ListingState
}) {
  await assertAdminAccess()

  if (productIds.length === 0) return

  await db
    .update(productListing)
    .set({ state, updatedAt: new Date() })
    .where(inArray(productListing.productId, productIds))
}

export async function updateProductInventory({
  productId,
  field,
  value,
}: {
  productId: string
  field: "price" | "stock"
  value: number
}) {
  await assertAdminAccess()

  await db
    .update(productTable)
    .set(field === "price" ? { price: value } : { stock: value })
    .where(eq(productTable.id, productId))
}
