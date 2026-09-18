"use server"

import { revalidatePath } from "next/cache"
import {
  returnReviewSchema,
  refundActionSchema,
  type ReturnReviewInput,
  type RefundActionInput,
} from "@/lib/returns/schema"
import { reviewReturn } from "@/lib/returns/service"
import {
  startReturnRefund,
  refreshReturnRefund,
  confirmOfflineRefund,
} from "@/lib/returns/refunds"
import { revalidateReturnViews } from "@/lib/returns/revalidation"

import { canAccessAdmin, getCurrentSession } from "@/lib/auth/session"
import type { ManualOrderInput } from "@/lib/admin/manual-order"
import {
  adminOrderCancellationSchema,
  type AdminOrderCancellationInput,
} from "@/lib/orders/cancellation"
import { requestOrderCancellation } from "@/lib/orders/cancellation-service"
import { executeOrderCancellation } from "@/lib/payments/midtrans/service"
import {
  createManualOrder,
  markOrderCompleted,
  markOrderPaidManually,
  shipOrder,
  UnknownOrderError,
  type ManualOrderRejection,
} from "@/lib/orders/service"

export type OrderMutationResult =
  | { readonly kind: "success"; readonly message?: string }
  | { readonly kind: "error"; readonly message: string }

export async function reviewReturnAction(
  input: ReturnReviewInput
): Promise<OrderMutationResult> {
  const session = await getCurrentSession()
  if (!canAccessAdmin(session) || !session)
    return { kind: "error", message: "Anda tidak dapat memeriksa retur." }
  const parsed = returnReviewSchema.safeParse(input)
  if (!parsed.success)
    return {
      kind: "error",
      message: "Periksa catatan dan jumlah barang retur.",
    }
  try {
    const changed = await reviewReturn({
      actorId: session.user.id,
      input: parsed.data,
    })
    revalidateReturnViews()
    return changed
      ? { kind: "success" }
      : {
          kind: "error",
          message:
            "Status retur berubah atau jumlah barang tidak sesuai. Muat ulang halaman.",
        }
  } catch (error) {
    console.error("Return review failed.", {
      event: "returns.review_failed",
      returnId: parsed.data.returnId,
      error,
    })
    return {
      kind: "error",
      message: "Pemeriksaan belum dapat dikonfirmasi. Muat ulang halaman.",
    }
  }
}

export async function refundReturnAction(
  input: RefundActionInput
): Promise<OrderMutationResult> {
  const session = await getCurrentSession()
  if (!canAccessAdmin(session) || !session)
    return { kind: "error", message: "Anda tidak dapat mengembalikan dana." }
  const parsed = refundActionSchema.safeParse(input)
  if (!parsed.success)
    return { kind: "error", message: "Data pengembalian dana tidak valid." }
  try {
    const value = parsed.data
    let changed: boolean
    switch (value.kind) {
      case "refund":
        changed = await startReturnRefund({
          returnId: value.returnId,
          actorId: session.user.id,
        })
        break
      case "reconcile":
        changed = await refreshReturnRefund(value.returnId)
        break
      case "confirm-offline":
        changed = await confirmOfflineRefund({
          ...value,
          actorId: session.user.id,
        })
        break
      default: {
        const _exhaustive: never = value
        return _exhaustive
      }
    }
    revalidateReturnViews({ finance: true })
    return changed
      ? { kind: "success" }
      : {
          kind: "error",
          message:
            "Pengembalian dana memerlukan pemeriksaan status, jumlah, atau batas waktu. Jangan melakukan pembayaran lain sebelum status dipastikan.",
        }
  } catch (error) {
    console.error("Return refund failed.", {
      event: "returns.refund_failed",
      returnId: parsed.data.returnId,
      error,
    })
    revalidateReturnViews({ finance: true })
    return {
      kind: "error",
      message:
        "Status pengembalian dana belum dapat dipastikan. Periksa status sebelum mencoba lagi; jangan membayar manual.",
    }
  }
}

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

export async function cancelAdminOrderAction(
  input: AdminOrderCancellationInput
): Promise<OrderMutationResult> {
  const session = await getCurrentSession()
  if (!canAccessAdmin(session) || !session) {
    return { kind: "error", message: "Anda tidak dapat membatalkan pesanan." }
  }

  const parsed = adminOrderCancellationSchema.safeParse(input)
  if (!parsed.success) {
    return {
      kind: "error",
      message: "Masukkan alasan pembatalan yang valid.",
    }
  }

  try {
    const requested = await requestOrderCancellation({
      orderId: parsed.data.orderId,
      actorId: session.user.id,
      actorType: "admin",
      reason: parsed.data.reason,
    })

    switch (requested.kind) {
      case "not-found":
        return { kind: "error", message: "Pesanan tidak ditemukan." }
      case "not-eligible":
        return {
          kind: "error",
          message: "Pesanan ini tidak dapat dibatalkan.",
        }
      case "created":
      case "existing":
        break
      default: {
        const _exhaustive: never = requested
        return _exhaustive
      }
    }

    const result = await executeOrderCancellation({
      orderId: parsed.data.orderId,
      actorId: session.user.id,
      actorType: "admin",
    })

    switch (result.kind) {
      case "completed":
        revalidatePath("/")
        return orderRefreshed()
      case "pending":
        return {
          kind: "error",
          message:
            "Status pembatalan masih diperiksa. Pesanan tetap ditahan dan belum boleh dikirim.",
        }
      case "refund_pending":
        revalidatePath("/")
        orderRefreshed()
        return {
          kind: "success",
          message:
            "Pesanan dibatalkan. Pengembalian dana sedang diproses dan pesanan tetap diblokir dari pengiriman.",
        }
      case "manual_refund_required":
        revalidatePath("/")
        orderRefreshed()
        return {
          kind: "success",
          message:
            "Pesanan dibatalkan. Pengembalian dana manual perlu diselesaikan oleh admin.",
        }
      case "paid":
        return {
          kind: "error",
          message: "Pesanan sudah dibayar dan tidak dapat dibatalkan di sini.",
        }
      case "not-eligible":
        return {
          kind: "error",
          message: "Status pesanan sudah berubah dan tidak dapat dibatalkan.",
        }
      case "not-found":
        return { kind: "error", message: "Pesanan tidak ditemukan." }
      default: {
        const _exhaustive: never = result
        return _exhaustive
      }
    }
  } catch (error) {
    logOrderMutationFailure({
      event: "admin.order_cancellation_failed",
      orderId: parsed.data.orderId,
      error,
    })
    return {
      kind: "error",
      message:
        "Pembatalan belum dapat dipastikan. Pesanan tetap ditahan dan belum boleh dikirim.",
    }
  }
}

export const cancelUnpaidOrderAction = cancelAdminOrderAction

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
