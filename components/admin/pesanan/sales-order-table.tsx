"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { ShoppingBagIcon } from "@phosphor-icons/react"

import { AdminCard, TABLE_EDGE } from "@/components/admin/admin-card"
import { OrderQueueToggle } from "@/components/admin/pesanan/order-queue-toggle"
import { SalesOrderRow } from "@/components/admin/pesanan/sales-order-row"
import { SearchField } from "@/components/admin/search-field"
import { TablePagination } from "@/components/admin/table-pagination"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { usePagination } from "@/hooks/use-pagination"
import {
  orderFilterFromTab,
  orderQueueCounts,
  orderTab,
  querySalesOrders,
  type SalesOrder,
} from "@/lib/admin/orders"
import { cn } from "@/lib/utils"

const DEFAULT_PAGE_SIZE = 10

const COLUMNS = [
  { label: "Pesanan", className: TABLE_EDGE },
  { label: "Pembeli", className: cn(TABLE_EDGE, "hidden lg:table-cell") },
  { label: "Status", className: cn(TABLE_EDGE, "hidden lg:table-cell") },
  { label: "Jasa Kirim", className: cn(TABLE_EDGE, "hidden lg:table-cell") },
  { label: "Total", className: cn(TABLE_EDGE, "text-right") },
  { label: "Aksi", className: cn(TABLE_EDGE, "text-right") },
] as const satisfies readonly { label: string; className: string }[]

function SalesOrderTable({ orders }: { orders: readonly SalesOrder[] }) {
  const searchParams = useSearchParams()
  const queue = orderFilterFromTab(searchParams.get("tab"))
  const [search, setSearch] = useState("")

  const matched = querySalesOrders(orders, { queue, search })
  const pagination = usePagination({
    items: matched,
    pageSize: DEFAULT_PAGE_SIZE,
  })

  return (
    <AdminCard
      contentClassName="px-0"
      footer={
        pagination.total > 0 ? (
          <TablePagination
            pagination={pagination}
            label="Navigasi halaman pesanan"
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 px-(--card-spacing) pb-4">
        <OrderQueueToggle
          queue={queue}
          counts={orderQueueCounts(orders)}
          onQueueChange={(next) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set("tab", orderTab(next))
            window.history.pushState(null, "", `?${params.toString()}`)
            pagination.setPage(1)
          }}
        />

        <SearchField
          label="Cari pesanan"
          value={search}
          onValueChange={(next) => {
            setSearch(next)
            pagination.setPage(1)
          }}
          className="sm:w-72"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column) => (
              <TableHead key={column.label} className={column.className}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {pagination.items.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMNS.length} className="whitespace-normal">
                <Empty className="p-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ShoppingBagIcon aria-hidden />
                    </EmptyMedia>
                    <EmptyTitle>Tidak ada pesanan</EmptyTitle>
                    <EmptyDescription>
                      Tidak ada pesanan yang cocok dengan status dan pencarian
                      yang dipilih.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </TableCell>
            </TableRow>
          ) : (
            pagination.items.map((salesOrder) => (
              <SalesOrderRow
                key={salesOrder.order.id}
                salesOrder={salesOrder}
              />
            ))
          )}
        </TableBody>
      </Table>
    </AdminCard>
  )
}

export { SalesOrderTable }
