import { z } from "zod"

import type { Product } from "@/lib/products/config"

export type ManualOrderProduct = Pick<
  Product,
  "slug" | "name" | "price" | "stock" | "variants"
>

export function manualOrderVariantOptions(
  product: ManualOrderProduct | undefined
): string[] {
  if (!product) return []
  if (product.variants.length === 0) return ["Tanpa varian"]

  return product.variants.reduce<string[]>(
    (combinations, variant) =>
      combinations.flatMap((combination) =>
        variant.options.map((option) =>
          combination
            ? `${combination} / ${variant.label}: ${option}`
            : `${variant.label}: ${option}`
        )
      ),
    [""]
  )
}

export const MANUAL_ORDER_STEPS = [
  {
    key: "item",
    label: "Pelanggan & barang",
    description: "Pilih pelanggan dan barang yang akan dipesan.",
  },
  {
    key: "shipping",
    label: "Pengiriman",
    description: "Masukkan alamat dan ongkos kirim secara manual.",
  },
  {
    key: "review",
    label: "Periksa",
    description: "Pastikan rincian pesanan sudah benar.",
  },
] as const

export type ManualOrderStep = (typeof MANUAL_ORDER_STEPS)[number]["key"]

export const MANUAL_ORDER_STEP_ORDER = MANUAL_ORDER_STEPS.map(({ key }) => key)

export const COURIER_OPTIONS = [
  "JNE",
  "J&T Express",
  "SiCepat",
  "AnterAja",
  "Pos Indonesia",
  "Kurir toko",
] as const

export const manualOrderSchema = z.object({
  buyer: z.string().min(1, "Pilih pelanggan."),
  productSlug: z.string().min(1, "Pilih produk."),
  variant: z.string().min(1, "Pilih varian."),
  quantity: z.coerce
    .number<number>()
    .int("Jumlah harus berupa angka bulat.")
    .min(1, "Jumlah minimal 1."),
  recipient: z.string().trim().min(1, "Masukkan nama penerima."),
  phone: z.string().trim().min(8, "Masukkan nomor telepon yang valid."),
  address: z.string().trim().min(10, "Masukkan alamat lengkap."),
  courier: z.string().min(1, "Pilih kurir."),
  shippingCost: z.coerce
    .number<number>()
    .int("Ongkos kirim harus berupa angka bulat.")
    .min(0, "Ongkos kirim tidak boleh negatif."),
  note: z.string().trim(),
})

export type ManualOrderInput = z.input<typeof manualOrderSchema>
export type ManualOrderValues = z.output<typeof manualOrderSchema>

export const MANUAL_ORDER_DEFAULT_VALUES = {
  buyer: "",
  productSlug: "",
  variant: "",
  quantity: 1,
  recipient: "",
  phone: "",
  address: "",
  courier: "",
  shippingCost: 0,
  note: "",
} satisfies ManualOrderInput

export const MANUAL_ORDER_STEP_FIELDS = {
  item: ["buyer", "productSlug", "variant", "quantity"],
  shipping: ["recipient", "phone", "address", "courier", "shippingCost"],
  review: [],
} as const satisfies Record<
  ManualOrderStep,
  readonly (keyof ManualOrderInput)[]
>
