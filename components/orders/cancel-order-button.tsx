"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { cancelOrderAction } from "@/app/(account)/history/actions"
import { Button } from "@/components/ui/button"

function CancelOrderButton({ orderId }: { readonly orderId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function cancelOrder() {
    setPending(true)
    setMessage(null)

    try {
      const result = await cancelOrderAction(orderId)

      if (result.kind === "success") {
        router.refresh()
      } else {
        setMessage(result.message)
      }
    } catch {
      setMessage("Pembatalan belum dapat diproses. Coba lagi.")
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
      {message && (
        <p
          role="alert"
          className="max-w-60 text-right text-xs text-destructive"
        >
          {message}
        </p>
      )}
    </div>
  )
}

export { CancelOrderButton }
