"use client"

import { FilterToggle } from "@/components/admin/filter-toggle"
import {
  isListingStateFilter,
  listingStateFilterLabel,
  LISTING_STATE_FILTER_ORDER,
  type ListingStateFilter,
} from "@/lib/admin/catalog"

function stateCount(
  filter: ListingStateFilter,
  counts: Readonly<Record<ListingStateFilter, number>>
) {
  return filter === "active" || filter === "inactive"
    ? counts[filter]
    : undefined
}

function ListingStateToggle({
  state,
  counts,
  onStateChange,
}: {
  state: ListingStateFilter
  counts: Readonly<Record<ListingStateFilter, number>>
  onStateChange: (state: ListingStateFilter) => void
}) {
  return (
    <FilterToggle
      label="Status tayang produk"
      value={state}
      isValue={isListingStateFilter}
      onValueChange={onStateChange}
      options={LISTING_STATE_FILTER_ORDER.map((filter) => ({
        value: filter,
        label: listingStateFilterLabel(filter),
        count: stateCount(filter, counts),
      }))}
    />
  )
}

export { ListingStateToggle }
