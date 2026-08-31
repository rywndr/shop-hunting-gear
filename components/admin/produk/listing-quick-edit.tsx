"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
  productId,
  field,
  id,
}: {
  label: string
  value: number
  prefix?: string
  productId: string
  field: "price" | "stock"
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="ghost"
            size="icon-xs"
            aria-label={`Ubah ${label.toLocaleLowerCase("id-ID")}`}
            className="opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100"
          />
        }
      >
        <PencilSimpleIcon aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl">
        <PopoverTitle>{label}</PopoverTitle>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            const next = Number(data.get("value"))
            setError(null)
            startTransition(async () => {
              const { quickEditListing } =
                await import("@/app/admin/produk/actions")
              const result = await quickEditListing({
                productId,
                field,
                value: next,
              })
              if (result.kind === "error") setError(result.message)
              else {
                setOpen(false)
                router.refresh()
              }
            })
          }}
        >
          <div className="relative">
            {prefix && (
              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-foreground">
                {prefix}
              </span>
            )}
            <Input
              type="number"
              name="value"
              min={0}
              defaultValue={value}
              aria-label={label}
              className={prefix ? "pl-8" : undefined}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

export { ListingQuickEdit }
