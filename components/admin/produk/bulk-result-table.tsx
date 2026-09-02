"use client"

import { useState } from "react"

import { TABLE_EDGE } from "@/components/admin/admin-card"
import { FilterToggle } from "@/components/admin/filter-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ALL_FILTER } from "@/lib/admin/config"
import {
  bulkResultFilterCount,
  bulkResultFilterLabel,
  isBulkResultFilter,
  BULK_RESULT_FILTER_ORDER,
  BULK_ROW_STATUSES,
  type BulkImportSummary,
  type BulkResultFilter,
} from "@/lib/admin/product-bulk/types"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/utils/format/intl"

const PAGE_SIZE = 50

function BulkResultTable({ summary }: { summary: BulkImportSummary }) {
  const [filter, setFilter] = useState<BulkResultFilter>(ALL_FILTER)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const rows =
    filter === ALL_FILTER
      ? summary.rows
      : summary.rows.filter(({ status }) => status === filter)
  const page = rows.slice(0, visible)

  return (
    <div className="flex flex-col gap-3">
      <FilterToggle
        label="Filter hasil import"
        value={filter}
        isValue={isBulkResultFilter}
        onValueChange={(next) => {
          setFilter(next)
          setVisible(PAGE_SIZE)
        }}
        options={BULK_RESULT_FILTER_ORDER.map((value) => ({
          value,
          label: bulkResultFilterLabel(value),
          count: bulkResultFilterCount({ filter: value, summary }),
        }))}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={cn(TABLE_EDGE, "w-16")}>Baris</TableHead>
            <TableHead>Produk / ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className={TABLE_EDGE}>Keterangan</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {page.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={4}
                className={cn(TABLE_EDGE, "text-muted-foreground")}
              >
                Tidak ada baris pada filter ini.
              </TableCell>
            </TableRow>
          ) : (
            page.map((row) => (
              <TableRow key={row.row} className="hover:bg-transparent">
                <TableCell className={cn(TABLE_EDGE, "tabular-nums")}>
                  {row.row}
                </TableCell>
                <TableCell>
                  <span className="block font-medium">
                    {row.productName ?? "-"}
                  </span>
                  {row.productId && (
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {row.productId}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={BULK_ROW_STATUSES[row.status].badge}>
                    {BULK_ROW_STATUSES[row.status].label}
                  </Badge>
                </TableCell>
                <TableCell
                  className={cn(TABLE_EDGE, "min-w-64 text-muted-foreground")}
                >
                  {row.message ?? "-"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {rows.length > page.length && (
        <div className="px-(--card-spacing)">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisible((current) => current + PAGE_SIZE)}
          >
            Tampilkan{" "}
            {formatNumber(Math.min(PAGE_SIZE, rows.length - page.length))} baris
            lagi
          </Button>
        </div>
      )}
    </div>
  )
}

export { BulkResultTable }
