"use client"

import * as React from "react"

export type PaginationState = {
  readonly page: number
  readonly pageCount: number
  readonly pageSize: number
  readonly total: number
  readonly from: number
  readonly to: number
  readonly setPage: (page: number) => void
  readonly setPageSize: (pageSize: number) => void
}

export type Pagination<T> = PaginationState & {
  readonly items: readonly T[]
}

export function usePagination<T>({
  items,
  pageSize: initialPageSize,
  controlledPage,
  controlledPageSize,
  onPageChange,
  onPageSizeChange,
}: {
  items: readonly T[]
  pageSize: number
  controlledPage?: number
  controlledPageSize?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}): Pagination<T> {
  const [requestedPageSize, setRequestedPageSize] =
    React.useState(initialPageSize)
  const [requestedPage, setRequestedPage] = React.useState(1)

  const pageSize = Math.max(1, controlledPageSize ?? requestedPageSize)
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(controlledPage ?? requestedPage, 1), pageCount)
  const start = (page - 1) * pageSize

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageCount,
    pageSize,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
    setPage: (next) => {
      setRequestedPage(next)
      onPageChange?.(next)
    },
    setPageSize: (next) => {
      setRequestedPageSize(Math.max(1, next))
      setRequestedPage(1)
      onPageSizeChange?.(Math.max(1, next))
    },
  }
}
