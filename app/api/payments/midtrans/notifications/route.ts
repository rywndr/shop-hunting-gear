import { revalidatePath } from "next/cache"

import { midtransServerConfig } from "@/lib/payments/midtrans/config"
import { MidtransApiError } from "@/lib/payments/midtrans/client"
import { midtransNotificationSchema } from "@/lib/payments/midtrans/schema"
import { hasValidMidtransSignature } from "@/lib/payments/midtrans/security"
import { reconcileMidtransPayment } from "@/lib/payments/midtrans/service"
import {
  InvalidPaymentError,
  InventoryUnavailableError,
  UnknownOrderError,
} from "@/lib/orders/service"

export const maxDuration = 10

function revalidatePaymentViews() {
  revalidatePath("/history")
  revalidatePath("/admin/pesanan")
  revalidatePath("/admin/keuangan")
}

export async function POST(request: Request) {
  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return Response.json({ message: "Invalid JSON." }, { status: 400 })
  }

  const parsed = midtransNotificationSchema.safeParse(payload)

  if (!parsed.success) {
    return Response.json({ message: "Invalid notification." }, { status: 400 })
  }

  const notification = parsed.data
  const config = midtransServerConfig()

  if (
    !hasValidMidtransSignature({
      orderId: notification.order_id,
      statusCode: notification.status_code,
      grossAmount: notification.gross_amount,
      signature: notification.signature_key,
      serverKey: config.serverKey,
    })
  ) {
    return Response.json({ message: "Invalid signature." }, { status: 401 })
  }

  try {
    // The notification only wakes the reconciler. The status endpoint is the
    // source of truth for the state that reaches the database.
    await reconcileMidtransPayment(notification.order_id)
    revalidatePaymentViews()
    return Response.json({ received: true })
  } catch (error) {
    if (error instanceof UnknownOrderError) {
      return Response.json({ message: "Order not found." }, { status: 404 })
    }

    if (error instanceof InvalidPaymentError) {
      return Response.json(
        { message: "Payment does not match the order." },
        {
          status: 422,
        }
      )
    }

    if (error instanceof InventoryUnavailableError) {
      console.error(
        JSON.stringify({
          event: "payments.midtrans_inventory_conflict",
          orderId: notification.order_id,
          error: error.message,
        })
      )
      return Response.json(
        { message: "Payment inventory is temporarily unavailable." },
        {
          status: 503,
        }
      )
    }

    if (error instanceof MidtransApiError) {
      console.error(
        JSON.stringify({
          event: "payments.midtrans_notification_retryable_failure",
          orderId: notification.order_id,
          operation: error.operation,
          status: error.status,
          providerStatusCode: error.providerStatusCode,
        })
      )
      return Response.json(
        { message: "Payment status is unavailable." },
        {
          status: 503,
        }
      )
    }

    console.error(
      JSON.stringify({
        event: "payments.midtrans_notification_failed",
        orderId: notification.order_id,
        error: error instanceof Error ? error.message : String(error),
      })
    )
    return Response.json(
      { message: "Payment notification failed." },
      {
        status: 500,
      }
    )
  }
}
