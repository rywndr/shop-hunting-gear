"use client"

import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { useNotification } from "@/components/notification/notification-provider"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

function CancelUnpaidOrderDialog({
  orderId,
  paid,
  amount,
}: {
  readonly orderId: string
  readonly paid: boolean
  readonly amount: string
}) {
  const reasonId = useId()
  const router = useRouter()
  const { showNotification } = useNotification()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setReason("")
      setError(null)
    }
  }

  function confirm() {
    if (!reason.trim()) {
      setError("Masukkan alasan pembatalan.")
      return
    }

    setError(null)
    startTransition(async () => {
      const { cancelAdminOrderAction } =
        await import("@/app/admin/orders/actions")
      const result = await cancelAdminOrderAction({ orderId, reason })

      if (result.kind === "error") {
        setError(result.message)
        return
      }

      showNotification({
        variant: "success",
        message: result.message ?? "Pesanan berhasil dibatalkan.",
      })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Batalkan pesanan
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan pesanan?</DialogTitle>
          <DialogDescription>
            {paid
              ? `Pesanan akan berhenti diproses. Pembalikan pembayaran atau pengembalian dana penuh sebesar ${amount} akan ditangani setelah konfirmasi.`
              : "Stok yang masih dipesan akan tersedia kembali setelah status pembayaran dipastikan."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="border-y py-3">
            <span className="block text-xs text-muted-foreground">Pesanan</span>
            <span className="block truncate font-mono text-sm">{orderId}</span>
            {paid && (
              <span className="mt-1 block text-sm">Dana penuh: {amount}</span>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={reasonId}>Alasan pembatalan</Label>
            <Textarea
              id={reasonId}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Contoh: pesanan duplikat"
              maxLength={1000}
              disabled={pending}
              aria-invalid={error !== null}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Kembali
          </DialogClose>
          <Button type="button" onClick={confirm} disabled={pending}>
            {pending ? "Memproses..." : "Konfirmasi pembatalan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { CancelUnpaidOrderDialog }
