"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon } from "@phosphor-icons/react"
import { useForm, useWatch } from "react-hook-form"

import { ManualOrderItemStep } from "@/components/admin/orders/manual-order-item-step"
import { ManualOrderReviewStep } from "@/components/admin/orders/manual-order-review-step"
import { ManualOrderShippingStep } from "@/components/admin/orders/manual-order-shipping-step"
import { ManualOrderStepList } from "@/components/admin/orders/manual-order-step-list"
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
import {
  MANUAL_ORDER_DEFAULT_VALUES,
  MANUAL_ORDER_STEP_FIELDS,
  MANUAL_ORDER_STEP_ORDER,
  manualOrderSchema,
  type ManualOrderCustomer,
  type ManualOrderInput,
  type ManualOrderProduct,
  type ManualOrderStep,
  type ManualOrderValues,
} from "@/lib/admin/manual-order"

type ManualOrderWizardProps = {
  customers: readonly ManualOrderCustomer[]
  products: readonly ManualOrderProduct[]
}

function ManualOrderWizard({ customers, products }: ManualOrderWizardProps) {
  const router = useRouter()
  const { showNotification } = useNotification()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<ManualOrderStep>("item")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<ManualOrderInput, unknown, ManualOrderValues>({
    resolver: zodResolver(manualOrderSchema),
    defaultValues: MANUAL_ORDER_DEFAULT_VALUES,
    mode: "onChange",
  })
  const values = useWatch({ control: form.control })
  const customer = customers.find(({ id }) => id === values.customerId)
  const product = products.find(({ slug }) => slug === values.productSlug)
  const stepIndex = MANUAL_ORDER_STEP_ORDER.indexOf(step)

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return

    setOpen(nextOpen)
    if (!nextOpen) {
      setStep("item")
      setError(null)
      form.reset(MANUAL_ORDER_DEFAULT_VALUES)
    }
  }

  async function goForward() {
    const valid = await form.trigger(MANUAL_ORDER_STEP_FIELDS[step])
    if (!valid) return

    const nextStep = MANUAL_ORDER_STEP_ORDER[stepIndex + 1]
    if (nextStep) setStep(nextStep)
  }

  function goBack() {
    const previousStep = MANUAL_ORDER_STEP_ORDER[stepIndex - 1]
    if (previousStep) setStep(previousStep)
  }

  function submit(submitted: ManualOrderValues) {
    setError(null)
    startTransition(async () => {
      const { createManualOrderAction } =
        await import("@/app/admin/orders/actions")
      const result = await createManualOrderAction(submitted)

      if (result.kind === "error") {
        setError(result.message)
        return
      }

      showNotification({ variant: "success", message: "Pesanan berhasil dibuat." })
      setOpen(false)
      setStep("item")
      form.reset(MANUAL_ORDER_DEFAULT_VALUES)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="lg" className="w-full sm:w-auto" />}>
        <PlusIcon data-icon="inline-start" />
        Buat pesanan
      </DialogTrigger>

      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buat pesanan manual</DialogTitle>
          <DialogDescription>
            Gunakan ongkos kirim yang sudah dikonfirmasi kepada pelanggan.
          </DialogDescription>
        </DialogHeader>

        <ManualOrderStepList current={step} />

        <form onSubmit={form.handleSubmit(submit)} className="grid gap-5">
          {step === "item" && (
            <ManualOrderItemStep
              customers={customers}
              products={products}
              form={form}
              product={product}
            />
          )}
          {step === "shipping" && <ManualOrderShippingStep form={form} />}
          {step === "review" && (
            <ManualOrderReviewStep
              values={values}
              customer={customer}
              product={product}
            />
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="sm:flex-wrap">
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pending} />
              }
            >
              Batal
            </DialogClose>
            {stepIndex > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={pending}
              >
                <ArrowLeftIcon data-icon="inline-start" />
                Kembali
              </Button>
            )}
            {step === "review" ? (
              <Button type="submit" disabled={pending}>
                {pending ? "Membuat..." : "Buat pesanan"}
              </Button>
            ) : (
              <Button type="button" onClick={goForward}>
                Lanjut
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { ManualOrderWizard }
