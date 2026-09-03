"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Script from "next/script"

import {
  confirmPaymentAction,
  createPaymentAction,
  type CreatePaymentResult,
} from "@/app/(account)/checkout/actions"
import {
  paymentNoticeForConfirmation,
  type PaymentNotice,
} from "@/components/checkout/payment-notice"
import { Button } from "@/components/ui/button"
import type { CheckoutSource } from "@/lib/checkout/config"
import type { MidtransBrowserConfig } from "@/lib/payments/midtrans/config"
import type { CreateSnapPaymentInput } from "@/lib/payments/midtrans/schema"
import type { RajaOngkirCourierCode } from "@/lib/shipping/config"

type SnapTransaction = Extract<CreatePaymentResult, { readonly kind: "ready" }>

type PaymentState =
  | { readonly kind: "idle" }
  | { readonly kind: "requesting" }
  | { readonly kind: "confirming"; readonly orderId: string }
  | {
      readonly kind: "prepared"
      readonly transaction: SnapTransaction
      readonly checkoutKey: string
      readonly notice?: PaymentNotice
    }
  | {
      readonly kind: "snap-completed"
      readonly orderId: string
      readonly notice: PaymentNotice
    }
  | { readonly kind: "error"; readonly message: string }

type SnapScriptState = "loading" | "ready" | "error"

function SnapPaymentButton({
  addressId,
  browserConfig,
  customerNote,
  shipping,
  source,
  onOrderPrepared,
  onOrderCreated,
}: {
  addressId: string
  browserConfig: MidtransBrowserConfig
  customerNote: string
  shipping:
    | {
        readonly courier: RajaOngkirCourierCode
        readonly service: string
      }
    | undefined
  source: CheckoutSource
  onOrderPrepared: (customerNote: string) => void
  onOrderCreated: () => Promise<void>
}) {
  const router = useRouter()
  const [scriptState, setScriptState] = useState<SnapScriptState>("loading")
  const [paymentState, setPaymentState] = useState<PaymentState>({
    kind: "idle",
  })
  const normalizedCustomerNote = customerNote.trim() || undefined
  const checkoutKey = JSON.stringify({ addressId, shipping, source })

  async function finishPayment(orderId: string) {
    setPaymentState({ kind: "confirming", orderId })

    let notice: PaymentNotice

    try {
      const result = await confirmPaymentAction({ orderId })
      notice = paymentNoticeForConfirmation(result)
    } catch {
      notice = {
        kind: "info",
        message:
          "Pembayaran selesai di Midtrans. Status pesanan akan diperbarui setelah konfirmasi.",
      }
    }

    setPaymentState({ kind: "snap-completed", orderId, notice })
    router.push(`/history?pesanan=${encodeURIComponent(orderId)}`)
    router.refresh()
  }

  function openSnap(
    transaction: SnapTransaction,
    transactionCheckoutKey: string
  ) {
    if (!window.snap) {
      setPaymentState({
        kind: "error",
        message: "Layanan pembayaran belum selesai dimuat. Coba lagi.",
      })
      return
    }

    setPaymentState({
      kind: "prepared",
      transaction,
      checkoutKey: transactionCheckoutKey,
    })
    window.snap.pay(transaction.token, {
      onSuccess() {
        void finishPayment(transaction.orderId)
      },
      onPending() {
        setPaymentState({
          kind: "prepared",
          transaction,
          checkoutKey: transactionCheckoutKey,
          notice: {
            kind: "info",
            message:
              "Instruksi pembayaran sudah dibuat. Selesaikan pembayaran sesuai petunjuk Midtrans.",
          },
        })
      },
      onError() {
        setPaymentState({
          kind: "prepared",
          transaction,
          checkoutKey: transactionCheckoutKey,
          notice: {
            kind: "error",
            message: "Pembayaran gagal diproses. Coba metode lain.",
          },
        })
      },
      onClose() {
        setPaymentState((current) => {
          if (
            current.kind === "confirming" ||
            current.kind === "snap-completed"
          ) {
            return current
          }

          return {
            kind: "prepared",
            transaction,
            checkoutKey: transactionCheckoutKey,
            notice: {
              kind: "info",
              message:
                "Jendela pembayaran ditutup. Anda dapat membukanya lagi.",
            },
          }
        })
      },
    })
  }

  async function startPayment() {
    if (
      paymentState.kind === "prepared" &&
      paymentState.checkoutKey === checkoutKey
    ) {
      openSnap(paymentState.transaction, checkoutKey)
      return
    }

    if (!shipping) {
      return
    }

    const input = {
      addressId,
      customerNote: normalizedCustomerNote,
      shipping,
      source,
    } satisfies CreateSnapPaymentInput

    setPaymentState({ kind: "requesting" })

    try {
      const result = await createPaymentAction(input)

      if (result.kind === "error") {
        setPaymentState(result)
        return
      }

      onOrderPrepared(result.customerNote ?? "")
      openSnap(result, checkoutKey)
      void onOrderCreated()
    } catch {
      setPaymentState({
        kind: "error",
        message: "Tidak dapat terhubung ke pembayaran. Coba lagi.",
      })
    }
  }

  const configured = browserConfig.kind === "configured"
  const canPay =
    configured &&
    scriptState === "ready" &&
    Boolean(addressId && shipping) &&
    paymentState.kind !== "requesting" &&
    paymentState.kind !== "confirming" &&
    paymentState.kind !== "snap-completed"
  const hasReusableTransaction =
    paymentState.kind === "prepared" && paymentState.checkoutKey === checkoutKey
  const buttonLabel =
    paymentState.kind === "requesting"
      ? "Membuka pembayaran..."
      : paymentState.kind === "confirming"
        ? "Memastikan pembayaran..."
        : hasReusableTransaction
          ? "Buka kembali pembayaran"
          : paymentState.kind === "snap-completed"
            ? "Proses pembayaran selesai"
            : configured
              ? "Bayar sekarang"
              : "Pembayaran belum tersedia"
  const notice =
    paymentState.kind === "error"
      ? { kind: "error" as const, message: paymentState.message }
      : (paymentState.kind === "prepared" && hasReusableTransaction) ||
          paymentState.kind === "snap-completed"
        ? paymentState.notice
        : paymentState.kind === "confirming"
          ? {
              kind: "info" as const,
              message: "Memastikan status pembayaran...",
            }
          : scriptState === "error"
            ? {
                kind: "error" as const,
                message:
                  "Layanan pembayaran tidak dapat dimuat. Muat ulang halaman.",
              }
            : undefined

  return (
    <>
      {browserConfig.kind === "configured" && (
        <Script
          src={browserConfig.snapScriptUrl}
          data-client-key={browserConfig.clientKey}
          onReady={() => setScriptState("ready")}
          onError={() => setScriptState("error")}
        />
      )}
      <Button
        type="button"
        disabled={!canPay}
        onClick={startPayment}
        className="h-11 font-bold tracking-wide uppercase"
      >
        {buttonLabel}
      </Button>
      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={
            notice.kind === "error"
              ? "text-sm text-destructive"
              : notice.kind === "success"
                ? "text-sm text-primary"
                : "text-sm text-muted-foreground"
          }
        >
          {notice.message}
        </p>
      )}
    </>
  )
}

export { SnapPaymentButton }
