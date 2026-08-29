"use client"

import { useState } from "react"
import { PencilSimpleIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

function ListingQuickEdit({
  label,
  value,
  prefix,
}: {
  label: string
  value: number
  prefix?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Ubah ${label.toLocaleLowerCase("id-ID")}`}
            className="opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100"
          />
        }
      >
        <PencilSimpleIcon aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl">
        <PopoverTitle>{label}</PopoverTitle>
        <form
          className="space-y-3"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="relative">
            {prefix && (
              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-foreground">
                {prefix}
              </span>
            )}
            <Input
              type="number"
              min={0}
              defaultValue={value}
              aria-label={label}
              className={prefix ? "pl-8" : undefined}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

export { ListingQuickEdit }
