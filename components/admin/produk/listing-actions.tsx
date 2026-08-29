"use client"

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

function ListingActionButton({ action }: { action: ListingActionKind }) {
  return (
    <Button variant="secondary">
      {LISTING_ACTIONS[action].label}
    </Button>
  )
}

function ListingActionMenu({
  actions,
  ariaLabel,
}: {
  actions: readonly ListingActionKind[]
  ariaLabel: string
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={ariaLabel}
          />
        }
      >
        <DotsThreeVerticalIcon className="size-4" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-auto">
        {actions.map((action) => {
          const ActionIcon = ACTION_ICONS[action]

          return (
            <DropdownMenuItem key={action}>
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

  return (
    <div className="-mr-1 flex justify-end gap-1">
      {editable && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Ubah ${listing.product.name}`}
        >
          <PencilSimpleIcon className="size-4" aria-hidden />
        </Button>
      )}
      <ListingActionMenu
        actions={actions}
        ariaLabel={`Aksi untuk ${listing.product.name}`}
      />
    </div>
  )
}

export { ListingActionButton, ListingActionMenu, ListingActions }
