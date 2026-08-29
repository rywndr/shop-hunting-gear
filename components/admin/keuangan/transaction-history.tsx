"use client"

import { useState } from "react"
import { ReceiptIcon } from "@phosphor-icons/react"

import { AdminCard, TABLE_EDGE } from "@/components/admin/admin-card"
import { TablePagination } from "@/components/admin/keuangan/table-pagination"
import { TransactionRow } from "@/components/admin/keuangan/transaction-row"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  isPayoutState,
  PAYOUT_STATES,
  PAYOUT_STATE_ORDER,
  transactionsByPayout,
  type PayoutState,
  type Transaction,
} from "@/lib/admin/finance"
import { usePagination } from "@/hooks/use-pagination"
import { cn } from "@/lib/utils"

const DEFAULT_PAGE_SIZE = 10

const COLUMNS = [
  { label: "Pesanan", className: TABLE_EDGE },
  { label: "Status", className: cn(TABLE_EDGE, "hidden md:table-cell") },
  { label: "Metode", className: cn(TABLE_EDGE, "hidden md:table-cell") },
  { label: "Penghasilan", className: cn(TABLE_EDGE, "text-right") },
] as const satisfies readonly { label: string; className: string }[]

function PayoutToggle({
  payout,
  onPayoutChange,
}: {
  payout: PayoutState
  onPayoutChange: (payout: PayoutState) => void
}) {
  return (
    <ToggleGroup
      aria-label="Status pencairan dana"
      variant="outline"
      spacing={0}
      value={[payout]}
      onValueChange={(next) => {
        const [selected] = next

        // Base UI allows unpressing the active item, the table needs a filter.
        if (selected && isPayoutState(selected)) {
          onPayoutChange(selected)
        }
      }}
    >
      {PAYOUT_STATE_ORDER.map((state) => (
        <ToggleGroupItem key={state} value={state} size="sm">
          {PAYOUT_STATES[state].shortLabel}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function TransactionHistory({
  transactions,
}: {
  transactions: readonly Transaction[]
}) {
  const [payout, setPayout] = useState<PayoutState>("pending")
  const pagination = usePagination({
    items: transactionsByPayout(transactions, payout),
    pageSize: DEFAULT_PAGE_SIZE,
  })

  return (
    <AdminCard
      title="Riwayat Transaksi"
      description="Penghasilan per transaksi. Buka baris untuk melihat rinciannya."
      contentClassName="px-0"
      action={
        <PayoutToggle
          payout={payout}
          onPayoutChange={(next) => {
            setPayout(next)
            pagination.setPage(1)
          }}
        />
      }
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
                      Transaksi dengan{" "}
                      {PAYOUT_STATES[payout].label.toLowerCase()} akan muncul di
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
              />
            ))
          )}
        </TableBody>
      </Table>
    </AdminCard>
  )
}

export { TransactionHistory }
