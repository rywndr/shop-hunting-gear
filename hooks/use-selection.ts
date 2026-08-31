"use client"

import * as React from "react"

export type SelectionState = {
  readonly allSelected: boolean
  readonly someSelected: boolean
  readonly selectedCount: number
  readonly selectedIds: readonly string[]
  readonly isSelected: (id: string) => boolean
  readonly toggle: (id: string, selected: boolean) => void
  readonly toggleAll: (selected: boolean) => void
  readonly clear: () => void
}

export function useSelection({
  ids,
}: {
  ids: readonly string[]
}): SelectionState {
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(
    () => new Set()
  )

  return {
    allSelected: ids.length > 0 && ids.every((id) => selected.has(id)),
    someSelected: ids.some((id) => selected.has(id)),
    selectedCount: selected.size,
    selectedIds: [...selected],
    isSelected: (id) => selected.has(id),
    toggle: (id, next) =>
      setSelected((current) => {
        const updated = new Set(current)

        if (next) {
          updated.add(id)
        } else {
          updated.delete(id)
        }

        return updated
      }),
    toggleAll: (next) =>
      setSelected((current) => {
        const updated = new Set(current)

        for (const id of ids) {
          if (next) {
            updated.add(id)
          } else {
            updated.delete(id)
          }
        }

        return updated
      }),
    clear: () => setSelected(new Set()),
  }
}
