import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

import { serverEnv } from "@/lib/env/server"
import { REVIEW_LIMITS, reviewImageMimeSchema } from "./schema"

const TOKEN_VERSION = 1
export const REVIEW_UPLOAD_TOKEN_TTL_SECONDS = 10 * 60

const uploadTokenFileSchema = z.object({
  mediaId: z.string().uuid(),
  stagingKey: z
    .string()
    .regex(/^review-uploads\/[0-9a-f-]+\/[0-9a-f-]+\/source$/),
  expectedMime: reviewImageMimeSchema,
  expectedSize: z.number().int().positive().max(REVIEW_LIMITS.maxImageBytes),
  sortOrder: z.number().int().nonnegative(),
})

export const reviewUploadTokenPayloadSchema = z
  .object({
    version: z.literal(TOKEN_VERSION),
    userId: z.string().min(1),
    orderId: z.string().min(1),
    orderItemId: z.string().min(1),
    uploadSessionId: z.string().uuid(),
    files: z
      .array(uploadTokenFileSchema)
      .min(1)
      .max(REVIEW_LIMITS.maxAttachments),
    expiresAt: z.number().int().positive(),
  })
  .refine(
    ({ files }) =>
      files.reduce((total, file) => total + file.expectedSize, 0) <=
      REVIEW_LIMITS.maxTotalBytes,
    { path: ["files"] }
  )

export type ReviewUploadTokenPayload = z.infer<
  typeof reviewUploadTokenPayloadSchema
>

function signature(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest()
}

export function signReviewUploadToken(
  payload: ReviewUploadTokenPayload,
  secret = serverEnv.reviewUploadSecret
) {
  const parsed = reviewUploadTokenPayloadSchema.parse(payload)
  const encodedPayload = Buffer.from(JSON.stringify(parsed)).toString(
    "base64url"
  )
  const encodedSignature = signature(encodedPayload, secret).toString(
    "base64url"
  )
  return `${encodedPayload}.${encodedSignature}`
}

export type VerifyReviewUploadTokenResult =
  | { readonly kind: "valid"; readonly payload: ReviewUploadTokenPayload }
  | { readonly kind: "invalid" }
  | { readonly kind: "expired" }

export function verifyReviewUploadToken(
  token: string,
  options: { readonly secret?: string; readonly now?: number } = {}
): VerifyReviewUploadTokenResult {
  const [encodedPayload, encodedSignature, extra] = token.split(".")
  if (!encodedPayload || !encodedSignature || extra) return { kind: "invalid" }

  let receivedSignature: Buffer
  try {
    receivedSignature = Buffer.from(encodedSignature, "base64url")
  } catch {
    return { kind: "invalid" }
  }
  const expectedSignature = signature(
    encodedPayload,
    options.secret ?? serverEnv.reviewUploadSecret
  )
  if (
    receivedSignature.byteLength !== expectedSignature.byteLength ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    return { kind: "invalid" }
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString())
  } catch {
    return { kind: "invalid" }
  }
  const parsed = reviewUploadTokenPayloadSchema.safeParse(decoded)
  if (!parsed.success) return { kind: "invalid" }
  if (parsed.data.expiresAt <= (options.now ?? Date.now())) {
    return { kind: "expired" }
  }
  return { kind: "valid", payload: parsed.data }
}
