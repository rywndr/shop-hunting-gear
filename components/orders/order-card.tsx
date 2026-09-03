import Link from "next/link"
import { ReceiptIcon } from "@phosphor-icons/react/ssr"

import { FLAT_CARD } from "@/components/account/account-card"
import { ShipmentTrackingDialog } from "@/components/orders/shipment-tracking-dialog"
import { CancelOrderButton } from "@/components/orders/cancel-order-button"
import { ConfirmOrderReceivedDialog } from "@/components/orders/confirm-order-received-dialog"
import { OrderPaymentButton } from "@/components/orders/order-payment-button"
import { OrderStatusBadge } from "@/components/orders/order-status-badge"
import { ReturnOrderDialog } from "@/components/orders/return-order-dialog"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { formatRupiah, formatShortDate } from "@/utils/format/intl"
import {
  ORDER_STATUSES,
  orderItemCount,
  orderTotal,
  type Order,
  type OrderItem,
} from "@/lib/orders/config"
import type { MidtransBrowserConfig } from "@/lib/payments/midtrans/config"
import { productHref } from "@/lib/products/config"
import { canTrackSavedShipment } from "@/lib/shipping/tracking"
import { storefrontProductCardBySlug } from "@/lib/products/service"
import { cn } from "@/lib/utils"

async function OrderItemRow({ item }: { item: OrderItem }) {
  const product = await storefrontProductCardBySlug(item.productSlug)

  return (
    <li className="flex gap-3">
      {product ? (
        <Link
          href={productHref(product)}
          aria-label={`Lihat ${item.name}`}
          className="shrink-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <ProductThumbnail
            src={product.images[0].thumbnailUrl ?? product.images[0].url}
            label={`Gambar ${item.name}`}
            className="size-16 sm:size-18"
          />
        </Link>
      ) : (
        <ProductThumbnail
          label={`Gambar ${item.name}`}
          className="size-16 shrink-0 sm:size-18"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {product ? (
          <Link
            href={productHref(product)}
            className="text-sm font-medium underline-offset-4 hover:text-primary hover:underline"
          >
            {item.name}
          </Link>
        ) : (
          <p className="text-sm font-medium">{item.name}</p>
        )}
        <p className="text-xs text-muted-foreground">{item.variant}</p>
        <p className="mt-auto text-xs text-muted-foreground">
          {item.quantity} x {formatRupiah(item.price)}
        </p>
      </div>

      <p className="text-sm font-medium tabular-nums">
        {formatRupiah(item.price * item.quantity)}
      </p>
    </li>
  )
}

function OrderCard({
  order,
  midtrans,
}: {
  order: Order
  midtrans: MidtransBrowserConfig
}) {
  const { primaryAction, returnAction, secondaryAction } =
    ORDER_STATUSES[order.status]
  const awaitsManualPayment =
    order.status === "unpaid" && order.sourceKind === "manual"
  const trackableShipment = canTrackSavedShipment({
    fulfillmentStatus: order.fulfillmentStatus,
    tracking: order.tracking,
    shippingCourier: order.shippingCourier,
  })

  return (
    <Card size="sm" className={cn(FLAT_CARD, "gap-0 py-0")}>
      <CardHeader className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-3">
        <ReceiptIcon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="font-mono text-xs font-medium">{order.id}</span>
        <span className="text-xs text-muted-foreground">
          {formatShortDate(order.placedAt)}
        </span>
        <OrderStatusBadge status={order.status} className="ms-auto" />
      </CardHeader>

      <CardContent className="py-4">
        <ul className="flex flex-col gap-4">
          {order.items.map((item) => (
            <OrderItemRow key={item.name} item={item} />
          ))}
        </ul>

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <dt>Pengiriman</dt>
          <dd className="text-right tabular-nums">
            {order.courier} &middot; {formatRupiah(order.shipping)}
          </dd>

          {order.tracking && (
            <>
              <dt>No. Resi</dt>
              <dd className="text-right font-mono text-foreground">
                {order.tracking}
              </dd>
            </>
          )}
        </dl>
      </CardContent>

      <CardFooter className="flex-wrap items-center gap-3 border-t py-3">
        <p className="text-sm text-muted-foreground">
          {orderItemCount(order)} barang &middot;{" "}
          <span className="font-heading font-bold text-foreground tabular-nums">
            {formatRupiah(orderTotal(order))}
          </span>
        </p>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          {awaitsManualPayment && (
            <p className="text-xs text-muted-foreground">
              Pesanan dibuat oleh admin. Selesaikan pembayaran di toko, lalu
              admin menandai pesanan ini sudah dibayar.
            </p>
          )}
          {order.status === "unpaid" ? (
            <CancelOrderButton orderId={order.id} />
          ) : order.status === "shipped" ? (
            secondaryAction && (
              <ConfirmOrderReceivedDialog
                orderId={order.id}
                triggerLabel={secondaryAction}
              />
            )
          ) : (
            secondaryAction && (
              <Button type="button" variant="outline" className="h-10">
                {secondaryAction}
              </Button>
            )
          )}
          {returnAction && (
            <ReturnOrderDialog order={order} triggerLabel={returnAction} />
          )}
          {order.status === "unpaid" && order.paymentToken ? (
            <OrderPaymentButton
              browserConfig={midtrans}
              orderId={order.id}
              token={order.paymentToken}
            />
          ) : (
            !awaitsManualPayment && (
              <>
                {trackableShipment && (
                  <ShipmentTrackingDialog
                    orderId={order.id}
                    audience="customer"
                  />
                )}
                {primaryAction && order.status !== "shipped" && (
                  <Button type="button" className="h-10">
                    {primaryAction}
                  </Button>
                )}
              </>
            )
          )}
        </div>
      </CardFooter>
    </Card>
  )
}

export { OrderCard }
