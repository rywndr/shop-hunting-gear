import {
  shipmentTrackingActionResultSchema,
  type ShipmentTrackingActionResult,
} from "@/lib/shipping/schema"

const FALLBACK_TRACKING_ERROR = "Pelacakan belum dapat dimuat. Coba lagi."

export async function readShipmentTrackingResponse(
  response: Response
): Promise<ShipmentTrackingActionResult> {
  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    return { kind: "error", message: FALLBACK_TRACKING_ERROR }
  }

  const parsed = shipmentTrackingActionResultSchema.safeParse(payload)

  if (!parsed.success || (!response.ok && parsed.data.kind !== "error")) {
    return { kind: "error", message: FALLBACK_TRACKING_ERROR }
  }

  return parsed.data
}
