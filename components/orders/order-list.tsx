import Link from "next/link"
import { PackageIcon } from "@phosphor-icons/react/ssr"

import { FLAT_CARD } from "@/components/account/account-card"
import { OrderCard } from "@/components/orders/order-card"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { Order } from "@/lib/orders/config"
import { cn } from "@/lib/utils"

function OrderList({
  orders,
  emptyMessage,
}: {
  orders: readonly Order[]
  emptyMessage: string
}) {
  if (orders.length === 0) {
    return (
      <Empty className={cn(FLAT_CARD, "border-dashed py-12")}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Belum ada pesanan</EmptyTitle>
          <EmptyDescription>{emptyMessage}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            render={<Link href="/" />}
            nativeButton={false}
            className="h-10"
          >
            Mulai Belanja
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <ul className="flex flex-col gap-4">
      {orders.map((order) => (
        <li key={order.id}>
          <OrderCard order={order} />
        </li>
      ))}
    </ul>
  )
}

export { OrderList }
