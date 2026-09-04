import { randomUUID } from "node:crypto"

import { getRequestSession } from "@/lib/auth/request"
import { reviewUploadIntentRequestSchema } from "@/lib/reviews/schema"
import { reviewEligibility } from "@/lib/reviews/service"
import {
  REVIEW_UPLOAD_TOKEN_TTL_SECONDS,
  signReviewUploadToken,
} from "@/lib/reviews/upload-intent"
import { signedB2PutUrl } from "@/lib/storage/b2"

const HEADERS = { "Cache-Control": "private, no-store" }
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: HEADERS })
}
function error(message: string, status: number) {
  return json({ kind: "error", error: message }, status)
}

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly orderId: string }> }
) {
  const session = await getRequestSession(request)
  if (!session) return error("Silakan masuk terlebih dahulu.", 401)

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return error("Data unggahan tidak valid.", 400)
  }
  const parsed = reviewUploadIntentRequestSchema.safeParse(input)
  if (!parsed.success) {
    return error(
      parsed.error.issues[0]?.message ?? "Data unggahan tidak valid.",
      400
    )
  }

  const { orderId } = await context.params
  const eligibility = await reviewEligibility({
    userId: session.user.id,
    orderId,
    orderItemId: parsed.data.orderItemId,
  })
  if (eligibility.kind === "not-found") {
    return error("Pesanan atau barang tidak ditemukan.", 404)
  }
  if (eligibility.kind === "not-eligible") {
    return error("Pesanan belum dapat diulas.", 409)
  }
  if (eligibility.kind === "duplicate") {
    return error("Barang ini sudah diulas.", 409)
  }

  const uploadSessionId = randomUUID()
  const files = parsed.data.files.map((file, sortOrder) => {
    const mediaId = randomUUID()
    return {
      mediaId,
      stagingKey: `review-uploads/${uploadSessionId}/${mediaId}/source`,
      expectedMime: file.mime,
      expectedSize: file.size,
      sortOrder,
    }
  })
  const expiresAt = Date.now() + REVIEW_UPLOAD_TOKEN_TTL_SECONDS * 1000
  const uploadToken = signReviewUploadToken({
    version: 1,
    userId: session.user.id,
    orderId,
    orderItemId: parsed.data.orderItemId,
    uploadSessionId,
    files,
    expiresAt,
  })
  const uploads = await Promise.all(
    files.map(async (file) => ({
      mediaId: file.mediaId,
      ...(await signedB2PutUrl({
        key: file.stagingKey,
        contentType: file.expectedMime,
        contentLength: file.expectedSize,
        expiresIn: REVIEW_UPLOAD_TOKEN_TTL_SECONDS,
      })),
    }))
  )

  return json({ uploadToken, uploads })
}
