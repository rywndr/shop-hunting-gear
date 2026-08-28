import { ImageIcon, ReceiptIcon } from "@phosphor-icons/react/ssr"

import { FLAT_CARD } from "@/components/account/account-card"
import { OrderStatusBadge } from "@/components/orders/order-status-badge"
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
import { cn } from "@/lib/utils"

// Placeholder
function ItemThumbnail() {
  return (
    <div
      aria-hidden
      className="flex size-16 shrink-0 items-center justify-center bg-muted text-muted-foreground sm:size-18"
    >
      <ImageIcon className="size-6" />
    </div>
  )
}

function OrderItemRow({ item }: { item: OrderItem }) {
  return (
    <li className="flex gap-3">
      <ItemThumbnail />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium">{item.name}</p>
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

function OrderCard({ order }: { order: Order }) {
  const { primaryAction, secondaryAction } = ORDER_STATUSES[order.status]

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

        <div className="ms-auto flex flex-wrap gap-2">
          {secondaryAction && (
            <Button type="button" variant="outline" className="h-10">
              {secondaryAction}
            </Button>
          )}
          {primaryAction && (
            <Button type="button" className="h-10">
              {primaryAction}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}

export { OrderCard }
