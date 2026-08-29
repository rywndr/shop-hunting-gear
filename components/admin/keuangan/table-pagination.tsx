"use client"

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PaginationState } from "@/hooks/use-pagination"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/utils/format/intl"

export const PAGE_SIZES = [10, 25, 50] as const satisfies readonly number[]

const NEIGHBOURS = 1

type PageSlot =
  { readonly kind: "page"; readonly page: number } | { readonly kind: "gap" }

function pageSlots({
  page,
  pageCount,
}: {
  page: number
  pageCount: number
}): readonly PageSlot[] {
  const pages = Array.from(
    { length: pageCount },
    (_, index) => index + 1
  ).filter(
    (candidate) =>
      candidate === 1 ||
      candidate === pageCount ||
      Math.abs(candidate - page) <= NEIGHBOURS
  )

  return pages.flatMap((candidate, index) => {
    const previous = pages[index - 1]
    const slot = { kind: "page", page: candidate } as const

    return previous !== undefined && candidate - previous > 1
      ? [{ kind: "gap" } as const, slot]
      : [slot]
  })
}

function pageSizeLabel(pageSize: number) {
  return `${formatNumber(pageSize)} / halaman`
}

function TablePagination({
  pagination,
  label,
  pageSizes = PAGE_SIZES,
  className,
}: {
  pagination: PaginationState
  label: string
  pageSizes?: readonly number[]
  className?: string
}) {
  const { page, pageCount, pageSize, total, from, to, setPage, setPageSize } =
    pagination

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3",
        className
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Select
          value={pageSize}
          onValueChange={(next) => {
            // Base UI allows clearing the value, a page size has to stay set.
            if (next !== null) {
              setPageSize(next)
            }
          }}
        >
          <SelectTrigger size="sm" aria-label="Jumlah baris per halaman">
            <SelectValue>{() => pageSizeLabel(pageSize)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {pageSizes.map((size) => (
              <SelectItem key={size} value={size}>
                {pageSizeLabel(size)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="tabular-nums">
          {formatNumber(from)}-{formatNumber(to)} dari {formatNumber(total)}
        </span>
      </div>

      <nav aria-label={label} className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Halaman sebelumnya"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          <CaretLeftIcon aria-hidden />
        </Button>

        {pageSlots({ page, pageCount }).map((slot, index) =>
          slot.kind === "gap" ? (
            <span
              key={`gap-${index}`}
              aria-hidden
              className="px-1 text-xs text-muted-foreground"
            >
              &hellip;
            </span>
          ) : (
            <Button
              key={slot.page}
              variant={slot.page === page ? "default" : "ghost"}
              size="icon-sm"
              aria-label={`Halaman ${formatNumber(slot.page)}`}
              aria-current={slot.page === page ? "page" : undefined}
              onClick={() => setPage(slot.page)}
              className="text-xs tabular-nums"
            >
              {formatNumber(slot.page)}
            </Button>
          )
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Halaman berikutnya"
          disabled={page === pageCount}
          onClick={() => setPage(page + 1)}
        >
          <CaretRightIcon aria-hidden />
        </Button>
      </nav>
    </div>
  )
}

export { TablePagination }
