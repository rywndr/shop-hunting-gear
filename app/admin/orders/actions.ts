"use server"

import { revalidatePath } from "next/cache"

import { canAccessAdmin, getCurrentSession } from "@/lib/auth/session"
import type { ManualOrderInput } from "@/lib/admin/manual-order"
import {
  createManualOrder,
  markOrderCompleted,
  markOrderPaidManually,
  shipOrder,
  UnknownOrderError,
  type ManualOrderRejection,
} from "@/lib/orders/service"

export type OrderMutationResult =
  | { readonly kind: "success" }
  | { readonly kind: "error"; readonly message: string }

const REJECTION_MESSAGES = {
  "invalid-input": "Periksa kembali data pesanan.",
  "unknown-customer": "Pelanggan tidak ditemukan.",
  "unknown-product": "Produk tidak ditemukan atau tidak aktif.",
  "unknown-variant": "Varian produk tidak valid.",
  "insufficient-stock": "Stok produk tidak mencukupi.",
} as const satisfies Record<ManualOrderRejection, string>

async function isAuthorized() {
  return canAccessAdmin(await getCurrentSession())
}

function orderRefreshed(): OrderMutationResult {
  revalidatePath("/admin/orders")
  revalidatePath("/admin/finance")
  revalidatePath("/orders")
  return { kind: "success" }
}

function logOrderMutationFailure({
  event,
  orderId,
  error,
}: {
  event: string
  orderId: string | null
  error: unknown
}) {
  console.error(
    JSON.stringify({
      event,
      orderId,
      error: error instanceof Error ? error.message : String(error),
    })
  )
}

export async function createManualOrderAction(
  values: ManualOrderInput
): Promise<OrderMutationResult> {
  if (!(await isAuthorized())) {
    return { kind: "error", message: "Anda tidak dapat membuat pesanan." }
  }

  try {
    const result = await createManualOrder(values)

    if (result.kind === "rejected") {
      return { kind: "error", message: REJECTION_MESSAGES[result.reason] }
    }

    revalidatePath("/")
    return orderRefreshed()
  } catch (error) {
    logOrderMutationFailure({
      event: "admin.manual_order_create_failed",
      orderId: null,
      error,
    })
    return { kind: "error", message: "Pesanan belum tersimpan. Coba lagi." }
  }
}

export async function markOrderPaidAction(
  orderId: string
): Promise<OrderMutationResult> {
  if (!(await isAuthorized())) {
    return { kind: "error", message: "Anda tidak dapat mengubah pesanan." }
  }

  try {
    const result = await markOrderPaidManually(orderId)

    switch (result.kind) {
      case "settled":
      case "already-paid":
        revalidatePath("/")
        return orderRefreshed()
      case "inventory-unavailable":
        return {
          kind: "error",
          message:
            "Stok produk tidak mencukupi untuk menandai pesanan dibayar.",
        }
      case "not-manual":
        return {
          kind: "error",
          message:
            "Pesanan ini dibayar lewat Midtrans, jadi statusnya tidak dapat diubah manual.",
        }
      case "not-eligible":
        return {
          kind: "error",
          message: "Status pesanan tidak dapat ditandai sudah dibayar.",
        }
      default: {
        const _exhaustive: never = result
        return _exhaustive
      }
    }
  } catch (error) {
    if (error instanceof UnknownOrderError) {
      return { kind: "error", message: "Pesanan tidak ditemukan." }
    }

    logOrderMutationFailure({
      event: "admin.manual_order_payment_failed",
      orderId,
      error,
    })
    return { kind: "error", message: "Pembayaran belum tersimpan. Coba lagi." }
  }
}

export async function markOrderCompletedAction(
  orderId: string
): Promise<OrderMutationResult> {
  if (!(await isAuthorized())) {
    return { kind: "error", message: "Anda tidak dapat mengubah pesanan." }
  }

  try {
    const result = await markOrderCompleted(orderId)

    switch (result.kind) {
      case "completed":
      case "already-completed":
        return orderRefreshed()
      case "not-eligible":
        return {
          kind: "error",
          message: "Pesanan belum dibayar atau tidak dapat diselesaikan.",
        }
      default: {
        const _exhaustive: never = result
        return _exhaustive
      }
    }
  } catch (error) {
    if (error instanceof UnknownOrderError) {
      return { kind: "error", message: "Pesanan tidak ditemukan." }
    }

    logOrderMutationFailure({
      event: "admin.order_completion_failed",
      orderId,
      error,
    })
    return { kind: "error", message: "Perubahan belum tersimpan. Coba lagi." }
  }
}

export async function shipOrderAction(
  orderId: string,
  tracking: string
): Promise<OrderMutationResult> {
  if (!(await isAuthorized())) {
    return { kind: "error", message: "Anda tidak dapat mengubah pesanan." }
  }

  try {
    const result = await shipOrder({ orderId, tracking })

    switch (result.kind) {
      case "shipped":
        return orderRefreshed()
      case "already-shipped":
        return {
          kind: "error",
          message:
            "Status pesanan sudah berubah. Muat ulang halaman dan coba lagi.",
        }
      case "invalid-tracking":
        return { kind: "error", message: "Masukkan nomor resi yang valid." }
      case "not-eligible":
        return {
          kind: "error",
          message: "Pesanan ini tidak dapat ditandai dikirim.",
        }
      default: {
        const _exhaustive: never = result
        return _exhaustive
      }
    }
  } catch (error) {
    if (error instanceof UnknownOrderError) {
      return { kind: "error", message: "Pesanan tidak ditemukan." }
    }

    logOrderMutationFailure({
      event: "admin.order_shipment_failed",
      orderId,
      error,
    })
    return { kind: "error", message: "Pengiriman belum tersimpan. Coba lagi." }
  }
}
