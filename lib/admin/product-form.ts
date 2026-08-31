import type { Control, FieldErrors, UseFormRegister } from "react-hook-form"
import { z } from "zod"

import { adminSection } from "@/lib/admin/config"
import {
  CATEGORIES,
  isCategorySlug,
  type CategorySlug,
} from "@/lib/site/config"
import { formatNumber, formatRupiah } from "@/utils/format/intl"

export const NEW_PRODUCT_HREF = `${adminSection("products").href}/tambah`

export const NEW_PRODUCT_PAGE = {
  label: "Tambah Produk",
  description: "Lengkapi foto, informasi, harga, dan stok produk baru.",
} as const satisfies { label: string; description: string }

export const MAX_PRODUCT_IMAGES = 6
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_VARIANTS = 2
export const MAX_VARIANT_OPTIONS = 12
const MIN_PRICE = 100
const MAX_PRICE = 500_000_000
export const MAX_STOCK = 100_000
export const MAX_WEIGHT = 1_000_000
const MIN_NAME_LENGTH = 5
const MAX_NAME_LENGTH = 150
const MIN_DESCRIPTION_LENGTH = 30
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_VARIANT_TEXT_LENGTH = 30

const IMAGE_FORMATS = [
  { extension: "JPG", mime: "image/jpeg" },
  { extension: "PNG", mime: "image/png" },
  { extension: "WEBP", mime: "image/webp" },
] as const satisfies readonly { extension: string; mime: string }[]

export const IMAGE_ACCEPT = IMAGE_FORMATS.map(({ mime }) => mime).join(",")

export const IMAGE_FORMAT_HINT = IMAGE_FORMATS.map(
  ({ extension }) => extension
).join(", ")

export const CATEGORY_OPTIONS = CATEGORIES.map(({ slug, label }) => ({
  value: slug,
  label,
}))

export function parseNumberInput(value: string) {
  return value === "" ? undefined : Number(value)
}

export function parseOptionalNumberInput(value: string) {
  return parseNumberInput(value) ?? null
}

const imageDraftSchema = z.object({
  file: z
    .file("Pilih berkas foto.")
    .max(MAX_PRODUCT_IMAGE_BYTES, "Ukuran foto maksimal 5 MB.")
    .mime(
      IMAGE_FORMATS.map(({ mime }) => mime),
      `Format foto harus ${IMAGE_FORMAT_HINT}.`
    ),
  name: z.string().min(1),
  previewUrl: z.string().min(1),
})

export type ProductImageDraft = z.infer<typeof imageDraftSchema>

export const variantOptionSchema = z
  .object({
    value: z
      .string()
      .trim()
      .min(1, "Pilihan varian wajib diisi.")
      .max(
        MAX_VARIANT_TEXT_LENGTH,
        `Pilihan varian maksimal ${MAX_VARIANT_TEXT_LENGTH} karakter.`
      ),
    image: imageDraftSchema.nullable(),
    price: z
      .number({ error: "Harga pilihan harus berupa angka." })
      .int("Harga pilihan harus berupa angka bulat.")
      .min(MIN_PRICE, `Harga pilihan minimal ${formatRupiah(MIN_PRICE)}.`)
      .max(MAX_PRICE, `Harga pilihan maksimal ${formatRupiah(MAX_PRICE)}.`)
      .nullable(),
    weight: z
      .number({ error: "Berat pilihan harus berupa angka." })
      .int("Berat pilihan harus berupa angka bulat.")
      .min(1, "Berat pilihan minimal 1 gram.")
      .max(
        MAX_WEIGHT,
        `Berat pilihan maksimal ${formatNumber(MAX_WEIGHT)} gram.`
      )
      .nullable(),
  })
  .refine(({ price }) => price !== null, {
    path: ["price"],
    message: "Harga pilihan wajib diisi.",
  })

export const variantSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Nama varian wajib diisi.")
    .max(
      MAX_VARIANT_TEXT_LENGTH,
      `Nama varian maksimal ${MAX_VARIANT_TEXT_LENGTH} karakter.`
    ),
  options: z
    .array(variantOptionSchema)
    .min(1, "Varian butuh minimal 1 pilihan.")
    .max(
      MAX_VARIANT_OPTIONS,
      `Maksimal ${MAX_VARIANT_OPTIONS} pilihan varian.`
    ),
})

export const productFormSchema = z
  .object({
    images: z
      .array(imageDraftSchema)
      .min(1, "Unggah minimal 1 foto produk.")
      .max(MAX_PRODUCT_IMAGES, `Maksimal ${MAX_PRODUCT_IMAGES} foto produk.`),
    name: z
      .string()
      .trim()
      .min(MIN_NAME_LENGTH, `Nama produk minimal ${MIN_NAME_LENGTH} karakter.`)
      .max(
        MAX_NAME_LENGTH,
        `Nama produk maksimal ${MAX_NAME_LENGTH} karakter.`
      ),
    category: z
      .string()
      .min(1, "Kategori wajib dipilih.")
      .pipe(z.custom<CategorySlug>(isCategorySlug, "Kategori tidak dikenal.")),
    description: z
      .string()
      .trim()
      .min(
        MIN_DESCRIPTION_LENGTH,
        `Deskripsi minimal ${MIN_DESCRIPTION_LENGTH} karakter.`
      )
      .max(
        MAX_DESCRIPTION_LENGTH,
        `Deskripsi maksimal ${formatNumber(MAX_DESCRIPTION_LENGTH)} karakter.`
      ),
    price: z
      .number({ error: "Harga jual harus berupa angka." })
      .int("Harga jual harus berupa angka bulat.")
      .min(MIN_PRICE, `Harga jual minimal ${formatRupiah(MIN_PRICE)}.`)
      .max(MAX_PRICE, `Harga jual maksimal ${formatRupiah(MAX_PRICE)}.`)
      .nullable(),
    compareAtPrice: z
      .number({ error: "Harga sebelum diskon harus berupa angka." })
      .int("Harga sebelum diskon harus berupa angka bulat.")
      .max(
        MAX_PRICE,
        `Harga sebelum diskon maksimal ${formatRupiah(MAX_PRICE)}.`
      )
      .nullable(),
    stock: z
      .number({ error: "Stok wajib diisi." })
      .int("Stok harus berupa angka bulat.")
      .min(0, "Stok tidak boleh kurang dari 0.")
      .max(MAX_STOCK, `Stok maksimal ${formatNumber(MAX_STOCK)}.`),
    weight: z
      .number({ error: "Berat produk wajib diisi." })
      .int("Berat produk harus berupa angka bulat.")
      .min(1, "Berat produk minimal 1 gram.")
      .max(
        MAX_WEIGHT,
        `Berat produk maksimal ${formatNumber(MAX_WEIGHT)} gram.`
      ),
    variants: z
      .array(variantSchema)
      .max(MAX_VARIANTS, `Maksimal ${MAX_VARIANTS} varian.`),
  })
  .superRefine((values, context) => {
    if (values.variants.length === 0 && values.price === null) {
      context.addIssue({
        code: "custom",
        path: ["price"],
        message: "Harga jual wajib diisi.",
      })
    }

    if (
      values.price !== null &&
      values.compareAtPrice !== null &&
      values.compareAtPrice <= values.price
    ) {
      context.addIssue({
        code: "custom",
        path: ["compareAtPrice"],
        message: "Harga sebelum diskon harus lebih besar dari harga jual.",
      })
    }
  })

export type ProductFormInput = z.input<typeof productFormSchema>
export type ProductFormValues = z.output<typeof productFormSchema>

export type ProductFormControl = Control<
  ProductFormInput,
  unknown,
  ProductFormValues
>
export type ProductFormRegister = UseFormRegister<ProductFormInput>
export type ProductFormErrors = FieldErrors<ProductFormInput>

export const EMPTY_VARIANT_OPTION = {
  value: "",
  image: null,
  price: null,
  weight: null,
} as const satisfies ProductFormInput["variants"][number]["options"][number]

export const EMPTY_VARIANT = {
  label: "",
  options: [EMPTY_VARIANT_OPTION],
} as const satisfies ProductFormInput["variants"][number]

export const EMPTY_PRODUCT_FORM = {
  images: [],
  name: "",
  category: "",
  description: "",
  price: null,
  compareAtPrice: null,
  stock: undefined,
  weight: undefined,
  variants: [],
} as const satisfies Partial<ProductFormInput>

export type ProductSaveMode = {
  readonly label: string
  readonly variant: "default" | "outline"
}

export const SAVE_MODE_FIELD = "mode"

export const PRODUCT_SAVE_MODES = {
  draft: { label: "Simpan Draf", variant: "outline" },
  publish: { label: "Terbitkan Produk", variant: "default" },
} as const satisfies Record<string, ProductSaveMode>

export type ProductSaveModeKind = keyof typeof PRODUCT_SAVE_MODES

export function isProductSaveMode(
  value: unknown
): value is ProductSaveModeKind {
  return typeof value === "string" && Object.hasOwn(PRODUCT_SAVE_MODES, value)
}

export const PRODUCT_SAVE_MODE_ORDER = [
  "draft",
  "publish",
] as const satisfies readonly ProductSaveModeKind[]
