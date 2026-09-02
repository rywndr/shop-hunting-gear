"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { OrderQueueBadge } from "@/components/admin/pesanan/order-queue-badge"
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
        await import("@/app/admin/pesanan/actions")
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
      <DialogTrigger render={<Button size="sm" variant="secondary" />}>
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
          <div className="flex items-center justify-between gap-4 border-y py-3">
            <div className="min-w-0">
              <span className="block text-xs text-muted-foreground">
                Pesanan
              </span>
              <span className="block truncate font-mono text-sm">
                {orderId}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2 text-xs">
              <span className="text-muted-foreground">Status baru</span>
              <OrderQueueBadge queue="completed" />
            </div>
          </div>

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
