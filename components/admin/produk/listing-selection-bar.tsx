"use client"

import { XIcon } from "@phosphor-icons/react"

import {
  ListingActionButton,
  ListingActionMenu,
} from "@/components/admin/produk/listing-actions"
import { Button } from "@/components/ui/button"
import {
  SELECTION_ACTIONS,
  type ListingStateFilter,
} from "@/lib/admin/catalog"
import { formatNumber } from "@/utils/format/intl"

function ListingSelectionBar({
  count,
  state,
  onClear,
}: {
  count: number
  state: ListingStateFilter
  onClear: () => void
}) {
  if (count === 0) {
    return null
  }

  const layout = SELECTION_ACTIONS[state]

  function renderActions() {
    switch (layout.kind) {
      case "button":
        return <ListingActionButton action={layout.action} />
      case "menu":
        return (
          <ListingActionMenu
            actions={layout.actions}
            ariaLabel="Aksi untuk produk terpilih"
          />
        )
      case "button-menu":
        return (
          <>
            <ListingActionButton action={layout.action} />
            <ListingActionMenu
              actions={layout.menuActions}
              ariaLabel="Aksi lain untuk produk terpilih"
            />
          </>
        )
      default: {
        const _exhaustive: never = layout
        return _exhaustive
      }
    }
  }

  return (
    <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-foreground p-1.5 text-background shadow-lg">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClear}
        aria-label="Batalkan pilihan produk"
        className="text-background hover:bg-background/10 hover:text-background"
      >
        <XIcon className="size-4" />
      </Button>
      <span className="px-1 text-sm font-medium whitespace-nowrap tabular-nums">
        {formatNumber(count)} dipilih
      </span>
      {renderActions()}
    </div>
  )
}

export { ListingSelectionBar }
