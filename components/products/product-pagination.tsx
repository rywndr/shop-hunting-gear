"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { PAGE_QUERY } from "@/lib/site/config"
import { formatNumber } from "@/utils/format/intl"

function ProductPagination({
  page,
  pageSize,
  total,
}: {
  readonly page: number
  readonly pageSize: number
  readonly total: number
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  function hrefFor(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())

    if (nextPage > 1) params.set(PAGE_QUERY, String(nextPage))
    else params.delete(PAGE_QUERY)

    const query = params.toString()
    return `${pathname}${query ? `?${query}` : ""}#produk`
  }

  function step(nextPage: number, label: string) {
    if (nextPage < 1 || nextPage > pageCount) {
      return (
        <Button variant="outline" size="sm" disabled>
          {label}
        </Button>
      )
    }

    return (
      <Button
        variant="outline"
        size="sm"
        render={<Link href={hrefFor(nextPage)} />}
      >
        {label}
      </Button>
    )
  }

  return (
    <nav
      aria-label="Navigasi halaman produk"
      className="flex items-center justify-between gap-3 border-t border-border pt-4"
    >
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatNumber((page - 1) * pageSize + 1)}-
        {formatNumber(Math.min(page * pageSize, total))} dari{" "}
        {formatNumber(total)}
      </span>
      <div className="flex gap-1">
        {step(page - 1, "Sebelumnya")}
        {step(page + 1, "Berikutnya")}
      </div>
    </nav>
  )
}

export { ProductPagination }
