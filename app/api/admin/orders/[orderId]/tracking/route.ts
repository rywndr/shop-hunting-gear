import { z } from "zod"

import { getRequestSession } from "@/lib/auth/request"
import { canAccessAdmin } from "@/lib/auth/session"
import { trackingLookupResponse, trackOrderById } from "@/lib/orders/tracking"

const orderIdSchema = z.string().trim().min(1)
const trackingResponseHeaders = { "Cache-Control": "private, no-store" }

function trackingError(message: string, status: number) {
  return Response.json(
    { kind: "error", message },
    { status, headers: trackingResponseHeaders }
  )
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await getRequestSession(request)

  if (!canAccessAdmin(session)) {
    return trackingError("Anda tidak dapat melacak pesanan.", 403)
  }

  const { orderId } = await params
  const parsedOrderId = orderIdSchema.safeParse(orderId)

  if (!parsedOrderId.success) {
    return trackingError("Data pesanan tidak valid.", 400)
  }

  try {
    return trackingLookupResponse(await trackOrderById(parsedOrderId.data))
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "admin.order_tracking_failed",
        orderId: parsedOrderId.data,
        error: error instanceof Error ? error.message : String(error),
      })
    )
    return trackingError("Pelacakan belum dapat dimuat. Coba lagi.", 500)
  }
}
