"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatNumber } from "@/utils/format/intl"

type FilterOption<TValue extends string> = {
  readonly value: TValue
  readonly label: string
  readonly count?: number
}

function FilterToggle<TValue extends string>({
  label,
  options,
  value,
  isValue,
  onValueChange,
}: {
  label: string
  options: readonly FilterOption<TValue>[]
  value: TValue
  isValue: (candidate: unknown) => candidate is TValue
  onValueChange: (value: TValue) => void
}) {
  return (
    <div className="-mx-(--card-spacing) [scrollbar-width:none] overflow-x-auto px-(--card-spacing) [&::-webkit-scrollbar]:hidden">
      <ToggleGroup
        aria-label={label}
        variant="outline"
        spacing={0}
        value={[value]}
        onValueChange={(next) => {
          const [selected] = next

          // Base UI allows unpressing the active item, the table needs a filter.
          if (isValue(selected)) {
            onValueChange(selected)
          }
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value} size="sm">
            {option.label}
            {option.count !== undefined && <> {formatNumber(option.count)}</>}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

export { FilterToggle }
export type { FilterOption }
