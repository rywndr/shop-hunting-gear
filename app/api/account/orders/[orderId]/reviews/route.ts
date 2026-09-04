import { revalidatePath } from "next/cache"

import { getRequestSession } from "@/lib/auth/request"
import { productHref } from "@/lib/products/config"
import { reviewFinalizeRequestSchema } from "@/lib/reviews/schema"
import { createReview } from "@/lib/reviews/service"

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
    return error("Data ulasan tidak valid.", 400)
  }
  const parsed = reviewFinalizeRequestSchema.safeParse(input)
  if (!parsed.success) {
    return error(
      parsed.error.issues[0]?.message ?? "Data ulasan tidak valid.",
      400
    )
  }

  try {
    const { orderId } = await context.params
    const result = await createReview({
      userId: session.user.id,
      author: session.user.name,
      orderId,
      values: parsed.data,
    })
    if (result.kind === "not-found") {
      return error("Pesanan atau barang tidak ditemukan.", 404)
    }
    if (result.kind === "not-eligible") {
      return error("Pesanan belum dapat diulas.", 409)
    }
    if (result.kind === "duplicate") {
      return error("Barang ini sudah diulas.", 409)
    }
    if (result.kind === "invalid-upload") {
      return error("Token unggahan tidak valid atau sudah kedaluwarsa.", 400)
    }

    revalidatePath("/history")
    revalidatePath("/")
    revalidatePath(
      productHref({
        slug: result.productSlug,
        category: result.productCategory,
      })
    )
    return json({
      kind: "created",
      reviewId: result.reviewId,
      orderItemId: result.orderItemId,
    })
  } catch (cause) {
    console.error(
      JSON.stringify({
        event: "reviews.create_failed",
        orderItemId: parsed.data.orderItemId,
        cause: cause instanceof Error ? cause.message : "unknown",
      })
    )
    return error("Ulasan tidak dapat disimpan. Coba lagi.", 500)
  }
}
