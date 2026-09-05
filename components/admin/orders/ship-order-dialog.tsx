"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { OrderQueueBadge } from "@/components/admin/orders/order-queue-badge"
import { TextField } from "@/components/form/fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  shipOrderSchema,
  SHIP_ORDER_DEFAULT_VALUES,
  TRACKING_MAX_LENGTH,
  TRACKING_PLACEHOLDER,
  type ShipOrderInput,
  type ShipOrderValues,
} from "@/lib/admin/shipment"

type ShipOrderDialogProps = {
  orderId: string
  buyer: string
  courier: string
}

function ShipOrderDialog({ orderId, buyer, courier }: ShipOrderDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<ShipOrderInput, unknown, ShipOrderValues>({
    resolver: zodResolver(shipOrderSchema),
    defaultValues: SHIP_ORDER_DEFAULT_VALUES,
  })
  const trackingId = `resi-${orderId}`

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return

    setOpen(nextOpen)
    if (!nextOpen) {
      setError(null)
      form.reset(SHIP_ORDER_DEFAULT_VALUES)
    }
  }

  function submit({ tracking }: ShipOrderValues) {
    setError(null)
    startTransition(async () => {
      const { shipOrderAction } = await import("@/app/admin/orders/actions")
      const result = await shipOrderAction(orderId, tracking)

      if (result.kind === "error") {
        setError(result.message)
        return
      }

      setOpen(false)
      form.reset(SHIP_ORDER_DEFAULT_VALUES)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>Kirim Pesanan</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kirim pesanan ini?</DialogTitle>
          <DialogDescription>
            Masukkan nomor resi dari kurir setelah paket diserahkan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(submit)} className="grid gap-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-y py-3 text-sm">
            <dt className="text-xs text-muted-foreground">Pesanan</dt>
            <dd className="min-w-0 truncate text-right font-mono">{orderId}</dd>

            <dt className="text-xs text-muted-foreground">Pembeli</dt>
            <dd className="min-w-0 truncate text-right">{buyer}</dd>

            <dt className="text-xs text-muted-foreground">Jasa kirim</dt>
            <dd className="min-w-0 truncate text-right">{courier}</dd>

            <dt className="text-xs text-muted-foreground">Status baru</dt>
            <dd className="text-right">
              <OrderQueueBadge queue="shipped" />
            </dd>
          </dl>

          <TextField
            id={trackingId}
            label="Nomor Resi"
            placeholder={TRACKING_PLACEHOLDER}
            description="Nomor resi tampil di riwayat pesanan pelanggan."
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={TRACKING_MAX_LENGTH}
            error={form.formState.errors.tracking?.message}
            {...form.register("tracking")}
          />

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pending} />
              }
            >
              Batal
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : "Tandai Dikirim"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { ShipOrderDialog }
