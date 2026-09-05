"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { OrderQueueBadge } from "@/components/admin/orders/order-queue-badge"
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

function MarkOrderCompletedDialog({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return

    setOpen(nextOpen)
    if (!nextOpen) setError(null)
  }

  function confirm() {
    setError(null)
    startTransition(async () => {
      const { markOrderCompletedAction } =
        await import("@/app/admin/orders/actions")
      const result = await markOrderCompletedAction(orderId)

      if (result.kind === "error") {
        setError(result.message)
        return
      }

      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Tandai selesai
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tandai pesanan selesai?</DialogTitle>
          <DialogDescription>
            Gunakan ini setelah barang diterima atau diambil pelanggan di toko.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <dl className="grid min-w-0 gap-3 border-y py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-4">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Pesanan</dt>
              <dd className="truncate font-mono text-sm">{orderId}</dd>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs sm:justify-start">
              <dt className="text-muted-foreground">Status baru</dt>
              <dd>
                <OrderQueueBadge queue="completed" />
              </dd>
            </div>
          </dl>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Batal
          </DialogClose>
          <Button type="button" onClick={confirm} disabled={pending}>
            {pending ? "Menyimpan..." : "Tandai selesai"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { MarkOrderCompletedDialog }
