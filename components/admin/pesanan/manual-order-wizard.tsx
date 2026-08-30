"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon } from "@phosphor-icons/react"
import { useForm, useWatch } from "react-hook-form"

import { ManualOrderItemStep } from "@/components/admin/pesanan/manual-order-item-step"
import { ManualOrderReviewStep } from "@/components/admin/pesanan/manual-order-review-step"
import { ManualOrderShippingStep } from "@/components/admin/pesanan/manual-order-shipping-step"
import { ManualOrderStepList } from "@/components/admin/pesanan/manual-order-step-list"
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
  type ManualOrderInput,
  type ManualOrderProduct,
  type ManualOrderStep,
  type ManualOrderValues,
} from "@/lib/admin/manual-order"

type ManualOrderWizardProps = {
  buyers: readonly string[]
  products: readonly ManualOrderProduct[]
}

function ManualOrderWizard({ buyers, products }: ManualOrderWizardProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<ManualOrderStep>("item")
  const form = useForm<ManualOrderInput, unknown, ManualOrderValues>({
    resolver: zodResolver(manualOrderSchema),
    defaultValues: MANUAL_ORDER_DEFAULT_VALUES,
    mode: "onChange",
  })
  const values = useWatch({ control: form.control })
  const product = products.find(({ slug }) => slug === values.productSlug)
  const stepIndex = MANUAL_ORDER_STEP_ORDER.indexOf(step)

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setStep("item")
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

        <form onSubmit={form.handleSubmit(() => {})} className="grid gap-5">
          {step === "item" && (
            <ManualOrderItemStep
              buyers={buyers}
              products={products}
              form={form}
              product={product}
            />
          )}
          {step === "shipping" && <ManualOrderShippingStep form={form} />}
          {step === "review" && (
            <ManualOrderReviewStep values={values} product={product} />
          )}

          <DialogFooter className="sm:flex-wrap">
            <DialogClose render={<Button type="button" variant="outline" />}>
              Batal
            </DialogClose>
            {stepIndex > 0 && (
              <Button type="button" variant="outline" onClick={goBack}>
                <ArrowLeftIcon data-icon="inline-start" />
                Kembali
              </Button>
            )}
            {step === "review" ? (
              <Button type="submit">Buat pesanan</Button>
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
