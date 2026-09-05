"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { CheckCircleIcon, MapPinIcon, PackageIcon } from "@phosphor-icons/react"

import { FLAT_CARD } from "@/components/account/account-card"
import { useCart } from "@/components/cart/cart-provider"
import { SnapPaymentButton } from "@/components/checkout/snap-payment-button"
import { TextareaField } from "@/components/form/fields"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Address } from "@/lib/account/types"
import { cartSubtotal, type CartItem } from "@/lib/cart/config"
import type { CheckoutSource } from "@/lib/checkout/config"
import { ORDER_CREATED_CLEANUP_ERROR_MESSAGE } from "@/lib/checkout/order-created"
import type { MidtransBrowserConfig } from "@/lib/payments/midtrans/config"
import { shippingOptionId, SHIPPING_COURIERS } from "@/lib/shipping/config"
import {
  shippingQuotesResponseSchema,
  type ShippingOption,
} from "@/lib/shipping/schema"
import { formatNumber, formatRupiah } from "@/utils/format/intl"

type QuoteState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "loaded"; readonly options: readonly ShippingOption[] }
  | { readonly kind: "error"; readonly message: string }

type AvailableShippingOption = Extract<
  ShippingOption,
  { readonly kind: "available" }
>

function addressLine(address: Address) {
  return `${address.street}, ${address.subdistrict}, ${address.district}, ${address.city}, ${address.province} ${address.postalCode}`
}

function CheckoutForm({
  addresses,
  items,
  midtrans,
  source,
}: {
  addresses: readonly Address[]
  items: readonly CartItem[]
  midtrans: MidtransBrowserConfig
  source: CheckoutSource
}) {
  const usableAddresses = addresses.filter(
    (address) => address.subdistrictId !== null
  )
  const preferredAddress =
    usableAddresses.find((address) => address.isPrimary) ?? usableAddresses[0]
  const [addressId, setAddressId] = useState(preferredAddress?.id ?? "")
  const [quoteState, setQuoteState] = useState<QuoteState>(
    preferredAddress ? { kind: "loading" } : { kind: "idle" }
  )
  const [shippingId, setShippingId] = useState("")
  const [customerNote, setCustomerNote] = useState("")
  const [orderPreparing, setOrderPreparing] = useState(false)
  const [orderPrepared, setOrderPrepared] = useState(false)
  const { clearCart } = useCart()
  const subtotal = cartSubtotal(items)
  const checkoutLocked = orderPreparing || orderPrepared

  useEffect(() => {
    if (!addressId) {
      return
    }

    const abortController = new AbortController()
    const params = new URLSearchParams({ addressId, source: source.kind })

    if (source.kind === "product") {
      params.set("productSlug", source.productSlug)
      params.set("quantity", String(source.quantity))
    }

    fetch(`/api/shipping/quotes?${params}`, {
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Shipping quote request failed.")
        }

        const result = shippingQuotesResponseSchema.safeParse(
          await response.json()
        )

        if (!result.success) {
          throw new Error("Invalid shipping quote response.")
        }

        setQuoteState({ kind: "loaded", options: result.data.options })
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") {
          return
        }

        setQuoteState({
          kind: "error",
          message: "Biaya kirim tidak dapat dimuat. Coba pilih alamat lagi.",
        })
      })

    return () => abortController.abort()
  }, [addressId, source])

  const selectedShipping = useMemo(() => {
    if (quoteState.kind !== "loaded") return undefined

    return quoteState.options.find(
      (option): option is AvailableShippingOption =>
        option.kind === "available" && shippingOptionId(option) === shippingId
    )
  }, [quoteState, shippingId])
  const total = subtotal + (selectedShipping?.cost ?? 0)

  function selectAddress(value: string) {
    setShippingId("")
    setQuoteState(value ? { kind: "loading" } : { kind: "idle" })
    setAddressId(value)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-5">
        <section aria-labelledby="checkout-address-title">
          <Card className={FLAT_CARD}>
            <CardHeader>
              <CardTitle
                id="checkout-address-title"
                className="flex items-center gap-2 uppercase"
              >
                <MapPinIcon aria-hidden />
                Alamat Pengiriman
              </CardTitle>
            </CardHeader>
            <CardContent>
              {addresses.length === 0 ? (
                <div className="flex flex-col items-start gap-3 text-sm">
                  <p className="text-muted-foreground">
                    Tambahkan alamat sebelum memilih pengiriman.
                  </p>
                  <Button render={<Link href="/account" />} variant="outline">
                    Tambah Alamat
                  </Button>
                </div>
              ) : (
                <RadioGroup
                  aria-labelledby="checkout-address-title"
                  value={addressId}
                  onValueChange={(value) => selectAddress(String(value))}
                  className="grid gap-3"
                >
                  {addresses.map((address) => {
                    const usable = address.subdistrictId !== null

                    return (
                      <Radio.Root
                        key={address.id}
                        value={address.id}
                        disabled={!usable || checkoutLocked}
                        className="group flex w-full items-start gap-3 border border-border p-4 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 data-checked:border-primary data-checked:bg-primary/5"
                      >
                        <CheckCircleIcon
                          aria-hidden
                          className="mt-0.5 hidden size-5 shrink-0 text-primary group-data-checked:block"
                        />
                        <MapPinIcon
                          aria-hidden
                          className="mt-0.5 size-5 shrink-0 text-muted-foreground group-data-checked:hidden"
                        />
                        <span className="min-w-0 text-sm">
                          <span className="block font-medium">
                            {address.label} · {address.recipient}
                          </span>
                          <span className="mt-1 block text-muted-foreground">
                            {addressLine(address)}
                          </span>
                          {!usable && (
                            <span className="mt-2 block text-destructive">
                              Perbarui alamat ini.
                            </span>
                          )}
                        </span>
                      </Radio.Root>
                    )
                  })}
                </RadioGroup>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="checkout-courier-title">
          <Card className={FLAT_CARD}>
            <CardHeader>
              <CardTitle
                id="checkout-courier-title"
                className="flex items-center gap-2 uppercase"
              >
                Pilihan Pengiriman
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!addressId || quoteState.kind === "idle" ? (
                <p className="text-sm text-muted-foreground">
                  Pilih alamat untuk melihat biaya kirim.
                </p>
              ) : quoteState.kind === "loading" ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Menghitung biaya kirim dari kurir yang tersedia...
                </p>
              ) : quoteState.kind === "error" ? (
                <p role="alert" className="text-sm text-destructive">
                  {quoteState.message}
                </p>
              ) : (
                <RadioGroup
                  aria-labelledby="checkout-courier-title"
                  value={shippingId}
                  onValueChange={(value) => setShippingId(String(value))}
                  className="grid gap-3"
                >
                  {SHIPPING_COURIERS.map((courier) => {
                    const options = quoteState.options.filter(
                      (option) => option.courier === courier.code
                    )
                    const headingId = `checkout-courier-${courier.code}`

                    return (
                      <div
                        key={courier.code}
                        role="group"
                        aria-labelledby={headingId}
                        className="border border-border"
                      >
                        <header className="flex min-h-14 items-center gap-3 border-b border-border bg-muted/40 px-4 py-2">
                          <Image
                            src={courier.logoSrc}
                            alt=""
                            width={120}
                            height={32}
                            className="h-8 w-30 shrink-0 object-contain object-left"
                          />
                        </header>
                        <div className="divide-y divide-border">
                          {options.map((option) =>
                            option.kind === "unavailable" ? (
                              <div
                                key={option.courier}
                                className="flex items-start gap-3 p-4 text-sm"
                              >
                                <p className="text-muted-foreground">
                                  Biaya kirim tidak ditemukan untuk kurir ini.
                                </p>
                              </div>
                            ) : (
                              <Radio.Root
                                key={shippingOptionId(option)}
                                value={shippingOptionId(option)}
                                disabled={checkoutLocked}
                                className="group flex w-full items-start gap-3 p-4 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset data-checked:bg-primary/5"
                              >
                                <CheckCircleIcon
                                  aria-hidden
                                  className="mt-0.5 hidden size-5 shrink-0 text-primary group-data-checked:block"
                                />
                                <span className="flex min-w-0 flex-1 justify-between gap-3 text-sm">
                                  <span>
                                    <span className="block font-medium">
                                      {option.service}
                                    </span>
                                    <span className="mt-1 block text-muted-foreground">
                                      {option.description ||
                                        "Layanan pengiriman"}
                                      {option.etd
                                        ? ` · Estimasi ${option.etd}`
                                        : ""}
                                    </span>
                                  </span>
                                  <span className="shrink-0 font-medium tabular-nums">
                                    {formatRupiah(option.cost)}
                                  </span>
                                </span>
                              </Radio.Root>
                            )
                          )}
                        </div>
                      </div>
                    )
                  })}
                </RadioGroup>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="checkout-note-title">
          <Card className={FLAT_CARD}>
            <CardHeader>
              <CardTitle id="checkout-note-title" className="uppercase">
                Catatan untuk Penjual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TextareaField
                id="customer-note"
                label="Tambahkan catatan untuk pesanan ini (opsional)"
                value={customerNote}
                onChange={(event) => setCustomerNote(event.target.value)}
                maxLength={500}
                readOnly={checkoutLocked}
                description={
                  orderPrepared
                    ? "Catatan tidak dapat diubah setelah pesanan dibuat."
                    : undefined
                }
                placeholder="Tambahkan catatan untuk pesanan ini (opsional)"
              />
            </CardContent>
          </Card>
        </section>
      </div>

      <aside
        aria-labelledby="checkout-summary-title"
        className="lg:sticky lg:top-5"
      >
        <Card className={FLAT_CARD}>
          <CardHeader>
            <CardTitle
              id="checkout-summary-title"
              className="flex items-center gap-2 uppercase"
            >
              <PackageIcon aria-hidden />
              Pesanan
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 border-b border-border pb-4"
                >
                  <ProductThumbnail
                    src={
                      item.product.images[0].thumbnailUrl ??
                      item.product.images[0].url
                    }
                    label={`Gambar ${item.product.name}`}
                    className="size-14 shrink-0"
                  />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{item.product.name}</p>
                    {item.variants.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.variants
                          .map(({ label, value }) => `${label}: ${value}`)
                          .join(", ")}
                      </p>
                    )}
                    <div className="mt-2 flex justify-between gap-2">
                      <span className="text-muted-foreground">
                        {formatNumber(item.quantity)} barang
                      </span>
                      <span className="tabular-nums">
                        {formatRupiah(item.product.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{formatRupiah(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Ongkos kirim</dt>
                <dd className="tabular-nums">
                  {selectedShipping
                    ? formatRupiah(selectedShipping.cost)
                    : "Kurir belum dipilih"}
                </dd>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border pt-3">
                <dt className="font-medium">Total</dt>
                <dd className="font-heading text-lg font-bold tabular-nums">
                  {formatRupiah(total)}
                </dd>
              </div>
            </dl>

            <SnapPaymentButton
              addressId={addressId}
              browserConfig={midtrans}
              customerNote={customerNote}
              shipping={
                selectedShipping
                  ? {
                      courier: selectedShipping.courier,
                      service: selectedShipping.service,
                    }
                  : undefined
              }
              source={source}
              onPreparingChange={setOrderPreparing}
              onOrderPrepared={(preparedOrder) => {
                setCustomerNote(preparedOrder.customerNote ?? "")
                setOrderPreparing(false)
                setOrderPrepared(true)

                const params = new URLSearchParams(window.location.search)
                params.set("order", preparedOrder.orderId)
                window.history.replaceState(
                  null,
                  "",
                  `${window.location.pathname}?${params.toString()}${window.location.hash}`
                )
              }}
              onOrderCreated={async () => {
                if (source.kind !== "cart") return { kind: "success" }

                const result = await clearCart({ errorPresentation: "caller" })

                return result.kind === "success"
                  ? result
                  : {
                      kind: "error" as const,
                      message: ORDER_CREATED_CLEANUP_ERROR_MESSAGE,
                    }
              }}
            />
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}

export { CheckoutForm }
