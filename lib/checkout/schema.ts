import { z } from "zod"

import { cartVariantSchema } from "@/lib/cart/schema"

export const checkoutProductQuerySchema = z.object({
  produk: z.string().trim().min(1),
  jumlah: z.coerce.number().int().positive(),
  pilihan: z.string().transform((value, context) => {
    try {
      const parsed: unknown = JSON.parse(value)
      const result = z.array(cartVariantSchema).safeParse(parsed)

      if (result.success) {
        return result.data
      }
    } catch {
      // The issue below covers malformed JSON and invalid selections alike.
    }

    context.addIssue({ code: "custom", message: "Invalid product selection." })
    return z.NEVER
  }),
})

export const shippingQuoteRequestSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("cart"), addressId: z.string().uuid() }),
  z.object({
    source: z.literal("product"),
    addressId: z.string().uuid(),
    productSlug: z.string().trim().min(1),
    quantity: z.coerce.number().int().positive(),
  }),
])
