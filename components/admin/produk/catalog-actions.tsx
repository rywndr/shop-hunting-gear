"use client"

import Link from "next/link"
import { CaretDownIcon, PlusIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  bulkHref,
  BULK_MODES,
  BULK_MODE_ORDER,
  DEFAULT_BULK_STEP,
} from "@/lib/admin/bulk"

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
          Pengaturan massal
          <CaretDownIcon data-icon="inline-end" className="size-3.5" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-auto">
          {BULK_MODE_ORDER.map((kind) => {
            const mode = BULK_MODES[kind]

            return (
              <DropdownMenuItem
                key={kind}
                render={
                  <Link href={bulkHref({ mode, step: DEFAULT_BULK_STEP })} />
                }
              >
                {mode.label}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="lg" className="flex-1 md:flex-none">
        <PlusIcon data-icon="inline-start" />
        Tambah produk
      </Button>
    </div>
  )
}

export { CatalogActions }
