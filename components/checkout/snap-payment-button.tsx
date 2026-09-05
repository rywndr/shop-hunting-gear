"use client"

import { useRef, useState } from "react"
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
import { useNotification } from "@/components/notification/notification-provider"
import { Button } from "@/components/ui/button"
import type { CheckoutSource } from "@/lib/checkout/config"
import {
  completePaymentNavigation,
  normalizeOrderCreated,
  type OrderCreatedResult,
} from "@/lib/checkout/order-created"
import type { MidtransBrowserConfig } from "@/lib/payments/midtrans/config"
import type { CreateSnapPaymentInput } from "@/lib/payments/midtrans/schema"
import type { RajaOngkirCourierCode } from "@/lib/shipping/config"

type SnapTransaction = Extract<CreatePaymentResult, { readonly kind: "ready" }>

type PaymentState =
  | { readonly kind: "idle" }
  | { readonly kind: "requesting"; readonly attemptId: number }
  | {
      readonly kind: "confirming"
      readonly attemptId: number
      readonly orderId: string
    }
  | {
      readonly kind: "prepared"
      readonly attemptId: number
      readonly transaction: SnapTransaction
      readonly checkoutKey: string
      readonly notice?: PaymentNotice
    }
  | {
      readonly kind: "snap-completed"
      readonly attemptId: number
      readonly orderId: string
      readonly notice: PaymentNotice
    }
  | {
      readonly kind: "error"
      readonly attemptId: number
      readonly message: string
    }

type CartCleanupState =
  | { readonly kind: "idle" }
  | {
      readonly kind: "pending"
      readonly attemptId: number
      readonly orderId: string
    }
  | {
      readonly kind: "error"
      readonly attemptId: number
      readonly orderId: string
      readonly message: string
    }

type SnapScriptState = "loading" | "ready" | "error"

type CartCleanupTask = {
  readonly attemptId: number
  readonly orderId: string
  readonly result: Promise<OrderCreatedResult>
}

function SnapPaymentButton({
  addressId,
  browserConfig,
  customerNote,
  shipping,
  source,
  onPreparingChange,
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
  onPreparingChange: (preparing: boolean) => void
  onOrderPrepared: (order: {
    readonly orderId: string
    readonly customerNote: string | null
  }) => void
  onOrderCreated: () => Promise<OrderCreatedResult>
}) {
  const router = useRouter()
  const { showNotification } = useNotification()
  const [scriptState, setScriptState] = useState<SnapScriptState>("loading")
  const [paymentState, setPaymentState] = useState<PaymentState>({
    kind: "idle",
  })
  const [cartCleanupState, setCartCleanupState] = useState<CartCleanupState>({
    kind: "idle",
  })
  const nextAttemptId = useRef(0)
  const activeAttemptId = useRef<number | null>(null)
  const paymentStateRef = useRef<PaymentState>({ kind: "idle" })
  const cartCleanupTask = useRef<CartCleanupTask | null>(null)
  const normalizedCustomerNote = customerNote.trim() || undefined
  const checkoutKey = JSON.stringify({ addressId, shipping, source })

  function isActiveAttempt(attemptId: number) {
    return activeAttemptId.current === attemptId
  }

  function replacePaymentState(next: PaymentState) {
    paymentStateRef.current = next
    setPaymentState(next)
  }

  function transitionPreparedAttempt(
    attemptId: number,
    transition: (
      current: Extract<PaymentState, { readonly kind: "prepared" }>
    ) => PaymentState
  ) {
    if (!isActiveAttempt(attemptId)) return false

    const current = paymentStateRef.current
    if (current.kind !== "prepared" || current.attemptId !== attemptId) {
      return false
    }

    replacePaymentState(transition(current))
    return true
  }

  async function finishPayment(attemptId: number, orderId: string) {
    const confirmationStarted = transitionPreparedAttempt(attemptId, () => ({
      kind: "confirming",
      attemptId,
      orderId,
    }))
    if (!confirmationStarted) return

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

    const current = paymentStateRef.current
    if (
      !isActiveAttempt(attemptId) ||
      current.kind !== "confirming" ||
      current.attemptId !== attemptId ||
      current.orderId !== orderId
    ) {
      return
    }

    replacePaymentState({ kind: "snap-completed", attemptId, orderId, notice })

    const cleanupTask = cartCleanupTask.current
    const cleanupResult =
      cleanupTask?.attemptId === attemptId && cleanupTask.orderId === orderId
        ? cleanupTask.result
        : undefined

    completePaymentNavigation({
      cleanupResult,
      onCleanupError(message) {
        if (!isActiveAttempt(attemptId)) return

        setCartCleanupState((current) =>
          current.kind === "error" &&
          current.attemptId === attemptId &&
          current.orderId === orderId
            ? { kind: "idle" }
            : current
        )
        showNotification({ variant: "error", message })
      },
      navigate() {
        router.push(`/orders?order=${encodeURIComponent(orderId)}`)
      },
      refresh() {
        router.refresh()
      },
    })
  }

  function openSnap(
    transaction: SnapTransaction,
    transactionCheckoutKey: string,
    attemptId: number
  ) {
    if (!isActiveAttempt(attemptId)) return

    if (!window.snap) {
      replacePaymentState({
        kind: "error",
        attemptId,
        message: "Layanan pembayaran belum selesai dimuat. Coba lagi.",
      })
      return
    }

    replacePaymentState({
      kind: "prepared",
      attemptId,
      transaction,
      checkoutKey: transactionCheckoutKey,
    })
    window.snap.pay(transaction.token, {
      onSuccess() {
        void finishPayment(attemptId, transaction.orderId)
      },
      onPending() {
        transitionPreparedAttempt(attemptId, (current) => ({
          ...current,
          notice: {
            kind: "info",
            message:
              "Instruksi pembayaran sudah dibuat. Selesaikan pembayaran sesuai petunjuk Midtrans.",
          },
        }))
      },
      onError() {
        transitionPreparedAttempt(attemptId, (current) => ({
          ...current,
          notice: {
            kind: "error",
            message: "Pembayaran gagal diproses. Coba metode lain.",
          },
        }))
      },
      onClose() {
        transitionPreparedAttempt(attemptId, (current) => {
          if (current.notice) {
            return current
          }

          return {
            ...current,
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
      openSnap(paymentState.transaction, checkoutKey, paymentState.attemptId)
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

    nextAttemptId.current += 1
    const attemptId = nextAttemptId.current
    activeAttemptId.current = attemptId
    cartCleanupTask.current = null
    setCartCleanupState({ kind: "idle" })
    onPreparingChange(true)
    replacePaymentState({ kind: "requesting", attemptId })

    try {
      const result = await createPaymentAction(input)

      if (!isActiveAttempt(attemptId)) return

      if (result.kind === "error") {
        onPreparingChange(false)
        replacePaymentState({
          kind: "error",
          attemptId,
          message: result.message,
        })
        return
      }

      onOrderPrepared({
        orderId: result.orderId,
        customerNote: result.customerNote,
      })
      const cleanupResult = normalizeOrderCreated(onOrderCreated)
      cartCleanupTask.current = {
        attemptId,
        orderId: result.orderId,
        result: cleanupResult,
      }
      setCartCleanupState({
        kind: "pending",
        attemptId,
        orderId: result.orderId,
      })
      void cleanupResult.then((orderCreatedResult) => {
        if (!isActiveAttempt(attemptId)) return

        if (orderCreatedResult.kind === "error") {
          setCartCleanupState({
            kind: "error",
            attemptId,
            orderId: result.orderId,
            message: orderCreatedResult.message,
          })
          return
        }

        setCartCleanupState({ kind: "idle" })
      })
      openSnap(result, checkoutKey, attemptId)
    } catch {
      if (!isActiveAttempt(attemptId)) return

      onPreparingChange(false)
      replacePaymentState({
        kind: "error",
        attemptId,
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
  const paymentNotice =
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
  const paymentAttemptId =
    paymentState.kind === "idle" ? undefined : paymentState.attemptId
  const cartCleanupNotice =
    cartCleanupState.kind === "error" &&
    cartCleanupState.attemptId === paymentAttemptId
      ? ({
          kind: "error",
          message: cartCleanupState.message,
        } satisfies PaymentNotice)
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
      {paymentNotice && <PaymentNoticeMessage notice={paymentNotice} />}
      {cartCleanupNotice && <PaymentNoticeMessage notice={cartCleanupNotice} />}
    </>
  )
}

function PaymentNoticeMessage({ notice }: { notice: PaymentNotice }) {
  return (
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
  )
}

export { SnapPaymentButton }
