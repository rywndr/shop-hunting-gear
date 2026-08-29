"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  isListingStateFilter,
  listingStateFilterLabel,
  LISTING_STATE_FILTER_ORDER,
  type ListingStateFilter,
} from "@/lib/admin/catalog"
import { formatNumber } from "@/utils/format/intl"

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
    <div className="-mx-(--card-spacing) [scrollbar-width:none] overflow-x-auto px-(--card-spacing) [&::-webkit-scrollbar]:hidden">
      <ToggleGroup
        aria-label="Status tayang produk"
        variant="outline"
        spacing={0}
        value={[state]}
        onValueChange={(next) => {
          const [selected] = next

          // Base UI allows unpressing the active item, the table needs a filter.
          if (selected && isListingStateFilter(selected)) {
            onStateChange(selected)
          }
        }}
      >
        {LISTING_STATE_FILTER_ORDER.map((filter) => (
          <ToggleGroupItem key={filter} value={filter} size="sm">
            {listingStateFilterLabel(filter)}
            {(filter === "active" || filter === "inactive") && (
              <> {formatNumber(counts[filter])}</>
            )}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

export { ListingStateToggle }
