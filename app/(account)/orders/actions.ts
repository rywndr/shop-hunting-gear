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
import { confirmOrderReceivedForUser } from "@/lib/orders/service"
import { cancelMidtransOrderForUser } from "@/lib/payments/midtrans/service"

export type CancelOrderResult =
  | { readonly kind: "success" }
  | { readonly kind: "paid"; readonly message: string }
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

export async function cancelOrderAction(
  orderId: string
): Promise<CancelOrderResult> {
  const parsedOrderId = orderIdSchema.safeParse(orderId)

  if (!parsedOrderId.success) {
    return { kind: "error", message: "Data pesanan tidak valid." }
  }

  const session = await getCurrentSession()

  if (!session) {
    return { kind: "error", message: "Silakan masuk untuk melanjutkan." }
  }

  let result: Awaited<ReturnType<typeof cancelMidtransOrderForUser>>

  try {
    result = await cancelMidtransOrderForUser({
      userId: session.user.id,
      orderId: parsedOrderId.data,
    })
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "checkout.order_cancellation_failed",
        orderId: parsedOrderId.data,
        userId: session.user.id,
        error: error instanceof Error ? error.message : String(error),
      })
    )
    return {
      kind: "error",
      message: "Pesanan belum dapat dibatalkan. Coba lagi.",
    }
  }

  switch (result.kind) {
    case "cancelled":
      revalidatePath("/orders")
      revalidatePath("/admin/orders")
      return { kind: "success" }
    case "paid":
      revalidatePath("/orders")
      revalidatePath("/admin/orders")
      return {
        kind: "paid",
        message: "Pesanan sudah dibayar dan tidak dapat dibatalkan.",
      }
    case "pending":
      return {
        kind: "pending",
        message: "Status pembatalan masih diproses. Coba lagi sebentar.",
      }
    case "not-found":
      return { kind: "error", message: "Pesanan tidak ditemukan." }
    case "error":
      return {
        kind: "error",
        message:
          "Pesanan belum dapat dibatalkan karena status pembayaran belum dapat dikonfirmasi. Coba lagi.",
      }
    default: {
      const _exhaustive: never = result
      return _exhaustive
    }
  }
}
