import "server-only"

import { asc, desc, eq, and } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/lib/db/client"
import { customerOrder } from "@/lib/db/schema/order"
import {
  RajaOngkirTrackingError,
  rajaOngkirTracking,
  type RajaOngkirTrackingFailureKind,
} from "@/lib/shipping/rajaongkir"
import {
  trackingInputFromOrder,
  type RajaOngkirTrackingInput,
  type StoredShipmentFields,
} from "@/lib/shipping/tracking"
import type {
  ShipmentTracking,
  ShipmentTrackingActionResult,
} from "@/lib/shipping/schema"

const addressPhoneSchema = z.object({ phone: z.string() })

const orderTrackingSelection = {
  id: customerOrder.id,
  tracking: customerOrder.tracking,
  shippingCourier: customerOrder.shippingCourier,
  fulfillmentStatus: customerOrder.fulfillmentStatus,
  addressSnapshot: customerOrder.addressSnapshot,
} as const

type OrderTrackingRow = {
  readonly id: string
  readonly tracking: string | null
  readonly shippingCourier: string
  readonly fulfillmentStatus: string
  readonly addressSnapshot: unknown
}

export type StoredOrderTrackingRecord = StoredShipmentFields & {
  readonly id: string
  readonly fulfillmentStatus: string
}

function trackingRecordFromRow(row: OrderTrackingRow) {
  const address = addressPhoneSchema.safeParse(row.addressSnapshot)

  return {
    id: row.id,
    tracking: row.tracking,
    shippingCourier: row.shippingCourier,
    fulfillmentStatus: row.fulfillmentStatus,
    phone: address.success ? address.data.phone : null,
  } satisfies StoredOrderTrackingRecord
}

export async function orderTrackingRecord(orderId: string) {
  const [row] = await db
    .select(orderTrackingSelection)
    .from(customerOrder)
    .where(eq(customerOrder.id, orderId))
    .limit(1)

  return row ? trackingRecordFromRow(row) : null
}

export async function orderTrackingRecordForUser({
  userId,
  orderId,
}: {
  readonly userId: string
  readonly orderId: string
}) {
  const [row] = await db
    .select(orderTrackingSelection)
    .from(customerOrder)
    .where(and(eq(customerOrder.id, orderId), eq(customerOrder.userId, userId)))
    .limit(1)

  return row ? trackingRecordFromRow(row) : null
}

export type SavedAwbLookup =
  | { readonly kind: "not-found" }
  | { readonly kind: "found"; readonly order: StoredOrderTrackingRecord }
  | { readonly kind: "ambiguous" }

export async function orderTrackingRecordForSavedAwb(
  awb: string
): Promise<SavedAwbLookup> {
  const rows = await db
    .select(orderTrackingSelection)
    .from(customerOrder)
    .where(eq(customerOrder.tracking, awb))
    .orderBy(desc(customerOrder.placedAt), asc(customerOrder.id))
    .limit(2)

  if (rows.length > 1) return { kind: "ambiguous" }

  const [row] = rows
  return row
    ? { kind: "found", order: trackingRecordFromRow(row) }
    : { kind: "not-found" }
}

export type TrackingFailureKind = RajaOngkirTrackingFailureKind | "unknown"

export type OrderTrackingLookup =
  | { readonly kind: "success"; readonly data: ShipmentTracking }
  | { readonly kind: "not-found" }
  | { readonly kind: "not-eligible" }
  | { readonly kind: "missing-tracking" }
  | { readonly kind: "unsupported-courier" }
  | { readonly kind: "invalid-phone" }
  | {
      readonly kind: "provider-error"
      readonly failure: TrackingFailureKind
    }

function trackingFailure(error: unknown): TrackingFailureKind {
  return error instanceof RajaOngkirTrackingError ? error.kind : "unknown"
}

export async function trackTrackingInput(
  input: RajaOngkirTrackingInput
): Promise<OrderTrackingLookup> {
  try {
    return {
      kind: "success",
      data: await rajaOngkirTracking(input),
    }
  } catch (error) {
    return { kind: "provider-error", failure: trackingFailure(error) }
  }
}

export async function trackOrderRecord(
  order: StoredOrderTrackingRecord
): Promise<OrderTrackingLookup> {
  if (
    order.fulfillmentStatus !== "shipped" &&
    order.fulfillmentStatus !== "completed"
  ) {
    return { kind: "not-eligible" }
  }

  const prepared = trackingInputFromOrder(order)

  if (prepared.kind !== "ready") {
    return prepared
  }

  return trackTrackingInput(prepared.input)
}

export async function trackOrderById(
  orderId: string
): Promise<OrderTrackingLookup> {
  const order = await orderTrackingRecord(orderId)
  return order ? trackOrderRecord(order) : { kind: "not-found" }
}

export async function trackOrderForUser({
  userId,
  orderId,
}: {
  readonly userId: string
  readonly orderId: string
}): Promise<OrderTrackingLookup> {
  const order = await orderTrackingRecordForUser({ userId, orderId })
  return order ? trackOrderRecord(order) : { kind: "not-found" }
}

export function trackingProviderFailureMessage(failure: TrackingFailureKind) {
  switch (failure) {
    case "invalid-input":
      return "Data pelacakan tidak lengkap atau tidak valid."
    case "unauthorized":
      return "Pelacakan sedang tidak tersedia karena konfigurasi layanan bermasalah."
    case "not-found":
      return "Nomor resi tidak ditemukan di RajaOngkir."
    case "network":
      return "Layanan pelacakan tidak dapat dihubungi. Coba lagi."
    case "invalid-response":
      return "Layanan pelacakan mengembalikan data yang tidak dapat dibaca. Coba lagi."
    case "upstream":
      return "Layanan pelacakan sedang bermasalah. Coba lagi."
    case "unknown":
      return "Pelacakan belum dapat dimuat. Coba lagi."
    default: {
      const _exhaustive: never = failure
      return _exhaustive
    }
  }
}

export function trackingActionResult(
  result: OrderTrackingLookup
): ShipmentTrackingActionResult {
  switch (result.kind) {
    case "success":
      return { kind: "success", data: result.data }
    case "not-found":
      return { kind: "error", message: "Pesanan tidak ditemukan." }
    case "not-eligible":
      return {
        kind: "error",
        message: "Pesanan ini belum memiliki pengiriman yang dapat dilacak.",
      }
    case "missing-tracking":
      return { kind: "error", message: "Nomor resi pesanan belum tersedia." }
    case "unsupported-courier":
      return {
        kind: "error",
        message: "Pelacakan otomatis belum tersedia untuk jasa kirim ini.",
      }
    case "invalid-phone":
      return {
        kind: "error",
        message: "Nomor telepon penerima pada pesanan tidak valid.",
      }
    case "provider-error":
      return {
        kind: "error",
        message: trackingProviderFailureMessage(result.failure),
      }
    default: {
      const _exhaustive: never = result
      return _exhaustive
    }
  }
}

export function trackingLookupResponse(result: OrderTrackingLookup) {
  const status =
    result.kind === "success"
      ? 200
      : result.kind === "not-found"
        ? 404
        : result.kind === "not-eligible"
          ? 409
          : result.kind === "provider-error"
            ? result.failure === "invalid-input"
              ? 400
              : result.failure === "not-found"
                ? 404
                : result.failure === "unauthorized"
                  ? 503
                  : 502
            : 422

  return Response.json(trackingActionResult(result), {
    status,
    headers: { "Cache-Control": "private, no-store" },
  })
}
