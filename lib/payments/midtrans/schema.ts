import { z } from "zod"

import { checkoutSourceSchema } from "@/lib/checkout/schema"
import { SHIPPING_COURIERS } from "@/lib/shipping/config"

const courierCodeSchema = z.enum(
  SHIPPING_COURIERS.map((courier) => courier.code)
)

export const createSnapPaymentSchema = z.object({
  addressId: z.string().uuid(),
  customerNote: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(500).optional()
  ),
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

export const snapSessionCancellationResponseSchema = z.object({
  canceled_at: z.string().trim().min(1),
})

export const snapSessionCancellationErrorSchema = z.object({
  error_messages: z.array(z.string().trim().min(1)).min(1),
})

export const midtransStatusCodeSchema = z.object({
  status_code: z.string().trim().min(1),
})

const midtransTransactionFields = {
  order_id: z.string().trim().min(1),
  status_code: z.string().trim().min(1),
  gross_amount: z.string().trim().min(1),
  transaction_status: z.string().trim().min(1),
  transaction_id: z.string().trim().min(1).nullable().optional(),
  transaction_time: z.string().trim().min(1).nullable().optional(),
  settlement_time: z.string().trim().min(1).nullable().optional(),
  refund_amount: z.string().trim().min(1).nullable().optional(),
  chargeback_amount: z.string().trim().min(1).nullable().optional(),
  fraud_status: z.string().trim().min(1).nullable().optional(),
  payment_type: z.string().trim().min(1).nullable().optional(),
}

export const midtransNotificationSchema = z.object({
  ...midtransTransactionFields,
  signature_key: z.string().trim().min(1),
})

export type MidtransNotification = z.infer<typeof midtransNotificationSchema>

export const midtransStatusResponseSchema = z.object(midtransTransactionFields)

export type MidtransStatusResponse = z.infer<
  typeof midtransStatusResponseSchema
>

export const midtransCancelResponseSchema = z.object({
  ...midtransTransactionFields,
})

export type MidtransCancelResponse = z.infer<
  typeof midtransCancelResponseSchema
>

export const confirmPaymentSchema = z.object({
  orderId: z.string().trim().min(1),
})

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>
