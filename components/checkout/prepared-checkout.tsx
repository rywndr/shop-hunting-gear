import { CheckCircleIcon, MapPinIcon, PackageIcon } from "@phosphor-icons/react/ssr"

import { FLAT_CARD } from "@/components/account/account-card"
import { OrderPaymentButton } from "@/components/orders/order-payment-button"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PreparedCheckoutOrder } from "@/lib/orders/service"
import type { MidtransBrowserConfig } from "@/lib/payments/midtrans/config"
import { storefrontProductCardBySlug } from "@/lib/products/service"
import { formatNumber, formatRupiah } from "@/utils/format/intl"

function addressLine(address: PreparedCheckoutOrder["address"]) {
  return [
    address.street,
    address.subdistrict,
    address.district,
    address.city,
    address.province,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ")
}

async function PreparedCheckout({
  order,
  midtrans,
}: {
  readonly order: PreparedCheckoutOrder
  readonly midtrans: MidtransBrowserConfig
}) {
  const productImages = await Promise.all(
    order.items.map(async (item) => {
      const product = await storefrontProductCardBySlug(item.productSlug)
      return product
        ? (product.images[0].thumbnailUrl ?? product.images[0].url)
        : undefined
    })
  )

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-5">
        <div
          role="status"
          className="flex gap-3 border border-primary/30 bg-primary/5 p-4 text-sm"
        >
          <CheckCircleIcon
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-primary"
          />
          <div>
            <p className="font-medium">Pesanan sudah dibuat</p>
            <p className="mt-1 text-muted-foreground">
              Alamat, pengiriman, dan catatan pesanan ini tidak dapat diubah.
            </p>
          </div>
        </div>

        <section aria-labelledby="prepared-alamat-title">
          <Card className={FLAT_CARD}>
            <CardHeader>
              <CardTitle
                id="prepared-alamat-title"
                className="flex items-center gap-2 uppercase"
              >
                <MapPinIcon aria-hidden />
                Alamat Pengiriman
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-medium">{order.address.recipient}</p>
              <p className="mt-1 text-muted-foreground">
                {order.address.phone}
              </p>
              <p className="mt-1 break-words text-muted-foreground">
                {addressLine(order.address)}
              </p>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="prepared-pengiriman-title">
          <Card className={FLAT_CARD}>
            <CardHeader>
              <CardTitle id="prepared-pengiriman-title" className="uppercase">
                Pilihan Pengiriman
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-between gap-4 text-sm">
              <div>
                <p className="font-medium">
                  {order.shipping.courierName} {order.shipping.service}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Kode kurir: {order.shipping.courier.toUpperCase()}
                </p>
              </div>
              <p className="shrink-0 font-medium tabular-nums">
                {formatRupiah(order.shipping.cost)}
              </p>
            </CardContent>
          </Card>
        </section>

        {order.customerNote !== null && (
          <section aria-labelledby="prepared-catatan-title">
            <Card className={FLAT_CARD}>
              <CardHeader>
                <CardTitle id="prepared-catatan-title" className="uppercase">
                  Catatan untuk Penjual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="break-words whitespace-pre-wrap text-sm">
                  {order.customerNote}
                </p>
              </CardContent>
            </Card>
          </section>
        )}
      </div>

      <aside
        aria-labelledby="prepared-ringkasan-title"
        className="lg:sticky lg:top-5"
      >
        <Card className={FLAT_CARD}>
          <CardHeader>
            <CardTitle
              id="prepared-ringkasan-title"
              className="flex items-center gap-2 uppercase"
            >
              <PackageIcon aria-hidden />
              Pesanan
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col gap-4">
              {order.items.map((item, index) => (
                <li
                  key={`${item.productSlug}-${index}`}
                  className="flex gap-3 border-b border-border pb-4"
                >
                  <ProductThumbnail
                    src={productImages[index]}
                    label={`Gambar ${item.name}`}
                    className="size-14 shrink-0"
                  />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="break-words font-medium">{item.name}</p>
                    {item.variant && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.variant}
                      </p>
                    )}
                    <div className="mt-2 flex justify-between gap-2">
                      <span className="text-muted-foreground">
                        {formatNumber(item.quantity)} barang
                      </span>
                      <span className="tabular-nums">
                        {formatRupiah(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Ongkos kirim</dt>
                <dd className="tabular-nums">
                  {formatRupiah(order.shipping.cost)}
                </dd>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border pt-3">
                <dt className="font-medium">Total</dt>
                <dd className="font-heading text-lg font-bold tabular-nums">
                  {formatRupiah(order.grossAmount)}
                </dd>
              </div>
            </dl>

            <OrderPaymentButton
              browserConfig={midtrans}
              orderId={order.id}
              token={order.snapToken}
            />
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}

export { PreparedCheckout }
