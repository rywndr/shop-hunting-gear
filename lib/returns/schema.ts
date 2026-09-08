import { z } from "zod"
import { RETURN_REASONS, type ReturnReason } from "./config"

export const RETURN_PHOTO_LIMITS = {
  count: 4,
  bytes: 5 * 1024 * 1024,
} as const
export const returnPhotoMimeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
])
export const returnRequestSchema = z.object({
  orderId: z.string().trim().min(1).max(200),
  reason: z.custom<ReturnReason>(
    (value) => typeof value === "string" && Object.hasOwn(RETURN_REASONS, value)
  ),
  details: z.string().trim().min(1).max(2000),
})
export const returnReviewSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("approve"),
    returnId: z.string().uuid(),
    note: z.string().trim().min(1).max(2000),
  }),
  z.object({
    kind: z.literal("reject"),
    returnId: z.string().uuid(),
    note: z.string().trim().min(1).max(2000),
  }),
  z.object({
    kind: z.literal("inspect"),
    returnId: z.string().uuid(),
    note: z.string().trim().min(1).max(2000),
    items: z
      .array(
        z.object({
          id: z.string().uuid(),
          receivedQuantity: z.number().int().nonnegative(),
          resellableQuantity: z.number().int().nonnegative(),
        })
      )
      .min(1)
      .max(200),
  }),
])
export type ReturnReviewInput = z.infer<typeof returnReviewSchema>
export const refundActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("refund"), returnId: z.string().uuid() }),
  z.object({ kind: z.literal("reconcile"), returnId: z.string().uuid() }),
  z.object({
    kind: z.literal("confirm-offline"),
    returnId: z.string().uuid(),
    reference: z.string().trim().min(1).max(500),
  }),
])
export type RefundActionInput = z.infer<typeof refundActionSchema>
