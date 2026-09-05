"use client"

import { useRouter } from "next/navigation"
import { ReceiptIcon } from "@phosphor-icons/react"

import { AdminCard, TABLE_EDGE } from "@/components/admin/admin-card"
import { TablePagination } from "@/components/admin/table-pagination"
import { TransactionRow } from "@/components/admin/finance/transaction-row"
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
import type { Transaction } from "@/lib/admin/finance"
import type { ProductThumbnailImage } from "@/lib/products/config"
import { cn } from "@/lib/utils"

const COLUMNS = [
  { label: "Pesanan", className: TABLE_EDGE },
  { label: "Status", className: cn(TABLE_EDGE, "hidden md:table-cell") },
  { label: "Metode", className: cn(TABLE_EDGE, "hidden md:table-cell") },
  { label: "Penghasilan", className: cn(TABLE_EDGE, "text-right") },
] as const satisfies readonly { label: string; className: string }[]

function serverPagination({
  items,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  readonly items: readonly Transaction[]
  readonly page: number
  readonly pageSize: number
  readonly total: number
  readonly onPageChange: (page: number) => void
  readonly onPageSizeChange: (pageSize: number) => void
}): Pagination<Transaction> {
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

function TransactionHistory({
  transactions,
  total,
  page,
  pageSize,
  productImages,
}: {
  readonly transactions: readonly Transaction[]
  readonly productImages: readonly ProductThumbnailImage[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
}) {
  const router = useRouter()
  const pagination = serverPagination({
    items: transactions,
    page,
    pageSize,
    total,
    onPageChange: (nextPage) => {
      const params = new URLSearchParams()
      if (nextPage > 1) params.set("page", String(nextPage))
      if (pageSize !== 10) params.set("size", String(pageSize))
      router.push(`/admin/finance?${params.toString()}`)
    },
    onPageSizeChange: (nextPageSize) => {
      const params = new URLSearchParams()
      if (nextPageSize !== 10) params.set("size", String(nextPageSize))
      router.push(`/admin/finance?${params.toString()}`)
    },
  })

  return (
    <AdminCard
      title="Riwayat Transaksi"
      description="Penghasilan per transaksi. Buka baris untuk melihat rinciannya."
      contentClassName="px-0"
      footer={
        pagination.total > 0 ? (
          <TablePagination
            pagination={pagination}
            label="Navigasi halaman transaksi"
          />
        ) : undefined
      }
    >
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
                      <ReceiptIcon aria-hidden />
                    </EmptyMedia>
                    <EmptyTitle>Belum ada transaksi</EmptyTitle>
                    <EmptyDescription>
                      Transaksi dari pesanan yang sudah dibayar akan muncul di
                      sini.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </TableCell>
            </TableRow>
          ) : (
            pagination.items.map((transaction) => (
              <TransactionRow
                key={transaction.orderId}
                transaction={transaction}
                columnCount={COLUMNS.length}
                productImages={productImages}
              />
            ))
          )}
        </TableBody>
      </Table>
    </AdminCard>
  )
}

export { TransactionHistory }
