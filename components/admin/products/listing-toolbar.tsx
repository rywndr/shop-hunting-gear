"use client"

import { useEffect, useRef, useState } from "react"
import { SearchField } from "@/components/admin/search-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  listingCategoryFilterLabel,
  listingSortKey,
  listingSortLabel,
  LISTING_SORTS,
  LISTING_SORT_ORDER,
  type ListingCategoryFilter,
  type ListingSort,
} from "@/lib/admin/catalog"
import { ALL_FILTER } from "@/lib/admin/config"
import { CATEGORIES } from "@/lib/site/config"

const SORT_PLACEHOLDER = "Urutkan"
const SEARCH_DEBOUNCE_MS = 350

function DebouncedProductSearch({
  initialValue,
  onValueChange,
}: {
  initialValue: string
  onValueChange: (value: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  const timeout = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timeout.current !== null) window.clearTimeout(timeout.current)
    },
    []
  )

  return (
    <SearchField
      label="Cari nama atau ID produk"
      value={value}
      onValueChange={(next) => {
        setValue(next)
        if (timeout.current !== null) window.clearTimeout(timeout.current)
        timeout.current = window.setTimeout(
          () => onValueChange(next),
          SEARCH_DEBOUNCE_MS
        )
      }}
      className="sm:w-56"
    />
  )
}

function CategoryFilter({
  category,
  onCategoryChange,
}: {
  category: ListingCategoryFilter
  onCategoryChange: (category: ListingCategoryFilter) => void
}) {
  return (
    <Select
      value={category}
      onValueChange={(next) => {
        // Base UI allows clearing the value, a filter has to stay set.
        if (next !== null) {
          onCategoryChange(next)
        }
      }}
    >
      <SelectTrigger
        aria-label="Filter kategori"
        className="min-w-0 flex-1 sm:flex-none"
      >
        <SelectValue>{() => listingCategoryFilterLabel(category)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_FILTER}>
          {listingCategoryFilterLabel(ALL_FILTER)}
        </SelectItem>
        {CATEGORIES.map((entry) => (
          <SelectItem key={entry.slug} value={entry.slug}>
            {entry.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SortFilter({
  sort,
  onSortChange,
}: {
  sort: ListingSort | null
  onSortChange: (sort: ListingSort) => void
}) {
  return (
    <Select
      value={sort === null ? null : listingSortKey(sort)}
      onValueChange={(next) => {
        if (next !== null) {
          onSortChange(LISTING_SORTS[next])
        }
      }}
    >
      <SelectTrigger
        aria-label="Urutkan produk"
        className="min-w-0 flex-1 md:hidden"
      >
        <SelectValue>
          {() => (sort === null ? SORT_PLACEHOLDER : listingSortLabel(sort))}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {LISTING_SORT_ORDER.map((key) => (
          <SelectItem key={key} value={key}>
            {listingSortLabel(LISTING_SORTS[key])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ListingToolbar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
}: {
  search: string
  onSearchChange: (search: string) => void
  category: ListingCategoryFilter
  onCategoryChange: (category: ListingCategoryFilter) => void
  sort: ListingSort | null
  onSortChange: (sort: ListingSort) => void
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <DebouncedProductSearch
        initialValue={search}
        onValueChange={onSearchChange}
      />

      <div className="flex flex-1 items-center gap-2">
        <CategoryFilter
          category={category}
          onCategoryChange={onCategoryChange}
        />
        <SortFilter sort={sort} onSortChange={onSortChange} />
      </div>
    </div>
  )
}

export { ListingToolbar }
