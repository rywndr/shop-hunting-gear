"use server"

import { randomUUID } from "node:crypto"

import { getCurrentSession } from "@/lib/auth/session"
import { cartSubtotal, cartWeight } from "@/lib/cart/config"
import { checkoutItemsForUser } from "@/lib/checkout/service"
import { createSnapTransaction } from "@/lib/payments/midtrans/client"
import {
  createSnapPaymentSchema,
  type CreateSnapPaymentInput,
} from "@/lib/payments/midtrans/schema"
import { shippingOptionsForUser } from "@/lib/shipping/service"

export type CreatePaymentResult =
  | {
      readonly kind: "ready"
      readonly orderId: string
      readonly token: string
    }
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

    const orderId = `HG-${randomUUID()}`
    const productDetails = items.map((item, index) => ({
      id: midtransItemText(`item-${index + 1}-${item.product.slug}`),
      price: item.product.price,
      quantity: item.quantity,
      name: midtransItemText(item.product.name),
    }))
    const payment = await createSnapTransaction({
      orderId,
      grossAmount: cartSubtotal(items) + selectedShipping.cost,
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

    return { kind: "ready", orderId, token: payment.token }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "checkout.snap_transaction_failed",
        userId: session.user.id,
        error: error instanceof Error ? error.message : String(error),
      })
    )
    return {
      kind: "error",
      message: "Pembayaran belum dapat dibuka. Coba lagi.",
    }
  }
}
