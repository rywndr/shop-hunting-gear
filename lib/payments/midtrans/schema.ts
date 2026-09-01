import { z } from "zod"

import { checkoutSourceSchema } from "@/lib/checkout/schema"
import { SHIPPING_COURIERS } from "@/lib/shipping/config"

const courierCodeSchema = z.enum(
  SHIPPING_COURIERS.map((courier) => courier.code)
)

export const createSnapPaymentSchema = z.object({
  addressId: z.string().uuid(),
  source: checkoutSourceSchema,
  shipping: z.object({
    courier: courierCodeSchema,
    service: z.string().trim().min(1),
  }),
})

export type CreateSnapPaymentInput = z.infer<typeof createSnapPaymentSchema>

export const snapTransactionResponseSchema = z.object({
  token: z.string().trim().min(1),
  redirect_url: z.url(),
})

export type SnapTransaction = z.infer<typeof snapTransactionResponseSchema>
