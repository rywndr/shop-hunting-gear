"use client"

import {
  ArrowsClockwiseIcon,
  CaretDownIcon,
  PlusIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BULK_ACTIONS, type BulkActionKind } from "@/lib/admin/catalog"

const BULK_ICONS = {
  upload: UploadSimpleIcon,
  update: ArrowsClockwiseIcon,
} satisfies Record<BulkActionKind, Icon>

function CatalogActions() {
  return (
    <div className="flex w-full items-center gap-2 md:w-auto">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="lg"
              className="flex-1 md:flex-none"
            />
          }
        >
          Pengaturan Massal
          <CaretDownIcon data-icon="inline-end" className="size-3.5" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-auto">
          {BULK_ACTIONS.map((action) => {
            const BulkIcon = BULK_ICONS[action.kind]

            return (
              <DropdownMenuItem key={action.kind}>
                <BulkIcon aria-hidden />
                {action.label}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="lg" className="flex-1 md:flex-none">
        <PlusIcon data-icon="inline-start" />
        Tambah Produk
      </Button>
    </div>
  )
}

export { CatalogActions }
