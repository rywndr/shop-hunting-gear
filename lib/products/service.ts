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
import {
  productImageHref,
  type Product,
  type ProductCard,
  type ProductData,
  type ProductDetail,
  type ProductImage,
  type ProductMetadata,
  type RatingBreakdown,
} from "./config"
import { presignedProductImageUrl } from "./storage"
import { storedProductDataSchema, storedProductImageSchema } from "./schema"

const EMPTY_RATINGS = {
  5: 0,
  4: 0,
  3: 0,
  2: 0,
  1: 0,
} as const satisfies RatingBreakdown

type ProductRow = typeof productTable.$inferSelect
type StorefrontProductRow = { product: ProductRow }

const EMPTY_PRODUCT_ROWS: StorefrontProductRow[] = []

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

type ProductImageContext = "data" | "card" | "detail" | "metadata" | "admin"

async function domainProductImage({
  productId,
  image,
  context,
}: {
  readonly productId: string
  readonly image: StoredProductImage
  readonly context: ProductImageContext
}): Promise<ProductImage> {
  switch (context) {
    case "data":
      return { id: image.id, alt: image.alt }
    case "admin":
      return {
        id: image.id,
        alt: image.alt,
        url: productImageHref({ productId, imageId: image.id }),
      }
    case "card": {
      const thumbnailUrl = await presignedProductImageUrl({
        image,
        rendition: "thumbnail",
        access: "storefront",
      })

      return {
        id: image.id,
        alt: image.alt,
        url: thumbnailUrl,
        thumbnailUrl,
      }
    }
    case "detail": {
      const [thumbnailUrl, detailUrl] = await Promise.all([
        presignedProductImageUrl({
          image,
          rendition: "thumbnail",
          access: "storefront",
        }),
        presignedProductImageUrl({
          image,
          rendition: "detail",
          access: "storefront",
        }),
      ])

      return {
        id: image.id,
        alt: image.alt,
        url: detailUrl,
        thumbnailUrl,
        detailUrl,
      }
    }
    case "metadata": {
      const detailUrl = await presignedProductImageUrl({
        image,
        rendition: "detail",
        access: "storefront",
      })

      return {
        id: image.id,
        alt: image.alt,
        url: detailUrl,
        detailUrl,
      }
    }
    default: {
      const _exhaustive: never = context
      return _exhaustive
    }
  }
}

function domainProduct(row: ProductRow, context: "data"): Promise<ProductData>
function domainProduct(row: ProductRow, context: "card"): Promise<ProductCard>
function domainProduct(
  row: ProductRow,
  context: "detail"
): Promise<ProductDetail>
function domainProduct(
  row: ProductRow,
  context: "metadata"
): Promise<ProductMetadata>
function domainProduct(row: ProductRow, context: "admin"): Promise<Product>
async function domainProduct(
  row: ProductRow,
  context: ProductImageContext
): Promise<Product> {
  const parsed = storedProductDataSchema.safeParse(row)

  if (!parsed.success) {
    throw new Error("Invalid stored product data.")
  }

  const [firstDescription, ...otherDescriptions] = parsed.data.description
  const [firstStoredImage, ...otherStoredImages] = parsed.data.images

  if (!firstStoredImage) {
    throw new Error("No stored product image.")
  }

  const sourceImages =
    context === "card"
      ? [firstStoredImage]
      : [firstStoredImage, ...otherStoredImages]
  const images = await Promise.all(
    sourceImages.map((image) =>
      domainProductImage({
        productId: row.id,
        image,
        context,
      })
    )
  )
  const [firstDomainImage, ...otherDomainImages] = images

  if (!firstDomainImage) {
    throw new Error("No stored product image.")
  }

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
    images: [firstDomainImage, ...otherDomainImages],
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

async function storefrontProductRows() {
  return readProductTables({
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
    missingTableValue: EMPTY_PRODUCT_ROWS,
  })
}

async function storefrontProductRowsBySlugs(slugs: readonly string[]) {
  if (slugs.length === 0) {
    return EMPTY_PRODUCT_ROWS
  }

  return readProductTables({
    query: () =>
      db
        .select({ product: productTable })
        .from(productTable)
        .innerJoin(
          productListing,
          eq(productListing.productId, productTable.id)
        )
        .where(
          and(
            inArray(productTable.slug, slugs),
            eq(productListing.state, "active")
          )
        ),
    missingTableValue: EMPTY_PRODUCT_ROWS,
  })
}

async function storefrontProductRowBySlug(slug: string) {
  const rows = await storefrontProductRowsBySlugs([slug])
  return rows[0]?.product
}

export async function storefrontProductData(): Promise<readonly ProductData[]> {
  const rows = await storefrontProductRows()
  return Promise.all(rows.map(({ product }) => domainProduct(product, "data")))
}

export async function storefrontProductDataBySlug(
  slug: string
): Promise<ProductData | undefined> {
  const row = await storefrontProductRowBySlug(slug)
  return row ? domainProduct(row, "data") : undefined
}

export async function storefrontProductCardBySlug(
  slug: string
): Promise<ProductCard | undefined> {
  const row = await storefrontProductRowBySlug(slug)
  return row ? domainProduct(row, "card") : undefined
}

export async function storefrontProductDetailBySlug(
  slug: string
): Promise<ProductDetail | undefined> {
  const row = await storefrontProductRowBySlug(slug)
  return row ? domainProduct(row, "detail") : undefined
}

export async function storefrontProductMetadataBySlug(
  slug: string
): Promise<ProductMetadata | undefined> {
  const row = await storefrontProductRowBySlug(slug)
  return row ? domainProduct(row, "metadata") : undefined
}

export async function storefrontProductCards(
  products: readonly Pick<ProductData, "slug">[]
): Promise<readonly ProductCard[]> {
  const rows = await storefrontProductRowsBySlugs(
    products.map(({ slug }) => slug)
  )
  const productsBySlug = new Map(
    rows.map(({ product }) => [product.slug, product])
  )
  const cards = await Promise.all(
    products.map(async ({ slug }) => {
      const row = productsBySlug.get(slug)
      return row ? domainProduct(row, "card") : undefined
    })
  )

  return cards.filter(
    (product): product is ProductCard => product !== undefined
  )
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

  return Promise.all(
    rows.map(async ({ product, listing }) => ({
      id: product.id,
      product: await domainProduct(product, "admin"),
      state: listing.state,
      uploadedAt: listing.uploadedAt.toISOString(),
      updatedAt: listing.updatedAt.toISOString(),
    }))
  )
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
    listings: await Promise.all(
      rows.map(async ({ product, listing }) => ({
        id: product.id,
        product: await domainProduct(product, "admin"),
        state: listing.state,
        uploadedAt: listing.uploadedAt.toISOString(),
        updatedAt: listing.updatedAt.toISOString(),
      }))
    ),
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

export type BulkProductRow = {
  readonly id: string
  readonly name: string
  readonly images: readonly StoredProductImage[]
  readonly price: number
  readonly compareAtPrice: number | null
  readonly stock: number
  readonly weight: number
  readonly state: ListingState
}

export type BulkProduct = BulkProductRow & {
  readonly variants: readonly StoredProductVariant[]
}

const BULK_PRODUCT_COLUMNS = {
  id: productTable.id,
  name: productTable.name,
  images: productTable.images,
  price: productTable.price,
  compareAtPrice: productTable.compareAtPrice,
  stock: productTable.stock,
  weight: productTable.weight,
  state: productListing.state,
} as const

export async function adminBulkProductRows(): Promise<
  readonly BulkProductRow[]
> {
  await assertAdminAccess()

  return readProductTables({
    query: () =>
      db
        .select(BULK_PRODUCT_COLUMNS)
        .from(productTable)
        .innerJoin(
          productListing,
          eq(productListing.productId, productTable.id)
        )
        .where(ne(productListing.state, "deleted"))
        .orderBy(asc(productListing.uploadedAt)),
    missingTableValue: [],
  })
}

export async function adminBulkProductsByIds(
  productIds: readonly string[]
): Promise<ReadonlyMap<string, BulkProduct>> {
  await assertAdminAccess()

  if (productIds.length === 0) {
    return new Map()
  }

  const rows = await readProductTables({
    query: () =>
      db
        .select({
          ...BULK_PRODUCT_COLUMNS,
          variants: productTable.variants,
        })
        .from(productTable)
        .innerJoin(
          productListing,
          eq(productListing.productId, productTable.id)
        )
        .where(inArray(productTable.id, [...new Set(productIds)])),
    missingTableValue: [],
  })

  return new Map(rows.map((row) => [row.id, row]))
}

export async function updateBulkProduct({
  productId,
  values,
  state,
}: {
  productId: string
  values: {
    readonly name?: string
    readonly price?: number
    readonly compareAtPrice?: number | null
    readonly stock?: number
    readonly weight?: number
    readonly images?: readonly [StoredProductImage, ...StoredProductImage[]]
    readonly variants?: readonly StoredProductVariant[]
  }
  state?: ListingState
}) {
  await assertAdminAccess()

  const productUpdate =
    Object.keys(values).length > 0
      ? db
          .update(productTable)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(productTable.id, productId))
      : undefined
  const listingUpdate = state
    ? db
        .update(productListing)
        .set({ state, updatedAt: new Date() })
        .where(eq(productListing.productId, productId))
    : undefined

  if (productUpdate && listingUpdate) {
    await db.batch([productUpdate, listingUpdate])
    return
  }

  await (productUpdate ?? listingUpdate)
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
  compareAtPrice,
}: {
  productId: string
  field: "price" | "stock"
  value: number
  compareAtPrice?: number | null
}) {
  await assertAdminAccess()

  await db
    .update(productTable)
    .set(
      field === "price"
        ? { price: value, compareAtPrice: compareAtPrice ?? null }
        : { stock: value }
    )
    .where(eq(productTable.id, productId))
}
