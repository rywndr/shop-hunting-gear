"use client"

import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PencilSimpleIcon } from "@phosphor-icons/react"

import { useNotification } from "@/components/notification/notification-provider"
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
  compareAtPrice,
}: {
  label: string
  value: number
  prefix?: string
  productId: string
  field: "price" | "stock"
  id?: string
  compareAtPrice?: number | null
}) {
  const compareAtPriceId = useId()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { showNotification } = useNotification()

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
            const compareAtPriceValue = data.get("compareAtPrice")
            const nextCompareAtPrice =
              typeof compareAtPriceValue === "string" && compareAtPriceValue
                ? Number(compareAtPriceValue)
                : null
            setError(null)
            startTransition(async () => {
              const { quickEditListing } =
                await import("@/app/admin/products/actions")
              const result = await quickEditListing({
                productId,
                field,
                value: next,
                compareAtPrice:
                  field === "price" ? nextCompareAtPrice : undefined,
              })
              if (result.kind === "error") setError(result.message)
              else {
                showNotification({
                  variant: "success",
                  message:
                    field === "price"
                      ? "Harga produk berhasil diperbarui."
                      : "Stok produk berhasil diperbarui.",
                })
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
          {field === "price" && (
            <div className="space-y-1">
              <label htmlFor={compareAtPriceId} className="text-sm font-medium">
                Harga sebelum diskon
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-foreground">
                  Rp
                </span>
                <Input
                  id={compareAtPriceId}
                  type="number"
                  name="compareAtPrice"
                  min={0}
                  defaultValue={compareAtPrice ?? ""}
                  className="pl-8"
                />
              </div>
            </div>
          )}
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
