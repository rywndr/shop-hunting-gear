import "server-only"

import { addressesForUser } from "@/lib/account/service"
import type { Address } from "@/lib/account/types"
import { rajaOngkirShippingOptions } from "@/lib/shipping/rajaongkir"
import type { ShippingOption } from "@/lib/shipping/schema"

export type ShippingQuoteLookup =
  | {
      readonly kind: "ready"
      readonly address: Address & { readonly subdistrictId: number }
      readonly options: readonly ShippingOption[]
    }
  | { readonly kind: "address-not-found" }
  | { readonly kind: "address-incomplete" }
  | { readonly kind: "empty-checkout" }

export async function shippingOptionsForUser({
  userId,
  addressId,
  weight,
}: {
  userId: string
  addressId: string
  weight: number
}): Promise<ShippingQuoteLookup> {
  if (weight <= 0) {
    return { kind: "empty-checkout" }
  }

  const addresses = await addressesForUser(userId)
  const address = addresses.find((candidate) => candidate.id === addressId)

  if (!address) {
    return { kind: "address-not-found" }
  }

  if (address.subdistrictId === null) {
    return { kind: "address-incomplete" }
  }

  const options = await rajaOngkirShippingOptions({
    destinationId: address.subdistrictId,
    weight,
  })

  return {
    kind: "ready",
    address: { ...address, subdistrictId: address.subdistrictId },
    options,
  }
}
