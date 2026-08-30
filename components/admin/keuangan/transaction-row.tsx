"use client"

import { useId, useState } from "react"
import { CaretDownIcon, CheckIcon, CopyIcon } from "@phosphor-icons/react"

import { TABLE_EDGE } from "@/components/admin/admin-card"
import { FulfillmentBadge } from "@/components/admin/keuangan/fulfillment-badge"
import { TransactionBreakdown } from "@/components/admin/keuangan/transaction-breakdown"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import {
  PAYMENT_METHODS,
  transactionEarnings,
  type Transaction,
} from "@/lib/admin/finance"
import { cn } from "@/lib/utils"
import {
  formatNumber,
  formatRupiah,
  formatShortDate,
} from "@/utils/format/intl"

function TransactionItemList({
  transaction,
  className,
}: {
  transaction: Transaction
  className?: string
}) {
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {transaction.items.map((item) => (
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

function TransactionRow({
  transaction,
  columnCount,
}: {
  transaction: Transaction
  columnCount: number
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const detailId = useId()

  const method = PAYMENT_METHODS[transaction.method]

  async function copyOrderId() {
    try {
      await navigator.clipboard.writeText(transaction.orderId)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <TableRow className="group/row">
        <TableCell
          className={cn(TABLE_EDGE, "max-w-72 align-top whitespace-normal")}
        >
          <div className="flex items-center gap-1">
            <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
              {transaction.orderId}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={copyOrderId}
              aria-label={
                copied
                  ? `${transaction.orderId} tersalin`
                  : `Salin ${transaction.orderId}`
              }
              className="opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100"
            >
              {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
            </Button>
          </div>
          <span className="block text-xs text-muted-foreground">
            {formatShortDate(transaction.settledAt)}
          </span>

          <TransactionItemList transaction={transaction} className="mt-2" />

          <div className="mt-2 flex flex-col items-start gap-1 md:hidden">
            <FulfillmentBadge fulfillment={transaction.fulfillment} />
            <span className="text-xs text-muted-foreground">
              {method.label}
            </span>
          </div>
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
            onClick={() => setOpen((isOpen) => !isOpen)}
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
