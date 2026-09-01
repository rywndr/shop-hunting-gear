import "server-only"

import { Buffer } from "node:buffer"

import { midtransServerConfig } from "@/lib/payments/midtrans/config"
import {
  snapTransactionResponseSchema,
  type SnapTransaction,
} from "@/lib/payments/midtrans/schema"

type SnapItem = {
  readonly id: string
  readonly price: number
  readonly quantity: number
  readonly name: string
}

type SnapAddress = {
  readonly first_name: string
  readonly email: string
  readonly phone: string
  readonly address: string
  readonly city: string
  readonly postal_code: string
  readonly country_code: "IDN"
}

export type CreateSnapTransaction = {
  readonly orderId: string
  readonly grossAmount: number
  readonly items: readonly SnapItem[]
  readonly customer: {
    readonly name: string
    readonly email: string
    readonly phone: string
    readonly shippingAddress: SnapAddress
  }
}

export async function createSnapTransaction({
  orderId,
  grossAmount,
  items,
  customer,
}: CreateSnapTransaction): Promise<SnapTransaction> {
  const config = midtransServerConfig()
  const response = await fetch(config.snapApiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${config.serverKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      item_details: items,
      credit_card: { secure: true },
      customer_details: {
        first_name: customer.name,
        email: customer.email,
        phone: customer.phone,
        shipping_address: customer.shippingAddress,
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  const payload: unknown = await response.json()
  const parsed = snapTransactionResponseSchema.safeParse(payload)

  if (response.status !== 201 || !parsed.success) {
    throw new Error(
      `Midtrans Snap request failed with status ${response.status}.`
    )
  }

  return parsed.data
}
