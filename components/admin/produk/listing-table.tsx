"use client"

import { useRouter } from "next/navigation"
import { PackageIcon } from "@phosphor-icons/react"

import { AdminCard, TABLE_EDGE } from "@/components/admin/admin-card"
import { ListingRow } from "@/components/admin/produk/listing-row"
import { ListingSelectionBar } from "@/components/admin/produk/listing-selection-bar"
import { ListingStateToggle } from "@/components/admin/produk/listing-state-toggle"
import { ListingToolbar } from "@/components/admin/produk/listing-toolbar"
import { SortableHead } from "@/components/admin/produk/sortable-head"
import { TablePagination } from "@/components/admin/table-pagination"
import { Checkbox } from "@/components/ui/checkbox"
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
import { useSelection } from "@/hooks/use-selection"
import {
  listingSortKey,
  listingTab,
  type Listing,
  type ListingCategoryFilter,
  type ListingSort,
  type ListingSortColumn,
  type ListingStateFilter,
} from "@/lib/admin/catalog"
import { ALL_FILTER } from "@/lib/admin/config"
import { cn } from "@/lib/utils"

const DEFAULT_PAGE_SIZE = 10

type Column =
  | { readonly kind: "select"; readonly className: string }
  | {
      readonly kind: "plain"
      readonly label: string
      readonly className: string
    }
  | {
      readonly kind: "sort"
      readonly column: ListingSortColumn
      readonly className: string
    }

const COLUMNS = [
  { kind: "select", className: cn(TABLE_EDGE, "w-0") },
  { kind: "plain", label: "Produk", className: TABLE_EDGE },
  {
    kind: "sort",
    column: "status",
    className: cn(TABLE_EDGE, "hidden lg:table-cell"),
  },
  {
    kind: "sort",
    column: "price",
    className: cn(TABLE_EDGE, "hidden text-right md:table-cell"),
  },
  { kind: "sort", column: "stock", className: cn(TABLE_EDGE, "text-right") },
  { kind: "plain", label: "Aksi", className: cn(TABLE_EDGE, "text-right") },
] as const satisfies readonly Column[]

function serverPagination({
  items,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  readonly items: readonly Listing[]
  readonly page: number
  readonly pageSize: number
  readonly total: number
  readonly onPageChange: (page: number) => void
  readonly onPageSizeChange: (pageSize: number) => void
}): Pagination<Listing> {
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

function ListingTable({
  listings,
  counts,
  total,
  page,
  pageSize,
  state,
  category,
  sort,
  search,
  now,
}: {
  readonly listings: readonly Listing[]
  readonly counts: Readonly<Record<ListingStateFilter, number>>
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly state: ListingStateFilter
  readonly category: ListingCategoryFilter
  readonly sort: ListingSort | null
  readonly search: string
  readonly now: string
}) {
  const router = useRouter()
  const selection = useSelection({
    ids: listings.map((listing) => listing.id),
  })

  function navigate({
    nextPage,
    nextPageSize = pageSize,
    nextState = state,
    nextCategory = category,
    nextSort = sort,
    nextSearch = search,
  }: {
    readonly nextPage: number
    readonly nextPageSize?: number
    readonly nextState?: ListingStateFilter
    readonly nextCategory?: ListingCategoryFilter
    readonly nextSort?: ListingSort | null
    readonly nextSearch?: string
  }) {
    const params = new URLSearchParams()
    params.set("tab", listingTab(nextState))
    if (nextSearch.trim()) params.set("q", nextSearch.trim())
    if (nextCategory !== ALL_FILTER) params.set("category", nextCategory)
    if (nextSort !== null) params.set("sort", listingSortKey(nextSort))
    if (nextPage > 1) params.set("page", String(nextPage))
    if (nextPageSize !== DEFAULT_PAGE_SIZE)
      params.set("size", String(nextPageSize))
    router.push(`/admin/products?${params.toString()}`)
  }

  const pagination = serverPagination({
    items: listings,
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
            label="Navigasi halaman produk"
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 px-(--card-spacing) pb-4">
        <ListingStateToggle
          state={state}
          counts={counts}
          onStateChange={(next) => {
            selection.clear()
            navigate({ nextPage: 1, nextState: next })
          }}
        />

        <ListingToolbar
          search={search}
          onSearchChange={(next) => navigate({ nextPage: 1, nextSearch: next })}
          category={category}
          onCategoryChange={(next) =>
            navigate({ nextPage: 1, nextCategory: next })
          }
          sort={sort}
          onSortChange={(next) => navigate({ nextPage: 1, nextSort: next })}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column) => {
              switch (column.kind) {
                case "select":
                  return (
                    <TableHead key={column.kind} className={column.className}>
                      <Checkbox
                        aria-label="Pilih semua produk di halaman ini"
                        checked={selection.allSelected}
                        indeterminate={
                          selection.someSelected && !selection.allSelected
                        }
                        disabled={pagination.items.length === 0}
                        onCheckedChange={(next) => selection.toggleAll(next)}
                      />
                    </TableHead>
                  )
                case "sort":
                  return (
                    <SortableHead
                      key={column.column}
                      column={column.column}
                      sort={sort}
                      onSortChange={(next) =>
                        navigate({ nextPage: 1, nextSort: next })
                      }
                      className={column.className}
                    />
                  )
                case "plain":
                  return (
                    <TableHead key={column.label} className={column.className}>
                      {column.label}
                    </TableHead>
                  )
                default: {
                  const _exhaustive: never = column
                  return _exhaustive
                }
              }
            })}
          </TableRow>
        </TableHeader>

        <TableBody>
          {pagination.items.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMNS.length} className="whitespace-normal">
                <Empty className="p-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <PackageIcon aria-hidden />
                    </EmptyMedia>
                    <EmptyTitle>Tidak ada produk</EmptyTitle>
                    <EmptyDescription>
                      Tidak ada produk yang cocok dengan status, pencarian, dan
                      kategori yang dipilih.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </TableCell>
            </TableRow>
          ) : (
            pagination.items.map((listing) => (
              <ListingRow
                key={listing.id}
                listing={listing}
                columnCount={COLUMNS.length}
                now={now}
                selected={selection.isSelected(listing.id)}
                onSelectedChange={(next) => selection.toggle(listing.id, next)}
              />
            ))
          )}
        </TableBody>
      </Table>
      <ListingSelectionBar
        count={selection.selectedCount}
        state={state}
        onClear={selection.clear}
        selectedIds={selection.selectedIds}
      />
    </AdminCard>
  )
}

export { ListingTable }
