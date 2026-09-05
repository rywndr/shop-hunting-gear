"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { cancelOrderAction } from "@/app/(account)/orders/actions"
import { useNotification } from "@/components/notification/notification-provider"
import { Button } from "@/components/ui/button"

function CancelOrderButton({ orderId }: { readonly orderId: string }) {
  const router = useRouter()
  const { showNotification } = useNotification()
  const [pending, setPending] = useState(false)

  async function cancelOrder() {
    setPending(true)

    try {
      const result = await cancelOrderAction(orderId)

      if (result.kind === "success") {
        showNotification({
          variant: "success",
          message: "Pesanan berhasil dibatalkan.",
        })
        router.refresh()
      } else {
        showNotification({ variant: "error", message: result.message })
      }
    } catch {
      showNotification({
        variant: "error",
        message: "Pembatalan belum dapat diproses. Coba lagi.",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={cancelOrder}
        className="h-10"
      >
        {pending ? "Membatalkan..." : "Batalkan Pesanan"}
      </Button>
    </div>
  )
}

export { CancelOrderButton }
