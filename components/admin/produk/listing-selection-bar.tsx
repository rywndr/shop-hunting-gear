"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { XIcon } from "@phosphor-icons/react"

import {
  ListingActionButton,
  ListingActionMenu,
} from "@/components/admin/produk/listing-actions"
import { Button } from "@/components/ui/button"
import { SELECTION_ACTIONS, type ListingStateFilter } from "@/lib/admin/catalog"
import { formatNumber } from "@/utils/format/intl"

function ListingSelectionBar({
  count,
  state,
  onClear,
  selectedIds,
}: {
  count: number
  state: ListingStateFilter
  onClear: () => void
  selectedIds: readonly string[]
}) {
  const layout = SELECTION_ACTIONS[state]
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (count === 0) {
    return null
  }

  function runAction(
    action: Parameters<
      typeof import("@/app/admin/products/actions").applyListingAction
    >[0]["action"]
  ) {
    setError(null)
    startTransition(async () => {
      const { applyListingAction } = await import("@/app/admin/products/actions")
      const result = await applyListingAction({
        action,
        productIds: selectedIds,
      })
      if (result.kind === "error") setError(result.message)
      else {
        onClear()
        router.refresh()
      }
    })
  }

  function renderActions() {
    switch (layout.kind) {
      case "button":
        return (
          <ListingActionButton
            action={layout.action}
            onAction={runAction}
            disabled={pending}
          />
        )
      case "menu":
        return (
          <ListingActionMenu
            actions={layout.actions}
            ariaLabel="Aksi untuk produk terpilih"
            onAction={runAction}
            disabled={pending}
          />
        )
      case "button-menu":
        return (
          <>
            <ListingActionButton
              action={layout.action}
              onAction={runAction}
              disabled={pending}
            />
            <ListingActionMenu
              actions={layout.menuActions}
              ariaLabel="Aksi lain untuk produk terpilih"
              onAction={runAction}
              disabled={pending}
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
      {error && (
        <span role="alert" className="px-2 text-xs text-destructive-foreground">
          {error}
        </span>
      )}
    </div>
  )
}

export { ListingSelectionBar }
