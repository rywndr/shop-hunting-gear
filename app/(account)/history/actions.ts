"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getCurrentSession } from "@/lib/auth/session"
import { cancelMidtransOrderForUser } from "@/lib/payments/midtrans/service"

export type CancelOrderResult =
  | { readonly kind: "success" }
  | { readonly kind: "paid"; readonly message: string }
  | { readonly kind: "pending"; readonly message: string }
  | { readonly kind: "error"; readonly message: string }

const cancelOrderSchema = z.string().trim().min(1)

export async function cancelOrderAction(
  orderId: string
): Promise<CancelOrderResult> {
  const parsedOrderId = cancelOrderSchema.safeParse(orderId)

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
      revalidatePath("/history")
      revalidatePath("/admin/pesanan")
      return { kind: "success" }
    case "paid":
      revalidatePath("/history")
      revalidatePath("/admin/pesanan")
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
