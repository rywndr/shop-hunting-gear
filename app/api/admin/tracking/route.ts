import { z } from "zod"

import { getRequestSession } from "@/lib/auth/request"
import { canAccessAdmin } from "@/lib/auth/session"
import {
  orderTrackingRecordForSavedAwb,
  trackOrderRecord,
  trackTrackingInput,
  trackingLookupResponse,
} from "@/lib/orders/tracking"
import type { ShipmentTrackingActionResult } from "@/lib/shipping/schema"
import {
  customTrackingRequestSchema,
  trackingCourierFromCustomValue,
} from "@/lib/shipping/tracking"

const lastPhoneNumberSchema = z.string().regex(/^\d{5}$/)
const trackingResponseHeaders = { "Cache-Control": "private, no-store" }

function trackingError(message: string, status: number) {
  return Response.json(
    { kind: "error", message } satisfies Extract<
      ShipmentTrackingActionResult,
      { kind: "error" }
    >,
    { status, headers: trackingResponseHeaders }
  )
}

export async function POST(request: Request) {
  const session = await getRequestSession(request)

  if (!canAccessAdmin(session)) {
    return trackingError("Anda tidak dapat melacak pengiriman.", 403)
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return trackingError("Masukkan nomor resi yang valid.", 400)
  }

  const parsed = customTrackingRequestSchema.safeParse(body)

  if (!parsed.success) {
    return trackingError("Masukkan nomor resi yang valid.", 400)
  }

  try {
    const localOrder = await orderTrackingRecordForSavedAwb(parsed.data.awb)

    if (localOrder.kind === "ambiguous") {
      return trackingError(
        "Nomor resi cocok dengan lebih dari satu pesanan. Lacak dari baris pesanan yang sesuai.",
        409
      )
    }

    // A saved order is authoritative. Ignore any courier or phone values sent
    // by the browser and derive both values from its address and shipment.
    if (localOrder.kind === "found") {
      return trackingLookupResponse(await trackOrderRecord(localOrder.order))
    }

    if (!parsed.data.courier || !parsed.data.lastPhoneNumber) {
      return Response.json(
        { kind: "needs-details", awb: parsed.data.awb },
        { headers: trackingResponseHeaders }
      )
    }

    const courier = trackingCourierFromCustomValue(parsed.data.courier)

    if (!courier) {
      return trackingError(
        "Pelacakan otomatis belum tersedia untuk jasa kirim ini.",
        422
      )
    }

    const lastPhoneNumber = lastPhoneNumberSchema.safeParse(
      parsed.data.lastPhoneNumber
    )

    if (!lastPhoneNumber.success) {
      return trackingError(
        "Masukkan 5 digit terakhir nomor telepon penerima.",
        422
      )
    }

    return trackingLookupResponse(
      await trackTrackingInput({
        awb: parsed.data.awb,
        courier,
        lastPhoneNumber: lastPhoneNumber.data,
      })
    )
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "admin.custom_tracking_failed",
        error: error instanceof Error ? error.message : String(error),
      })
    )
    return trackingError("Pelacakan belum dapat dimuat. Coba lagi.", 500)
  }
}
