"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"

import {
  PRODUCT_PAYLOAD_FIELD,
  productSubmissionSchema,
  resolveProductSubmission,
} from "@/lib/admin/product-submission"
import { canAccessAdmin, getCurrentSession } from "@/lib/auth/session"
import type {
  StoredProductImage,
  StoredProductVariant,
} from "@/lib/db/schema/product"
import {
  isProductSaveMode,
  type ProductImageDraft,
} from "@/lib/admin/product-form"
import {
  descriptionParagraphs,
  newProductId,
  productImageAlt,
  productSlug,
} from "@/lib/products/identity"
import { createProduct } from "@/lib/products/service"
import {
  deleteProductImages,
  isProductImageMime,
  ProductImageUploadError,
  productImageObjectKeys,
  uploadProductImage,
} from "@/lib/products/storage"

const MAX_SUBMISSION_BYTES = 30 * 1024 * 1024

function newImageFile(image: ProductImageDraft) {
  if (image.kind !== "new") throw new Error("Existing image in new product.")
  return image.file
}

type ProductCreateStage = "upload" | "database"

export type CreateProductResult =
  | { readonly kind: "idle" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "success"; readonly href: string }

function productFiles(formData: FormData) {
  return [...formData.values()].filter(
    (value): value is File => value instanceof File
  )
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function reportCreateFailure({
  error,
  productId,
  stage,
}: {
  error: unknown
  productId: string
  stage: ProductCreateStage
}) {
  console.error(
    JSON.stringify({
      event: "admin.product_create_failed",
      productId,
      stage,
      error: errorMessage(error),
    })
  )
}

export async function createProductAction(
  formData: FormData
): Promise<CreateProductResult> {
  const session = await getCurrentSession()

  if (!canAccessAdmin(session)) {
    return { kind: "error", message: "Anda tidak dapat menambah produk." }
  }

  const mode = formData.get("mode")
  const payload = formData.get(PRODUCT_PAYLOAD_FIELD)

  if (!isProductSaveMode(mode) || typeof payload !== "string") {
    return { kind: "error", message: "Data produk tidak lengkap." }
  }

  let decoded: unknown

  try {
    decoded = JSON.parse(payload)
  } catch {
    return { kind: "error", message: "Data produk tidak dapat dibaca." }
  }

  const submission = productSubmissionSchema.safeParse(decoded)

  if (!submission.success) {
    return { kind: "error", message: "Periksa kembali data produk." }
  }

  const resolved = resolveProductSubmission({
    submission: submission.data,
    formData,
  })

  if (!resolved?.success) {
    return { kind: "error", message: "Periksa kembali data dan foto produk." }
  }

  const files = productFiles(formData)

  if (
    files.reduce((total, file) => total + file.size, 0) > MAX_SUBMISSION_BYTES
  ) {
    return { kind: "error", message: "Total ukuran foto maksimal 30 MB." }
  }

  if (files.some((file) => !isProductImageMime(file.type))) {
    return { kind: "error", message: "Ada format foto yang tidak didukung." }
  }

  const id = newProductId()
  const uploaded = new Map<File, StoredProductImage>()
  const uploadedObjectKeys = new Set<string>()
  let stage: ProductCreateStage = "upload"

  try {
    for (const [index, image] of resolved.data.images.entries()) {
      const file = newImageFile(image)
      const imageId = randomUUID()
      const stored = await uploadProductImage({
        id: imageId,
        productId: id,
        alt: productImageAlt({ name: resolved.data.name, index }),
        mime: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })
      uploaded.set(file, stored)
      for (const objectKey of productImageObjectKeys(stored)) {
        uploadedObjectKeys.add(objectKey)
      }
    }

    for (const variant of resolved.data.variants) {
      for (const option of variant.options) {
        const file = option.image ? newImageFile(option.image) : null
        if (file && !uploaded.has(file)) {
          const imageId = randomUUID()
          const stored = await uploadProductImage({
            id: imageId,
            productId: id,
            alt: `${resolved.data.name}, ${variant.label} ${option.value}`,
            mime: file.type,
            bytes: new Uint8Array(await file.arrayBuffer()),
          })
          uploaded.set(file, stored)
          for (const objectKey of productImageObjectKeys(stored)) {
            uploadedObjectKeys.add(objectKey)
          }
        }
      }
    }

    const images = resolved.data.images.flatMap((image) => {
      const stored = uploaded.get(newImageFile(image))
      return stored ? [stored] : []
    })
    const [firstImage, ...otherImages] = images

    if (!firstImage) {
      throw new Error("No uploaded product image.")
    }

    const variants: readonly StoredProductVariant[] =
      resolved.data.variants.map((variant) => {
        const options = variant.options.flatMap((option) =>
          option.price === null
            ? []
            : [
                {
                  value: option.value,
                  price: option.price,
                  weight: option.weight,
                  imageId: option.image
                    ? (uploaded.get(newImageFile(option.image))?.id ?? null)
                    : null,
                },
              ]
        )
        const [firstOption, ...otherOptions] = options

        if (!firstOption) {
          throw new Error("No product variant option price.")
        }

        return { label: variant.label, options: [firstOption, ...otherOptions] }
      })
    const variantPrices = variants.flatMap(({ options }) =>
      options.map(({ price }) => price)
    )
    const price =
      variantPrices.length > 0
        ? Math.min(...variantPrices)
        : resolved.data.price

    if (price === null) {
      throw new Error("No product price.")
    }

    stage = "database"
    await createProduct({
      id,
      slug: productSlug({ name: resolved.data.name, id }),
      name: resolved.data.name,
      category: resolved.data.category,
      description: descriptionParagraphs(resolved.data.description),
      images: [firstImage, ...otherImages],
      variants,
      price,
      compareAtPrice: resolved.data.compareAtPrice,
      stock: resolved.data.stock,
      weight: resolved.data.weight,
      state: mode === "publish" ? "active" : "draft",
    })
  } catch (error) {
    reportCreateFailure({ error, productId: id, stage })

    if (error instanceof ProductImageUploadError) {
      for (const objectKey of error.uploadedObjectKeys) {
        uploadedObjectKeys.add(objectKey)
      }
    }

    try {
      await deleteProductImages([...uploadedObjectKeys])
    } catch (cleanupError) {
      console.error(
        JSON.stringify({
          event: "admin.product_image_cleanup_failed",
          productId: id,
          error: errorMessage(cleanupError),
        })
      )
    }

    return {
      kind: "error",
      message:
        stage === "upload"
          ? "Foto produk belum terunggah. Periksa koneksi penyimpanan lalu coba lagi."
          : "Produk belum tersimpan ke database. Coba lagi atau periksa log server.",
    }
  }

  revalidatePath("/")
  revalidatePath("/admin/products")

  return { kind: "success", href: "/admin/products?tab=all" }
}
