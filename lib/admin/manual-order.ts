import { z } from "zod"

import type { CartVariant } from "@/lib/cart/config"
import type { Product } from "@/lib/products/config"
import {
  MANUAL_SHIPPING_COURIER,
  SHIPPING_COURIERS,
  type ShippingCourierCode,
} from "@/lib/shipping/config"

export type ManualOrderProduct = Pick<
  Product,
  "slug" | "name" | "price" | "stock" | "variants"
>

export type ManualOrderCustomer = {
  readonly id: string
  readonly name: string
  readonly email: string
}

export function manualOrderCustomerLabel(customer: ManualOrderCustomer) {
  return `${customer.name} (${customer.email})`
}

export const NO_VARIANT_OPTION = "Tanpa varian"

export type ManualOrderVariantSelection = {
  readonly value: string
  readonly variants: readonly CartVariant[]
}

export function manualOrderVariantSelections(
  product: ManualOrderProduct | undefined
): readonly ManualOrderVariantSelection[] {
  if (!product) return []
  if (product.variants.length === 0) {
    return [{ value: NO_VARIANT_OPTION, variants: [] }]
  }

  return product.variants.reduce<readonly ManualOrderVariantSelection[]>(
    (combinations, variant) =>
      combinations.flatMap((combination) =>
        variant.options.map((option) => ({
          value: combination.value
            ? `${combination.value} / ${variant.label}: ${option}`
            : `${variant.label}: ${option}`,
          variants: [
            ...combination.variants,
            { label: variant.label, value: option },
          ],
        }))
      ),
    [{ value: "", variants: [] }]
  )
}

export function manualOrderVariantOptions(
  product: ManualOrderProduct | undefined
): string[] {
  return manualOrderVariantSelections(product).map(({ value }) => value)
}

export function manualOrderVariantSelection({
  product,
  variant,
}: {
  readonly product: ManualOrderProduct | undefined
  readonly variant: string
}): ManualOrderVariantSelection | undefined {
  return manualOrderVariantSelections(product).find(
    ({ value }) => value === variant
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

export type ManualOrderDeliveryMethod = {
  readonly value: string
  readonly label: string
  readonly courier: ShippingCourierCode
  readonly courierName: string
  readonly service: string
  readonly requiresAddress: boolean
}

export const MANUAL_ORDER_DELIVERY_METHODS = [
  {
    value: "pickup",
    label: "Ambil di toko",
    courier: MANUAL_SHIPPING_COURIER,
    courierName: "Ambil di toko",
    service: "Pickup",
    requiresAddress: false,
  },
  {
    value: "store-courier",
    label: "Kurir toko",
    courier: MANUAL_SHIPPING_COURIER,
    courierName: "Kurir toko",
    service: "Manual",
    requiresAddress: true,
  },
  ...SHIPPING_COURIERS.map(({ code, label }) => ({
    value: code,
    label,
    courier: code,
    courierName: label,
    service: "Manual",
    requiresAddress: true,
  })),
] as const satisfies readonly ManualOrderDeliveryMethod[]

export const MANUAL_ORDER_DELIVERY_OPTIONS = MANUAL_ORDER_DELIVERY_METHODS.map(
  ({ value, label }) => ({ value, label })
)

export function manualOrderDeliveryMethod(
  value: string
): ManualOrderDeliveryMethod | undefined {
  return MANUAL_ORDER_DELIVERY_METHODS.find((method) => method.value === value)
}

export function manualOrderRequiresAddress(value: string) {
  return manualOrderDeliveryMethod(value)?.requiresAddress ?? true
}

export const manualOrderSchema = z
  .object({
    customerId: z.string().min(1, "Pilih pelanggan."),
    productSlug: z.string().min(1, "Pilih produk."),
    variant: z.string().min(1, "Pilih varian."),
    quantity: z.coerce
      .number<number>()
      .int("Jumlah harus berupa angka bulat.")
      .min(1, "Jumlah minimal 1."),
    recipient: z.string().trim().min(1, "Masukkan nama penerima."),
    phone: z.string().trim().min(8, "Masukkan nomor telepon yang valid."),
    address: z.string().trim(),
    deliveryMethod: z
      .string()
      .refine(
        (value) => manualOrderDeliveryMethod(value) !== undefined,
        "Pilih metode pengiriman."
      ),
    shippingCost: z.coerce
      .number<number>()
      .int("Ongkos kirim harus berupa angka bulat.")
      .min(0, "Ongkos kirim tidak boleh negatif."),
    note: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    const method = manualOrderDeliveryMethod(values.deliveryMethod)

    if (!method) return

    if (method.requiresAddress) {
      if (values.address.length < 10) {
        ctx.addIssue({
          code: "custom",
          path: ["address"],
          message: "Masukkan alamat lengkap.",
        })
      }

      return
    }

    if (values.shippingCost !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["shippingCost"],
        message: "Ongkos kirim harus 0 untuk pengambilan di toko.",
      })
    }
  })

export type ManualOrderInput = z.input<typeof manualOrderSchema>
export type ManualOrderValues = z.output<typeof manualOrderSchema>

export const MANUAL_ORDER_DEFAULT_VALUES = {
  customerId: "",
  productSlug: "",
  variant: "",
  quantity: 1,
  recipient: "",
  phone: "",
  address: "",
  deliveryMethod: "",
  shippingCost: 0,
  note: "",
} satisfies ManualOrderInput

export const MANUAL_ORDER_STEP_FIELDS = {
  item: ["customerId", "productSlug", "variant", "quantity"],
  shipping: ["recipient", "phone", "address", "deliveryMethod", "shippingCost"],
  review: [],
} as const satisfies Record<
  ManualOrderStep,
  readonly (keyof ManualOrderInput)[]
>

export const MANUAL_ORDER_PICKUP_ADDRESS = "Ambil di toko"
