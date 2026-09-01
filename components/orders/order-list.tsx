import Link from "next/link"
import { PackageIcon } from "@phosphor-icons/react/ssr"

import { FLAT_CARD } from "@/components/account/account-card"
import { OrderPagination } from "@/components/orders/order-pagination"
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
import type { MidtransBrowserConfig } from "@/lib/payments/midtrans/config"
import { cn } from "@/lib/utils"

function OrderList({
  orders,
  emptyMessage,
  midtrans,
  page,
  pageSize,
  total,
}: {
  readonly orders: readonly Order[]
  readonly emptyMessage: string
  readonly midtrans: MidtransBrowserConfig
  readonly page: number
  readonly pageSize: number
  readonly total: number
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
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-4" aria-label="Daftar riwayat pesanan">
        {orders.map((order) => (
          <li key={order.id}>
            <OrderCard order={order} midtrans={midtrans} />
          </li>
        ))}
      </ul>
      {total > pageSize && (
        <OrderPagination page={page} pageSize={pageSize} total={total} />
      )}
    </div>
  )
}

export { OrderList }
