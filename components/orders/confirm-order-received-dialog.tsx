"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

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

function ConfirmOrderReceivedDialog({
  orderId,
  triggerLabel,
}: {
  orderId: string
  triggerLabel: string
}) {
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
    if (pending) return

    setError(null)
    startTransition(async () => {
      const { confirmOrderReceivedAction } =
        await import("@/app/(account)/orders/actions")
      const result = await confirmOrderReceivedAction(orderId)

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
      <DialogTrigger render={<Button variant="outline" className="h-10" />}>
        {triggerLabel}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Konfirmasi pesanan diterima?</DialogTitle>
          <DialogDescription>
            Konfirmasi hanya jika paket sudah tiba dan Anda telah menerimanya.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <dl className="border-y py-3">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Pesanan</dt>
              <dd className="truncate font-mono text-sm">{orderId}</dd>
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
            {pending ? "Menyimpan..." : "Ya, Pesanan Diterima"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmOrderReceivedDialog }
