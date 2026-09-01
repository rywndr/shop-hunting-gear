import type { Metadata } from "next"
import Link from "next/link"

import { AccountShell } from "@/components/account/account-shell"
import { CheckoutForm } from "@/components/checkout/checkout-form"
import { Button } from "@/components/ui/button"
import { addressesForUser } from "@/lib/account/service"
import { getCurrentSession } from "@/lib/auth/session"
import type { CheckoutSource } from "@/lib/checkout/config"
import { checkoutProductQuerySchema } from "@/lib/checkout/schema"
import { checkoutItemsForUser } from "@/lib/checkout/service"
import { midtransBrowserConfig } from "@/lib/payments/midtrans/config"

export const metadata: Metadata = {
  title: "Checkout",
  description: "Pilih alamat dan layanan pengiriman pesanan Anda.",
}

type CheckoutSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

function queryValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: CheckoutSearchParams
}) {
  const session = await getCurrentSession()

  if (!session) return null

  const query = await searchParams
  const hasProduct = query.produk !== undefined
  const parsedProduct = hasProduct
    ? checkoutProductQuerySchema.safeParse({
        produk: queryValue(query.produk),
        jumlah: queryValue(query.jumlah),
        pilihan: queryValue(query.pilihan),
      })
    : undefined
  const source: CheckoutSource =
    parsedProduct?.success === true
      ? {
          kind: "product",
          productSlug: parsedProduct.data.produk,
          quantity: parsedProduct.data.jumlah,
          variants: parsedProduct.data.pilihan,
        }
      : { kind: "cart" }
  const [addresses, items] = await Promise.all([
    addressesForUser(session.user.id),
    checkoutItemsForUser({ userId: session.user.id, source }),
  ])

  if ((hasProduct && !parsedProduct?.success) || items.length === 0) {
    return (
      <AccountShell
        title="Checkout"
        description="Pesanan tidak dapat dilanjutkan."
      >
        <div className="flex flex-col items-start gap-4 border border-border p-5">
          <p className="text-sm text-muted-foreground">
            {hasProduct
              ? "Pilihan produk tidak valid atau stoknya sudah habis."
              : "Keranjang kamu masih kosong."}
          </p>
          <Button render={<Link href="/" />} variant="outline">
            Kembali Belanja
          </Button>
        </div>
      </AccountShell>
    )
  }

  return (
    <AccountShell
      title="Checkout"
      description="Pilih alamat dan layanan pengiriman sebelum melanjutkan ke pembayaran."
      className="max-w-7xl"
    >
      <CheckoutForm
        addresses={addresses}
        items={items}
        midtrans={midtransBrowserConfig()}
        source={source}
      />
    </AccountShell>
  )
}
