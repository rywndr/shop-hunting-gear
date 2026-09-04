"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"

import { canAccessAdmin, getCurrentSession } from "@/lib/auth/session"
import { LISTING_ACTIONS, type ListingActionKind } from "@/lib/admin/catalog"
import {
  adminProductForEdit,
  updateProductDetails,
  updateProductInventory,
  updateProductListingState,
} from "@/lib/products/service"
import {
  PRODUCT_PAYLOAD_FIELD,
  productSubmissionSchema,
} from "@/lib/admin/product-submission"
import { productEditFormSchema } from "@/lib/admin/product-form"
import { productImageAlt } from "@/lib/products/identity"
import type { StoredProductImage } from "@/lib/db/schema/product"
import {
  deleteProductImages,
  isProductImageMime,
  ProductImageUploadError,
  productImageObjectKeys,
  uploadProductImage,
} from "@/lib/products/storage"

export type ProductMutationResult =
  | { readonly kind: "success" }
  | { readonly kind: "error"; readonly message: string }

const ACTION_STATES = {
  activate: "active",
  deactivate: "inactive",
  delete: "deleted",
  restore: "inactive",
} as const satisfies Record<
  ListingActionKind,
  "active" | "inactive" | "deleted"
>

async function isAuthorized() {
  return canAccessAdmin(await getCurrentSession())
}

export async function applyListingAction({
  action,
  productIds,
}: {
  action: ListingActionKind
  productIds: readonly string[]
}): Promise<ProductMutationResult> {
  if (!(action in LISTING_ACTIONS) || productIds.length === 0) {
    return { kind: "error", message: "Aksi produk tidak valid." }
  }
  if (!(await isAuthorized())) {
    return { kind: "error", message: "Anda tidak dapat mengubah produk." }
  }

  try {
    await updateProductListingState({
      productIds,
      state: ACTION_STATES[action],
    })
    revalidatePath("/")
    revalidatePath("/admin/products")
    revalidatePath("/c/[category]/p/[slug]", "page")
    return { kind: "success" }
  } catch {
    return {
      kind: "error",
      message: "Status produk belum tersimpan. Coba lagi.",
    }
  }
}

export async function quickEditListing({
  productId,
  field,
  value,
  compareAtPrice,
}: {
  productId: string
  field: "price" | "stock"
  value: number
  compareAtPrice?: number | null
}): Promise<ProductMutationResult> {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    (field === "price" && value === 0) ||
    (compareAtPrice !== undefined &&
      compareAtPrice !== null &&
      (!Number.isSafeInteger(compareAtPrice) || compareAtPrice <= value))
  ) {
    return { kind: "error", message: "Nilai yang dimasukkan tidak valid." }
  }
  if (!(await isAuthorized())) {
    return { kind: "error", message: "Anda tidak dapat mengubah produk." }
  }

  try {
    await updateProductInventory({ productId, field, value, compareAtPrice })
    revalidatePath("/")
    revalidatePath("/admin/products")
    return { kind: "success" }
  } catch {
    return { kind: "error", message: "Perubahan belum tersimpan. Coba lagi." }
  }
}

export async function editProductAction({
  productId,
  formData,
}: {
  productId: string
  formData: FormData
}): Promise<ProductMutationResult> {
  if (!(await isAuthorized())) {
    return { kind: "error", message: "Anda tidak dapat mengubah produk." }
  }

  const payload = formData.get(PRODUCT_PAYLOAD_FIELD)
  if (typeof payload !== "string") {
    return { kind: "error", message: "Periksa kembali data produk." }
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(payload)
  } catch {
    return { kind: "error", message: "Data produk tidak dapat dibaca." }
  }
  const parsed = productSubmissionSchema.safeParse(decoded)
  if (!parsed.success)
    return { kind: "error", message: "Periksa kembali data produk." }

  const current = await adminProductForEdit(productId)
  if (!current) return { kind: "error", message: "Produk tidak ditemukan." }

  const paragraphs = parsed.data.description
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  const [firstParagraph, ...otherParagraphs] = paragraphs
  if (!firstParagraph) {
    return { kind: "error", message: "Deskripsi produk wajib diisi." }
  }

  const existingImages = new Map(
    current.images.map((image) => [image.id, image])
  )
  const submission = parsed.data

  function draftImage(reference: (typeof submission.images)[number]) {
    if (reference.kind === "existing") {
      const image = existingImages.get(reference.id)
      return image
        ? {
            kind: "existing" as const,
            id: image.id,
            name: image.alt,
            previewUrl: "stored-image",
          }
        : null
    }
    const file = formData.get(reference.field)
    return file instanceof File
      ? {
          kind: "new" as const,
          file,
          name: reference.name,
          previewUrl: "uploaded-image",
        }
      : null
  }

  const imageDrafts = submission.images.map(draftImage)
  const values = productEditFormSchema.safeParse({
    ...submission,
    images: imageDrafts,
    variants: submission.variants.map((variant) => ({
      ...variant,
      options: variant.options.map((option) => ({
        ...option,
        image: option.image ? draftImage(option.image) : null,
      })),
    })),
  })
  if (!values.success) {
    return { kind: "error", message: "Periksa kembali data dan foto produk." }
  }
  const uploadedByFile = new Map<File, StoredProductImage>()
  const uploadedObjectKeys = new Set<string>()

  async function resolveImage(
    reference: (typeof submission.images)[number],
    alt: string
  ) {
    if (reference.kind === "existing") return existingImages.get(reference.id)
    const file = formData.get(reference.field)
    if (!(file instanceof File) || !isProductImageMime(file.type))
      return undefined

    const alreadyUploaded = uploadedByFile.get(file)
    if (alreadyUploaded) {
      return alreadyUploaded
    }

    const stored = await uploadProductImage({
      id: randomUUID(),
      productId,
      alt,
      mime: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })
    uploadedByFile.set(file, stored)
    for (const objectKey of productImageObjectKeys(stored)) {
      uploadedObjectKeys.add(objectKey)
    }
    return stored
  }

  try {
    const images: StoredProductImage[] = []
    for (const [index, reference] of submission.images.entries()) {
      const image = await resolveImage(
        reference,
        productImageAlt({ name: values.data.name, index })
      )
      if (!image) throw new Error("Invalid product image reference.")
      images.push(image)
    }
    const [firstImage, ...otherImages] = images
    if (!firstImage) throw new Error("No product image.")

    const variants = []
    for (const variant of submission.variants) {
      const options = []
      for (const option of variant.options) {
        const existingImageId =
          option.image?.kind === "existing" ? option.image.id : null
        const keepsExistingImage =
          existingImageId === null ||
          images.some(({ id }) => id === existingImageId)
        const image =
          option.image && keepsExistingImage
            ? await resolveImage(
                option.image,
                `${values.data.name}, ${variant.label} ${option.value}`
              )
            : undefined
        if (option.image?.kind === "new" && !image)
          throw new Error("Invalid variant image reference.")
        options.push({
          value: option.value,
          price: option.price ?? values.data.price ?? current.price,
          weight: option.weight,
          imageId: image?.id ?? null,
        })
      }
      variants.push({ label: variant.label, options })
    }
    const variantPrices = variants.flatMap(({ options }) =>
      options.map(({ price }) => price)
    )
    const price =
      variantPrices.length > 0
        ? Math.min(...variantPrices)
        : (values.data.price ?? current.price)

    await updateProductDetails({
      productId,
      values: {
        name: values.data.name,
        category: values.data.category,
        description: [firstParagraph, ...otherParagraphs],
        images: [firstImage, ...otherImages],
        variants,
        price,
        compareAtPrice: values.data.compareAtPrice,
        stock: values.data.stock,
        weight: values.data.weight,
      },
    })
    revalidatePath("/")
    revalidatePath("/admin/products")

    const retainedIds = new Set(images.map(({ id }) => id))
    const removedKeys = current.images
      .filter(({ id }) => !retainedIds.has(id))
      .flatMap((image) => productImageObjectKeys(image))
    if (removedKeys.length > 0) {
      try {
        await deleteProductImages(removedKeys)
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "admin.product_image_cleanup_failed",
            productId,
            error: error instanceof Error ? error.message : String(error),
          })
        )
      }
    }
    return { kind: "success" }
  } catch (error) {
    if (error instanceof ProductImageUploadError) {
      for (const objectKey of error.uploadedObjectKeys) {
        uploadedObjectKeys.add(objectKey)
      }
    }

    if (uploadedObjectKeys.size > 0) {
      try {
        await deleteProductImages([...uploadedObjectKeys])
      } catch {
        // Keep the upload error instead of replacing it with a cleanup error.
      }
    }
    return {
      kind: "error",
      message: "Perubahan produk belum tersimpan. Coba lagi.",
    }
  }
}
