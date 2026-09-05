"use client"

import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { TableHead } from "@/components/ui/table"
import {
  LISTING_SORT_COLUMNS,
  type ListingSort,
  type ListingSortColumn,
  type SortDirection,
} from "@/lib/admin/catalog"
import { cn } from "@/lib/utils"

const DIRECTION_ICONS = {
  asc: CaretUpIcon,
  desc: CaretDownIcon,
} satisfies Record<SortDirection, Icon>

const ARIA_SORT = {
  asc: "ascending",
  desc: "descending",
} as const satisfies Record<SortDirection, React.AriaAttributes["aria-sort"]>

function SortableHead({
  column,
  sort,
  onSortChange,
  className,
}: {
  column: ListingSortColumn
  sort: ListingSort | null
  onSortChange: (sort: ListingSort | null) => void
  className?: string
}) {
  const { label, directionLabels } = LISTING_SORT_COLUMNS[column]
  const direction = sort?.column === column ? sort.direction : null
  const next: ListingSort | null =
    direction === null
      ? { column, direction: "asc" }
      : direction === "asc"
        ? { column, direction: "desc" }
        : null
  const SortIcon =
    direction === null ? CaretUpDownIcon : DIRECTION_ICONS[direction]

  return (
    <TableHead
      className={className}
      aria-sort={direction === null ? "none" : ARIA_SORT[direction]}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSortChange(next)}
        className={cn("-mx-2 font-medium", direction !== null && "bg-muted")}
      >
        {label}
        <span className="sr-only">
          {next === null
            ? "Hapus pengurutan"
            : `Urutkan ${directionLabels[next.direction]}`}
        </span>
        <SortIcon
          data-icon="inline-end"
          className={cn(
            "size-3.5 text-muted-foreground",
            direction !== null && "text-foreground"
          )}
          aria-hidden
        />
      </Button>
    </TableHead>
  )
}

export { SortableHead }
