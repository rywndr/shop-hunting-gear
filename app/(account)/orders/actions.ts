"use server"

import { revalidatePath } from "next/cache"
import { randomUUID } from "node:crypto"
import {
  customerReturnStates,
  createReturnRequest,
} from "@/lib/returns/service"
import { returnRequestSchema } from "@/lib/returns/schema"
import { uploadReturnPhotos, cleanupReturnPhotos } from "@/lib/returns/photos"
import { revalidateReturnViews } from "@/lib/returns/revalidation"
import { z } from "zod"

import { getCurrentSession } from "@/lib/auth/session"
import { customerOrderCancellationSchema } from "@/lib/orders/cancellation"
import { requestOrderCancellation } from "@/lib/orders/cancellation-service"
import { confirmOrderReceivedForUser } from "@/lib/orders/service"
import { executeOrderCancellation } from "@/lib/payments/midtrans/service"

export type CancelOrderResult =
  | {
      readonly kind: "success"
      readonly state: "completed" | "refund_pending" | "manual_refund_required"
      readonly message: string
    }
  | { readonly kind: "pending"; readonly message: string }
  | { readonly kind: "error"; readonly message: string }

export type ConfirmOrderReceivedResult =
  | { readonly kind: "success" }
  | { readonly kind: "error"; readonly message: string }

export async function submitReturnAction(
  form: FormData
): Promise<ConfirmOrderReceivedResult> {
  const session = await getCurrentSession()
  if (!session)
    return { kind: "error", message: "Silakan masuk untuk melanjutkan." }
  const parsed = returnRequestSchema.safeParse({
    orderId: form.get("orderId"),
    reason: form.get("reason"),
    details: form.get("details"),
  })
  const entries = form.getAll("photos")
  const files = entries.filter((entry): entry is File => entry instanceof File)
  if (
    !parsed.success ||
    files.length !== entries.length ||
    files.length < 1 ||
    files.length > 4
  )
    return {
      kind: "error",
      message: "Periksa alasan, penjelasan, dan foto retur.",
    }
  const id = randomUUID()
  try {
    const states = await customerReturnStates({
      userId: session.user.id,
      orderIds: [parsed.data.orderId],
    })
    if (states.get(parsed.data.orderId)?.kind !== "eligible")
      return {
        kind: "error",
        message:
          "Pesanan tidak memenuhi syarat retur atau sudah pernah diajukan.",
      }
    const photos = await uploadReturnPhotos({ returnId: id, files })
    // Do not delete evidence on an ambiguous database/network error. The insert
    // may have committed. Only a definitive rejected insert permits cleanup.
    const result = await createReturnRequest({
      ...parsed.data,
      userId: session.user.id,
      photos,
      id,
    })
    if (result.kind !== "created") {
      await cleanupReturnPhotos(photos)
      revalidateReturnViews()
      return {
        kind: "error",
        message:
          "Pesanan tidak memenuhi syarat retur atau sudah pernah diajukan.",
      }
    }
    revalidateReturnViews()
    return { kind: "success" }
  } catch (error) {
    console.error("Return submission failed.", {
      event: "returns.submit_failed",
      returnId: id,
      error,
    })
    return {
      kind: "error",
      message:
        "Pengajuan belum dapat dikonfirmasi. Muat ulang riwayat pesanan sebelum mencoba lagi.",
    }
  }
}

const orderIdSchema = z.string().trim().min(1)

export async function confirmOrderReceivedAction(
  orderId: string
): Promise<ConfirmOrderReceivedResult> {
  const parsedOrderId = orderIdSchema.safeParse(orderId)

  if (!parsedOrderId.success) {
    return { kind: "error", message: "Data pesanan tidak valid." }
  }

  const session = await getCurrentSession()

  if (!session) {
    return { kind: "error", message: "Silakan masuk untuk melanjutkan." }
  }

  try {
    const result = await confirmOrderReceivedForUser({
      userId: session.user.id,
      orderId: parsedOrderId.data,
    })

    switch (result.kind) {
      case "completed":
      case "already-completed":
        revalidatePath("/orders")
        revalidatePath("/admin/orders")
        revalidatePath("/admin/finance")
        return { kind: "success" }
      case "not-found":
        return { kind: "error", message: "Pesanan tidak ditemukan." }
      case "not-eligible":
        return {
          kind: "error",
          message:
            "Pesanan ini belum dapat dikonfirmasi sebagai sudah diterima.",
        }
      default: {
        const _exhaustive: never = result
        return _exhaustive
      }
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "orders.customer_confirm_received_failed",
        orderId: parsedOrderId.data,
        userId: session.user.id,
        error: error instanceof Error ? error.message : String(error),
      })
    )
    return {
      kind: "error",
      message: "Pesanan belum dapat dikonfirmasi. Coba lagi.",
    }
  }
}

export async function cancelOrderAction(input: {
  readonly orderId: string
  readonly reason: string
}): Promise<CancelOrderResult> {
  const parsed = customerOrderCancellationSchema.safeParse(input)

  if (!parsed.success) {
    return { kind: "error", message: "Masukkan alasan pembatalan." }
  }

  const session = await getCurrentSession()

  if (!session) {
    return { kind: "error", message: "Silakan masuk untuk melanjutkan." }
  }

  try {
    const actor = { actorId: session.user.id, actorType: "customer" } as const
    const requested = await requestOrderCancellation({
      orderId: parsed.data.orderId,
      reason: parsed.data.reason,
      ...actor,
    })

    if (requested.kind === "not-found")
      return { kind: "error", message: "Pesanan tidak ditemukan." }
    if (requested.kind === "not-eligible")
      return {
        kind: "error",
        message: "Status pesanan sudah berubah dan tidak dapat dibatalkan.",
      }

    const result = await executeOrderCancellation({
      orderId: parsed.data.orderId,
      ...actor,
    })
    const revalidateCancellationViews = () => {
      revalidatePath("/orders")
      revalidatePath("/admin/orders")
      revalidatePath("/admin/finance")
    }

    switch (result.kind) {
      case "completed":
        revalidateCancellationViews()
        return {
          kind: "success",
          state: "completed",
          message: "Pesanan berhasil dibatalkan.",
        }
      case "refund_pending":
        revalidateCancellationViews()
        return {
          kind: "success",
          state: "refund_pending",
          message:
            "Pesanan berhasil dibatalkan. Pengembalian dana sedang diproses.",
        }
      case "manual_refund_required":
        revalidateCancellationViews()
        return {
          kind: "success",
          state: "manual_refund_required",
          message:
            "Pesanan berhasil dibatalkan. Pengembalian dana akan diproses secara manual.",
        }
      case "pending":
        revalidateCancellationViews()
        return {
          kind: "pending",
          message:
            "Pembatalan sedang diproses. Pesanan tetap ditahan dan tidak akan dikirim selama statusnya diperiksa.",
        }
      case "paid":
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
    console.error(
      JSON.stringify({
        event: "orders.customer_cancellation_failed",
        orderId: parsed.data.orderId,
        userId: session.user.id,
        error: error instanceof Error ? error.message : String(error),
      })
    )
    return {
      kind: "error",
      message: "Pesanan belum dapat dibatalkan. Coba lagi.",
    }
  }
}
