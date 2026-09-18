"use client"

import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { cancelOrderAction } from "@/app/(account)/orders/actions"
import { TextareaField } from "@/components/form/fields"
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

function CancelOrderButton({
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
  const [error, setError] = useState<string | undefined>()
  const [pending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setReason("")
      setError(undefined)
    }
  }

  function cancelOrder() {
    if (!reason.trim()) {
      setError("Masukkan alasan pembatalan.")
      return
    }

    setError(undefined)
    startTransition(async () => {
      const result = await cancelOrderAction({ orderId, reason })
      if (result.kind === "error") {
        setError(result.message)
        return
      }

      showNotification({
        variant: result.kind === "success" ? "success" : "info",
        message: result.message,
      })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        Batalkan Pesanan
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan pesanan?</DialogTitle>
          <DialogDescription>
            {paid
              ? `Pesanan akan berhenti diproses. Pembalikan pembayaran atau pengembalian dana penuh sebesar ${amount} akan diproses setelah pembatalan dikonfirmasi.`
              : "Pembatalan akan menghentikan pesanan dan melepaskan stok yang dipesan setelah status pembayaran dikonfirmasi."}
          </DialogDescription>
        </DialogHeader>
        <TextareaField
          id={reasonId}
          label="Alasan pembatalan"
          placeholder="Contoh: pesanan duplikat"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={1000}
          disabled={pending}
          error={error}
        />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Kembali
          </DialogClose>
          <Button type="button" onClick={cancelOrder} disabled={pending}>
            {pending ? "Memproses..." : "Konfirmasi pembatalan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { CancelOrderButton }
