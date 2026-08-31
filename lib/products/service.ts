import "server-only"

import { and, asc, eq, inArray } from "drizzle-orm"

import {
  isListingState,
  type Listing,
  type ListingState,
} from "../admin/catalog"
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

export async function adminProductForEdit(
  productId: string
): Promise<EditableProduct | undefined> {
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
  await db
    .update(productTable)
    .set(field === "price" ? { price: value } : { stock: value })
    .where(eq(productTable.id, productId))
}
