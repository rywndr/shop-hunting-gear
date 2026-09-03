"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
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
import type { Pagination } from "@/hooks/use-pagination"
import type {
  OrderQueue,
  OrderQueueFilter,
  SalesOrder,
} from "@/lib/admin/orders"
import { orderTab } from "@/lib/admin/orders"
import type { ProductThumbnailImage } from "@/lib/products/config"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 350

const COLUMNS = [
  { label: "Pesanan", className: TABLE_EDGE },
  { label: "Pembeli", className: cn(TABLE_EDGE, "hidden lg:table-cell") },
  { label: "Status", className: cn(TABLE_EDGE, "hidden lg:table-cell") },
  { label: "Jasa Kirim", className: cn(TABLE_EDGE, "hidden lg:table-cell") },
  { label: "Total", className: cn(TABLE_EDGE, "text-right") },
  { label: "Aksi", className: cn(TABLE_EDGE, "text-right") },
] as const satisfies readonly { label: string; className: string }[]

function serverPagination({
  items,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  readonly items: readonly SalesOrder[]
  readonly page: number
  readonly pageSize: number
  readonly total: number
  readonly onPageChange: (page: number) => void
  readonly onPageSizeChange: (pageSize: number) => void
}): Pagination<SalesOrder> {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(page, 1), pageCount)

  return {
    items,
    page: currentPage,
    pageCount,
    pageSize,
    total,
    from: total === 0 ? 0 : (currentPage - 1) * pageSize + 1,
    to: Math.min(currentPage * pageSize, total),
    setPage: onPageChange,
    setPageSize: onPageSizeChange,
  }
}

function DebouncedOrderSearch({
  initialValue,
  onValueChange,
}: {
  readonly initialValue: string
  readonly onValueChange: (value: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  const timeout = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timeout.current !== null) window.clearTimeout(timeout.current)
    },
    []
  )

  return (
    <SearchField
      label="Cari pesanan"
      value={value}
      onValueChange={(next) => {
        setValue(next)
        if (timeout.current !== null) window.clearTimeout(timeout.current)
        timeout.current = window.setTimeout(
          () => onValueChange(next),
          SEARCH_DEBOUNCE_MS
        )
      }}
      className="sm:w-72"
    />
  )
}

function SalesOrderTable({
  orders,
  counts,
  total,
  page,
  pageSize,
  queue,
  search,
  productImages,
}: {
  readonly orders: readonly SalesOrder[]
  readonly productImages: readonly ProductThumbnailImage[]
  readonly counts: Readonly<Record<OrderQueue, number>>
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly queue: OrderQueueFilter
  readonly search: string
}) {
  const router = useRouter()

  function navigate({
    nextPage,
    nextPageSize = pageSize,
    nextQueue = queue,
    nextSearch = search,
  }: {
    readonly nextPage: number
    readonly nextPageSize?: number
    readonly nextQueue?: OrderQueueFilter
    readonly nextSearch?: string
  }) {
    const params = new URLSearchParams()
    params.set("tab", orderTab(nextQueue))
    if (nextSearch.trim()) params.set("q", nextSearch.trim())
    if (nextPage > 1) params.set("page", String(nextPage))
    if (nextPageSize !== 10) params.set("size", String(nextPageSize))
    router.push(`/admin/pesanan?${params.toString()}`)
  }

  const pagination = serverPagination({
    items: orders,
    page,
    pageSize,
    total,
    onPageChange: (nextPage) => navigate({ nextPage }),
    onPageSizeChange: (nextPageSize) => navigate({ nextPage: 1, nextPageSize }),
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
          counts={counts}
          onQueueChange={(next) => navigate({ nextPage: 1, nextQueue: next })}
        />

        <DebouncedOrderSearch
          initialValue={search}
          onValueChange={(next) => navigate({ nextPage: 1, nextSearch: next })}
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
                productImages={productImages}
              />
            ))
          )}
        </TableBody>
      </Table>
    </AdminCard>
  )
}

export { SalesOrderTable }
