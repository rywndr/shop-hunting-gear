"use client"

import { useRef, useState, useTransition } from "react"
import { SpinnerGapIcon, TruckIcon } from "@phosphor-icons/react"

import { ShipmentTrackingDetails } from "@/components/orders/shipment-tracking-details"
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
import type { ShipmentTrackingActionResult } from "@/lib/shipping/schema"
import { readShipmentTrackingResponse } from "@/lib/shipping/tracking-client"
import { cn } from "@/lib/utils"

type TrackingAudience = "admin" | "customer"

type ShipmentTrackingDialogProps = {
  readonly orderId: string
  readonly audience: TrackingAudience
  readonly className?: string
}

type DialogState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | ShipmentTrackingActionResult

async function requestOrderTracking({
  audience,
  orderId,
}: {
  readonly audience: TrackingAudience
  readonly orderId: string
}): Promise<ShipmentTrackingActionResult> {
  const route =
    audience === "admin"
      ? `/api/admin/orders/${encodeURIComponent(orderId)}/tracking`
      : `/api/account/orders/${encodeURIComponent(orderId)}/tracking`
  const response = await fetch(route, { method: "GET", cache: "no-store" })

  return readShipmentTrackingResponse(response)
}

function ShipmentTrackingDialog({
  orderId,
  audience,
  className,
}: ShipmentTrackingDialogProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<DialogState>({ kind: "idle" })
  const [, startTransition] = useTransition()
  const requestSequence = useRef(0)

  function requestTracking() {
    const sequence = requestSequence.current + 1
    requestSequence.current = sequence
    setState({ kind: "loading" })

    startTransition(async () => {
      let result: ShipmentTrackingActionResult

      try {
        result = await requestOrderTracking({ audience, orderId })
      } catch {
        result = {
          kind: "error",
          message: "Pelacakan belum dapat dimuat. Coba lagi.",
        }
      }

      if (requestSequence.current === sequence) {
        setState(result)
      }
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)

    if (nextOpen) {
      requestTracking()
    } else {
      requestSequence.current += 1
      setState({ kind: "idle" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant={audience === "customer" ? "default" : "outline"}
            size={audience === "admin" ? "sm" : "default"}
            className={cn(audience === "customer" && "h-10", className)}
          />
        }
      >
        <TruckIcon data-icon="inline-start" />
        Lacak Pengiriman
      </DialogTrigger>

      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lacak Pengiriman</DialogTitle>
          <DialogDescription>
            Status terbaru untuk pesanan{" "}
            <span className="font-mono">{orderId}</span>.
          </DialogDescription>
        </DialogHeader>

        {state.kind === "loading" ? (
          <div
            className="flex min-h-40 flex-col items-center justify-center gap-3 text-center"
            role="status"
            aria-live="polite"
          >
            <SpinnerGapIcon className="size-6 animate-spin" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Memuat status pengiriman...
            </p>
          </div>
        ) : state.kind === "success" ? (
          <ShipmentTrackingDetails tracking={state.data} />
        ) : state.kind === "error" ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-4 text-center">
            <p role="alert" className="max-w-md text-sm text-destructive">
              {state.message}
            </p>
            <Button type="button" variant="outline" onClick={requestTracking}>
              Coba lagi
            </Button>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Data pelacakan belum tersedia.
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Tutup
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ShipmentTrackingDialog }
