"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
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
import { usePagination } from "@/hooks/use-pagination"
import { useSelection } from "@/hooks/use-selection"
import {
  listingFilterFromTab,
  listingTab,
  queryListings,
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

function ListingTable({
  listings,
  now,
}: {
  listings: readonly Listing[]
  now: string
}) {
  const searchParams = useSearchParams()
  const state = listingFilterFromTab(searchParams.get("tab"))
  const [category, setCategory] = useState<ListingCategoryFilter>(ALL_FILTER)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<ListingSort | null>(null)

  const countForState = (filter: ListingStateFilter) =>
    queryListings(listings, {
      state: filter,
      category: ALL_FILTER,
      search: "",
      sort: null,
    }).length
  const stateCounts = {
    all: countForState(ALL_FILTER),
    active: countForState("active"),
    inactive: countForState("inactive"),
    draft: countForState("draft"),
    deleted: countForState("deleted"),
  } satisfies Record<ListingStateFilter, number>

  const matched = queryListings(listings, { state, category, search, sort })
  const pagination = usePagination({
    items: matched,
    pageSize: DEFAULT_PAGE_SIZE,
  })
  const selection = useSelection({
    ids: pagination.items.map((listing) => listing.id),
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
          counts={stateCounts}
          onStateChange={(next) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set("tab", listingTab(next))
            window.history.pushState(null, "", `?${params.toString()}`)
            pagination.setPage(1)
            selection.clear()
          }}
        />

        <ListingToolbar
          search={search}
          onSearchChange={(next) => {
            setSearch(next)
            pagination.setPage(1)
          }}
          category={category}
          onCategoryChange={(next) => {
            setCategory(next)
            pagination.setPage(1)
          }}
          sort={sort}
          onSortChange={setSort}
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
                      onSortChange={setSort}
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
                onSelectedChange={(next) =>
                  selection.toggle(listing.id, next)
                }
              />
            ))
          )}
        </TableBody>
      </Table>
      <ListingSelectionBar
        count={selection.selectedCount}
        state={state}
        onClear={selection.clear}
      />
    </AdminCard>
  )
}

export { ListingTable }
