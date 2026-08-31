"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowCounterClockwiseIcon,
  DotsThreeVerticalIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LISTING_ACTIONS,
  LISTING_STATES,
  type Listing,
  type ListingActionKind,
} from "@/lib/admin/catalog"

const ACTION_ICONS = {
  activate: EyeIcon,
  deactivate: EyeSlashIcon,
  delete: TrashIcon,
  restore: ArrowCounterClockwiseIcon,
} satisfies Record<ListingActionKind, Icon>

function ListingActionButton({
  action,
  onAction,
  disabled,
}: {
  action: ListingActionKind
  onAction: (action: ListingActionKind) => void
  disabled?: boolean
}) {
  return (
    <Button
      variant="secondary"
      disabled={disabled}
      onClick={() => onAction(action)}
    >
      {LISTING_ACTIONS[action].label}
    </Button>
  )
}

function ListingActionMenu({
  actions,
  ariaLabel,
  onAction,
  disabled,
}: {
  actions: readonly ListingActionKind[]
  ariaLabel: string
  onAction: (action: ListingActionKind) => void
  disabled?: boolean
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={ariaLabel} />
        }
      >
        <DotsThreeVerticalIcon className="size-4" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-auto">
        {actions.map((action) => {
          const ActionIcon = ACTION_ICONS[action]

          return (
            <DropdownMenuItem
              key={action}
              disabled={disabled}
              onClick={() => onAction(action)}
            >
              <ActionIcon aria-hidden />
              {LISTING_ACTIONS[action].label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ListingActions({ listing }: { listing: Listing }) {
  const { actions, editable } = LISTING_STATES[listing.state]
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function runAction(action: ListingActionKind) {
    setError(null)
    startTransition(async () => {
      const { applyListingAction } = await import("@/app/admin/produk/actions")
      const result = await applyListingAction({
        action,
        productIds: [listing.id],
      })
      if (result.kind === "error") setError(result.message)
      else router.refresh()
    })
  }

  return (
    <div className="-mr-1 flex justify-end gap-1">
      {editable && (
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={<Link href={`/admin/produk/${listing.id}/ubah`} />}
          aria-label={`Ubah ${listing.product.name}`}
        >
          <PencilSimpleIcon className="size-4" aria-hidden />
        </Button>
      )}
      <ListingActionMenu
        actions={actions}
        ariaLabel={`Aksi untuk ${listing.product.name}`}
        onAction={runAction}
        disabled={pending}
      />
      {error && (
        <span role="alert" className="sr-only">
          {error}
        </span>
      )}
    </div>
  )
}

export { ListingActionButton, ListingActionMenu, ListingActions }
