"use server"

import { revalidatePath } from "next/cache"

import { getCurrentSession } from "@/lib/auth/session"
import { cartSubtotal, cartWeight } from "@/lib/cart/config"
import { checkoutItemsForUser } from "@/lib/checkout/service"
import {
  createOrResumeUnpaidOrder,
  failPaymentInitialization,
  markPaymentInitializationRetryableFailure,
  markPaymentInitializationStarted,
  paymentDetailsForUserOrder,
  saveSnapTransactionForOrder,
} from "@/lib/orders/service"
import {
  createSnapTransaction,
  MidtransApiError,
} from "@/lib/payments/midtrans/client"
import type { MidtransPaymentOutcome } from "@/lib/payments/midtrans/reconciliation"
import {
  confirmPaymentSchema,
  createSnapPaymentSchema,
  type CreateSnapPaymentInput,
} from "@/lib/payments/midtrans/schema"
import {
  reconcileExpiredSnapSessionReservations,
  reconcileMidtransPayment,
} from "@/lib/payments/midtrans/service"
import { shippingOptionsForUser } from "@/lib/shipping/service"

export type CreatePaymentResult =
  | {
      readonly kind: "ready"
      readonly orderId: string
      readonly token: string
      readonly customerNote: string | null
    }
  | { readonly kind: "error"; readonly message: string }

export type ConfirmPaymentResult =
  | { readonly kind: "paid" }
  | { readonly kind: "pending" }
  | { readonly kind: "cancelled" }
  | { readonly kind: "error"; readonly message: string }

function midtransText({
  value,
  maxLength,
}: {
  value: string
  maxLength: number
}) {
  return value.slice(0, maxLength)
}

function midtransItemText(value: string) {
  return midtransText({ value: value.replaceAll("|", "/"), maxLength: 50 })
}

function revalidatePaymentViews() {
  revalidatePath("/orders")
  revalidatePath("/admin/orders")
  revalidatePath("/admin/finance")
}

function confirmationResult(
  outcome: MidtransPaymentOutcome
): ConfirmPaymentResult {
  switch (outcome.kind) {
    case "paid":
      return { kind: "paid" }
    case "pending":
      return { kind: "pending" }
    case "cancelled":
    case "reversed":
      return { kind: "cancelled" }
    case "unknown":
      return {
        kind: "error",
        message: "Status pembayaran belum dapat dikonfirmasi. Coba lagi.",
      }
    default: {
      const _exhaustive: never = outcome
      return _exhaustive
    }
  }
}

export async function confirmPaymentAction(
  input: unknown
): Promise<ConfirmPaymentResult> {
  const parsed = confirmPaymentSchema.safeParse(input)

  if (!parsed.success) {
    return { kind: "error", message: "Data pembayaran tidak valid." }
  }

  const session = await getCurrentSession()

  if (!session) {
    return { kind: "error", message: "Silakan masuk untuk melanjutkan." }
  }

  const order = await paymentDetailsForUserOrder({
    userId: session.user.id,
    orderId: parsed.data.orderId,
  })

  if (!order) {
    return { kind: "error", message: "Pesanan tidak ditemukan." }
  }

  try {
    const result = await reconcileMidtransPayment(parsed.data.orderId)
    revalidatePaymentViews()
    return confirmationResult(result.outcome)
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "checkout.payment_confirmation_failed",
        orderId: parsed.data.orderId,
        userId: session.user.id,
        error: error instanceof Error ? error.message : String(error),
      })
    )
    return {
      kind: "error",
      message: "Status pembayaran belum dapat dikonfirmasi. Coba lagi.",
    }
  }
}

export async function createPaymentAction(
  input: CreateSnapPaymentInput
): Promise<CreatePaymentResult> {
  const parsed = createSnapPaymentSchema.safeParse(input)

  if (!parsed.success) {
    return { kind: "error", message: "Data pembayaran tidak valid." }
  }

  const session = await getCurrentSession()

  if (!session) {
    return { kind: "error", message: "Silakan masuk untuk melanjutkan." }
  }

  let localOrderId: string | undefined

  try {
    const items = await checkoutItemsForUser({
      userId: session.user.id,
      source: parsed.data.source,
    })

    if (items.length === 0) {
      return {
        kind: "error",
        message: "Produk tidak tersedia. Periksa kembali pesanan Anda.",
      }
    }

    try {
      await reconcileExpiredSnapSessionReservations({
        productSlugs: items.map((item) => item.product.slug),
      })
      revalidatePaymentViews()
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "checkout.expired_snap_session_cleanup_failed",
          userId: session.user.id,
          error: error instanceof Error ? error.message : String(error),
        })
      )
    }

    const shipping = await shippingOptionsForUser({
      userId: session.user.id,
      addressId: parsed.data.addressId,
      weight: cartWeight(items),
    })

    if (shipping.kind !== "ready") {
      return {
        kind: "error",
        message: "Alamat atau pilihan pengiriman tidak lagi tersedia.",
      }
    }

    const selectedShipping = shipping.options.find(
      (option) =>
        option.kind === "available" &&
        option.courier === parsed.data.shipping.courier &&
        option.service === parsed.data.shipping.service
    )

    if (!selectedShipping || selectedShipping.kind !== "available") {
      return {
        kind: "error",
        message: "Pilihan pengiriman tidak lagi tersedia.",
      }
    }

    const localOrder = await createOrResumeUnpaidOrder({
      userId: session.user.id,
      addressId: parsed.data.addressId,
      customerNote: parsed.data.customerNote ?? null,
      source: parsed.data.source,
      items,
      shipping: {
        courier: selectedShipping.courier,
        courierName: selectedShipping.courierName,
        service: selectedShipping.service,
        cost: selectedShipping.cost,
      },
      address: shipping.address,
    })
    localOrderId = localOrder.id

    if (localOrder.snapToken) {
      if (
        localOrder.paymentSessionExpiresAt !== null &&
        localOrder.paymentSessionExpiresAt.getTime() <= Date.now()
      ) {
        return {
          kind: "error",
          message:
            "Sesi pembayaran sebelumnya masih dikonfirmasi. Coba lagi sebentar.",
        }
      }

      return {
        kind: "ready",
        orderId: localOrder.id,
        token: localOrder.snapToken,
        customerNote: localOrder.customerNote,
      }
    }

    await markPaymentInitializationStarted({
      userId: session.user.id,
      orderId: localOrder.id,
    })

    const currentOrder = await paymentDetailsForUserOrder({
      userId: session.user.id,
      orderId: localOrder.id,
    })

    if (
      !currentOrder ||
      currentOrder.fulfillmentStatus !== "awaiting_payment"
    ) {
      throw new Error("Payment order is no longer available.")
    }

    if (!currentOrder.midtransCreateIdempotencyKey) {
      throw new Error("No Midtrans create idempotency key.")
    }

    if (currentOrder.snapToken) {
      if (
        currentOrder.paymentSessionExpiresAt !== null &&
        currentOrder.paymentSessionExpiresAt.getTime() <= Date.now()
      ) {
        return {
          kind: "error",
          message:
            "Sesi pembayaran sebelumnya masih dikonfirmasi. Coba lagi sebentar.",
        }
      }

      return {
        kind: "ready",
        orderId: currentOrder.id,
        token: currentOrder.snapToken,
        customerNote: currentOrder.customerNote,
      }
    }

    const productDetails = items.map((item, index) => ({
      id: midtransItemText(`item-${index + 1}-${item.product.slug}`),
      price: item.product.price,
      quantity: item.quantity,
      name: midtransItemText(item.product.name),
    }))
    const grossAmount = cartSubtotal(items) + selectedShipping.cost
    const payment = await createSnapTransaction({
      orderId: localOrder.id,
      idempotencyKey: currentOrder.midtransCreateIdempotencyKey,
      grossAmount,
      items: [
        ...productDetails,
        {
          id: "shipping",
          price: selectedShipping.cost,
          quantity: 1,
          name: midtransItemText(
            `Pengiriman ${selectedShipping.courierName} ${selectedShipping.service}`
          ),
        },
      ],
      customer: {
        name: midtransText({ value: session.user.name, maxLength: 255 }),
        email: session.user.email,
        phone: shipping.address.phone,
        shippingAddress: {
          first_name: midtransText({
            value: shipping.address.recipient,
            maxLength: 255,
          }),
          email: session.user.email,
          phone: shipping.address.phone,
          address: midtransText({
            value: shipping.address.street,
            maxLength: 255,
          }),
          city: midtransText({
            value: shipping.address.city,
            maxLength: 100,
          }),
          postal_code: midtransText({
            value: shipping.address.postalCode,
            maxLength: 10,
          }),
          country_code: "IDN",
        },
      },
    })

    const saved = await saveSnapTransactionForOrder({
      userId: session.user.id,
      orderId: localOrder.id,
      payment,
    })

    if (!saved) {
      throw new Error("Snap transaction could not be saved to the order.")
    }

    revalidatePath("/orders")
    return {
      kind: "ready",
      orderId: localOrder.id,
      token: saved.token,
      customerNote: localOrder.customerNote,
    }
  } catch (error) {
    if (
      localOrderId &&
      error instanceof MidtransApiError &&
      !error.retryable &&
      error.status !== 406 &&
      error.status !== 409
    ) {
      try {
        await failPaymentInitialization({
          userId: session.user.id,
          orderId: localOrderId,
        })
      } catch (cleanupError) {
        console.error(
          JSON.stringify({
            event: "checkout.payment_initialization_cleanup_failed",
            orderId: localOrderId,
            error:
              cleanupError instanceof Error
                ? cleanupError.message
                : String(cleanupError),
          })
        )
      }
    } else if (localOrderId) {
      try {
        await markPaymentInitializationRetryableFailure({
          userId: session.user.id,
          orderId: localOrderId,
        })
      } catch (stateError) {
        console.error(
          JSON.stringify({
            event: "checkout.payment_initialization_state_failed",
            orderId: localOrderId,
            error:
              stateError instanceof Error
                ? stateError.message
                : String(stateError),
          })
        )
      }
    }

    console.error(
      JSON.stringify({
        event: "checkout.snap_transaction_failed",
        userId: session.user.id,
        orderId: localOrderId,
        error: error instanceof Error ? error.message : String(error),
      })
    )
    return {
      kind: "error",
      message: "Pembayaran belum dapat dibuka. Coba lagi.",
    }
  }
}
