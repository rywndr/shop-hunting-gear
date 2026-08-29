"use client"

import { useId, useState } from "react"
import { CaretDownIcon } from "@phosphor-icons/react"

import { TABLE_EDGE } from "@/components/admin/admin-card"
import { FulfillmentBadge } from "@/components/admin/keuangan/fulfillment-badge"
import { TransactionBreakdown } from "@/components/admin/keuangan/transaction-breakdown"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import {
  PAYMENT_METHODS,
  transactionEarnings,
  transactionItemCount,
  type Transaction,
} from "@/lib/admin/finance"
import { cn } from "@/lib/utils"
import {
  formatNumber,
  formatRupiah,
  formatShortDate,
} from "@/utils/format/intl"

function TransactionRow({
  transaction,
  columnCount,
}: {
  transaction: Transaction
  columnCount: number
}) {
  const [open, setOpen] = useState(false)
  const detailId = useId()

  const method = PAYMENT_METHODS[transaction.method]

  return (
    <>
      <TableRow>
        <TableCell
          className={cn(TABLE_EDGE, "max-w-64 align-top whitespace-normal")}
        >
          <span className="block font-mono text-xs text-muted-foreground">
            {transaction.orderId}
          </span>
          <span className="line-clamp-2 font-medium">
            {transaction.items[0].name}
          </span>
          <span className="block text-xs text-muted-foreground">
            {formatShortDate(transaction.settledAt)} &middot;{" "}
            {formatNumber(transactionItemCount(transaction))} barang
          </span>

          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 md:hidden">
            <FulfillmentBadge fulfillment={transaction.fulfillment} />
            <span className="text-xs text-muted-foreground">
              {method.label}
            </span>
          </span>
        </TableCell>

        <TableCell className={cn(TABLE_EDGE, "hidden align-top md:table-cell")}>
          <FulfillmentBadge fulfillment={transaction.fulfillment} />
        </TableCell>

        <TableCell className={cn(TABLE_EDGE, "hidden align-top md:table-cell")}>
          {method.label}
        </TableCell>

        <TableCell className={cn(TABLE_EDGE, "text-right align-top")}>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            aria-controls={open ? detailId : undefined}
            onClick={() => setOpen(!open)}
            className="-mr-2 ml-auto font-medium tabular-nums"
          >
            <span className="sr-only">Rincian penghasilan</span>
            {formatRupiah(transactionEarnings(transaction))}
            <CaretDownIcon
              data-icon="inline-end"
              className={cn(
                "size-3.5 transition-transform",
                open && "rotate-180"
              )}
              aria-hidden
            />
          </Button>
        </TableCell>
      </TableRow>

      {open && (
        <TableRow className="hover:bg-transparent">
          <TableCell
            colSpan={columnCount}
            className={cn(TABLE_EDGE, "bg-muted/40 whitespace-normal")}
          >
            <div id={detailId}>
              <TransactionBreakdown transaction={transaction} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export { TransactionRow }
