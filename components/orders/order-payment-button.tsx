"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Script from "next/script"

import { confirmPaymentAction } from "@/app/(account)/checkout/actions"
import {
  paymentNoticeForConfirmation,
  type PaymentNotice,
} from "@/components/checkout/payment-notice"
import { Button } from "@/components/ui/button"
import type { MidtransBrowserConfig } from "@/lib/payments/midtrans/config"

type SnapScriptState = "loading" | "ready" | "error"

function OrderPaymentButton({
  browserConfig,
  orderId,
  token,
}: {
  readonly browserConfig: MidtransBrowserConfig
  readonly orderId: string
  readonly token: string
}) {
  const router = useRouter()
  const [scriptState, setScriptState] = useState<SnapScriptState>("loading")
  const [notice, setNotice] = useState<PaymentNotice | null>(null)
  const [paying, setPaying] = useState(false)

  async function finishPayment() {
    let nextNotice: PaymentNotice

    try {
      const result = await confirmPaymentAction({ orderId })
      nextNotice = paymentNoticeForConfirmation(result)
    } catch {
      nextNotice = {
        kind: "info",
        message:
          "Pembayaran selesai di Midtrans. Status pesanan akan diperbarui setelah konfirmasi.",
      }
    }

    setNotice(nextNotice)
    setPaying(false)
    router.push(`/history?pesanan=${encodeURIComponent(orderId)}`)
    router.refresh()
  }

  function openPayment() {
    if (!window.snap) {
      setNotice({
        kind: "error",
        message: "Layanan pembayaran belum selesai dimuat. Coba lagi.",
      })
      return
    }

    setPaying(true)
    window.snap.pay(token, {
      onSuccess() {
        void finishPayment()
      },
      onPending() {
        setNotice({
          kind: "info",
          message: "Instruksi pembayaran sudah dibuat di Midtrans.",
        })
        setPaying(false)
      },
      onError() {
        setNotice({
          kind: "error",
          message: "Pembayaran gagal diproses. Coba metode lain.",
        })
        setPaying(false)
      },
      onClose() {
        setNotice({
          kind: "info",
          message: "Jendela pembayaran ditutup. Anda dapat membukanya lagi.",
        })
        setPaying(false)
      },
    })
  }

  if (browserConfig.kind !== "configured") {
    return (
      <Button type="button" disabled className="h-10">
        Pembayaran belum tersedia
      </Button>
    )
  }

  const disabled = scriptState !== "ready" || paying

  return (
    <div className="flex flex-col items-end gap-2">
      <Script
        src={browserConfig.snapScriptUrl}
        data-client-key={browserConfig.clientKey}
        onReady={() => setScriptState("ready")}
        onError={() => setScriptState("error")}
      />
      <Button
        type="button"
        disabled={disabled}
        onClick={openPayment}
        className="h-10"
      >
        {paying ? "Membuka pembayaran..." : "Bayar Sekarang"}
      </Button>
      {(notice || scriptState === "error") && (
        <p
          role={
            notice?.kind === "error" || scriptState === "error"
              ? "alert"
              : "status"
          }
          className={
            notice?.kind === "error" || scriptState === "error"
              ? "max-w-60 text-right text-xs text-destructive"
              : notice?.kind === "success"
                ? "max-w-60 text-right text-xs text-primary"
                : "max-w-60 text-right text-xs text-muted-foreground"
          }
        >
          {scriptState === "error"
            ? "Layanan pembayaran tidak dapat dimuat. Muat ulang halaman."
            : notice?.message}
        </p>
      )}
    </div>
  )
}

export { OrderPaymentButton }
