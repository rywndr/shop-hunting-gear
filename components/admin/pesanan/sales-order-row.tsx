"use client"

import Link from "next/link"
import { PrinterIcon } from "@phosphor-icons/react"

import { TABLE_EDGE } from "@/components/admin/admin-card"
import { CopyIdButton } from "@/components/admin/copy-id-button"
import { MarkOrderCompletedDialog } from "@/components/admin/pesanan/mark-order-completed-dialog"
import { MarkOrderPaidDialog } from "@/components/admin/pesanan/mark-order-paid-dialog"
import { OrderQueueBadge } from "@/components/admin/pesanan/order-queue-badge"
import { ShipOrderDialog } from "@/components/admin/pesanan/ship-order-dialog"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { ShipmentTrackingDialog } from "@/components/orders/shipment-tracking-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import {
  canMarkOrderCompleted,
  canMarkOrderPaid,
  canPrintShippingLabel,
  canShipOrder,
  canTrackOrder,
  salesOrderQueue,
  shippingLabelHref,
  type SalesOrder,
} from "@/lib/admin/orders"
import { orderTotal, type Order } from "@/lib/orders/config"
import type { ProductThumbnailImage } from "@/lib/products/config"
import { cn } from "@/lib/utils"
import { formatNumber, formatRupiah } from "@/utils/format/intl"

function OrderItemList({
  order,
  className,
  productImages,
}: {
  order: Order
  className?: string
  productImages: readonly ProductThumbnailImage[]
}) {
  const imagesBySlug = new Map(
    productImages.map((image) => [image.productSlug, image])
  )

  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {order.items.map((item) => {
        const image = imagesBySlug.get(item.productSlug)

        return (
          <li key={`${item.name} ${item.variant}`} className="flex gap-2">
            <ProductThumbnail
              src={image?.src}
              label={image?.label ?? `Gambar ${item.name}`}
              className="size-10 shrink-0"
              iconClassName="size-4"
            />

            <div className="min-w-0">
              <span className="line-clamp-2 font-medium">{item.name}</span>
              <span className="block text-xs text-muted-foreground">
                {item.variant && <>{item.variant} &middot; </>}x
                {formatNumber(item.quantity)}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function ShippingLabel({ order }: { order: Order }) {
  return (
    <>
      <span className="block">{order.courier}</span>
      {order.tracking !== null && (
        <span className="block font-mono text-xs text-muted-foreground">
          {order.tracking}
        </span>
      )}
    </>
  )
}

function SalesOrderRow({
  salesOrder,
  productImages,
}: {
  salesOrder: SalesOrder
  productImages: readonly ProductThumbnailImage[]
}) {
  const { buyer, order } = salesOrder
  const queue = salesOrderQueue(salesOrder)

  return (
    <TableRow className="group/row">
      <TableCell
        className={cn(TABLE_EDGE, "max-w-72 align-top whitespace-normal")}
      >
        <div className="flex items-center gap-1">
          <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
            {order.id}
          </span>
          <CopyIdButton value={order.id} />
        </div>

        <OrderItemList
          order={order}
          productImages={productImages}
          className="mt-2"
        />

        <div className="mt-2 flex flex-col items-start gap-1 lg:hidden">
          <OrderQueueBadge queue={queue} />
          <span className="text-xs text-muted-foreground">{buyer}</span>
          <span className="text-xs text-muted-foreground">
            <ShippingLabel order={order} />
          </span>
        </div>
      </TableCell>

      <TableCell className={cn(TABLE_EDGE, "hidden align-top lg:table-cell")}>
        {buyer}
      </TableCell>

      <TableCell className={cn(TABLE_EDGE, "hidden align-top lg:table-cell")}>
        <OrderQueueBadge queue={queue} />
      </TableCell>

      <TableCell className={cn(TABLE_EDGE, "hidden align-top lg:table-cell")}>
        <ShippingLabel order={order} />
      </TableCell>

      <TableCell
        className={cn(
          TABLE_EDGE,
          "text-right align-top font-medium tabular-nums"
        )}
      >
        {formatRupiah(orderTotal(order))}
      </TableCell>

      <TableCell className={cn(TABLE_EDGE, "text-right align-top")}>
        <div className="flex flex-col items-end gap-2">
          {canMarkOrderPaid(order) && (
            <MarkOrderPaidDialog orderId={order.id} />
          )}
          {canShipOrder({
            paymentStatus: order.paymentStatus,
            fulfillmentStatus: order.fulfillmentStatus,
            tracking: order.tracking,
            shipping: salesOrder.shipping,
          }) && (
            <ShipOrderDialog
              orderId={order.id}
              buyer={buyer}
              courier={order.courier}
            />
          )}
          {canTrackOrder({
            fulfillmentStatus: order.fulfillmentStatus,
            tracking: order.tracking,
            shipping: salesOrder.shipping,
          }) && <ShipmentTrackingDialog orderId={order.id} audience="admin" />}
          {canPrintShippingLabel(order) && (
            <Link
              href={shippingLabelHref(order.id)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Cetak label pengiriman ${order.id} di tab baru`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <PrinterIcon data-icon="inline-start" />
              Cetak Label
            </Link>
          )}
          {canMarkOrderCompleted(order) && (
            <MarkOrderCompletedDialog orderId={order.id} />
          )}
          <Button
            variant="outline"
            size="sm"
            aria-label={`Rincian pesanan ${order.id}`}
          >
            Rincian
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export { SalesOrderRow }
