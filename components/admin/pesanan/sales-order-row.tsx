"use client"

import { TABLE_EDGE } from "@/components/admin/admin-card"
import { OrderQueueBadge } from "@/components/admin/pesanan/order-queue-badge"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { salesOrderQueue, type SalesOrder } from "@/lib/admin/orders"
import { orderTotal, type Order } from "@/lib/orders/config"
import { cn } from "@/lib/utils"
import { formatNumber, formatRupiah } from "@/utils/format/intl"

function OrderItemList({
  order,
  className,
}: {
  order: Order
  className?: string
}) {
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {order.items.map((item) => (
        <li key={`${item.name} ${item.variant}`} className="flex gap-2">
          <ProductThumbnail
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
      ))}
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

function SalesOrderRow({ salesOrder }: { salesOrder: SalesOrder }) {
  const { buyer, order } = salesOrder
  const queue = salesOrderQueue(salesOrder)

  return (
    <TableRow>
      <TableCell
        className={cn(TABLE_EDGE, "max-w-72 align-top whitespace-normal")}
      >
        <span className="block font-mono text-xs text-muted-foreground">
          {order.id}
        </span>

        <OrderItemList order={order} className="mt-2" />

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
        <Button
          variant="outline"
          size="sm"
          aria-label={`Rincian pesanan ${order.id}`}
        >
          Rincian
        </Button>
      </TableCell>
    </TableRow>
  )
}

export { SalesOrderRow }
