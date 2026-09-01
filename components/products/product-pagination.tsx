"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  function goTo(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextPage > 1) params.set("page", String(nextPage))
    else params.delete("page")
    router.push(`${pathname}?${params.toString()}#produk`)
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
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => goTo(page - 1)}
        >
          Sebelumnya
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page === pageCount}
          onClick={() => goTo(page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </nav>
  )
}

export { ProductPagination }
