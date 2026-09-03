"use client"

import { useState, useTransition } from "react"
import { MagnifyingGlassIcon, SpinnerGapIcon } from "@phosphor-icons/react"

import { AdminCard } from "@/components/admin/admin-card"
import { ShipmentTrackingDetails } from "@/components/orders/shipment-tracking-details"
import { TextField, SelectField } from "@/components/form/fields"
import { Button } from "@/components/ui/button"
import {
  RAJA_ONGKIR_TRACKING_COURIERS,
  type RajaOngkirTrackingCourierCode,
} from "@/lib/shipping/config"
import { TRACKING_MAX_LENGTH, TRACKING_PLACEHOLDER } from "@/lib/admin/shipment"
import type { CustomTrackingRequest } from "@/lib/shipping/tracking"
import { readShipmentTrackingResponse } from "@/lib/shipping/tracking-client"
import type { ShipmentTrackingActionResult } from "@/lib/shipping/schema"

type LookupState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | ShipmentTrackingActionResult

const COURIER_OPTIONS = RAJA_ONGKIR_TRACKING_COURIERS.map(
  ({ code, label }) => ({ value: code, label })
) satisfies readonly {
  value: RajaOngkirTrackingCourierCode
  label: string
}[]

async function requestCustomTracking(input: CustomTrackingRequest) {
  const response = await fetch("/api/admin/tracking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  })

  return readShipmentTrackingResponse(response)
}

function TrackingLookupForm() {
  const [awb, setAwb] = useState("")
  const [courier, setCourier] = useState("")
  const [lastPhoneNumber, setLastPhoneNumber] = useState("")
  const [detailsRequired, setDetailsRequired] = useState(false)
  const [state, setState] = useState<LookupState>({ kind: "idle" })
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (detailsRequired && (!courier || !lastPhoneNumber)) {
      setState({
        kind: "error",
        message:
          "Pilih jasa kirim dan masukkan 5 digit terakhir nomor telepon penerima.",
      })
      return
    }

    setState({ kind: "loading" })

    const input: CustomTrackingRequest = detailsRequired
      ? { awb, courier, lastPhoneNumber }
      : { awb }

    startTransition(async () => {
      let result: ShipmentTrackingActionResult

      try {
        result = await requestCustomTracking(input)
      } catch {
        result = {
          kind: "error",
          message: "Pelacakan belum dapat dimuat. Coba lagi.",
        }
      }

      if (result.kind === "needs-details") {
        setDetailsRequired(true)
        setAwb(result.awb)
      } else if (result.kind === "success") {
        setDetailsRequired(false)
      }
      setState(result)
    })
  }

  const error = state.kind === "error" ? state.message : undefined
  const tracking = state.kind === "success" ? state.data : undefined

  return (
    <AdminCard
      title="Cari nomor resi"
      description="Masukkan resi untuk melihat status terbaru dari RajaOngkir."
      className="max-w-2xl"
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          id="nomor-resi"
          label="Nomor Resi"
          placeholder={TRACKING_PLACEHOLDER}
          value={awb}
          onChange={(event) => {
            setAwb(event.target.value)
            setDetailsRequired(false)
            setCourier("")
            setLastPhoneNumber("")
            setState({ kind: "idle" })
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={TRACKING_MAX_LENGTH}
          disabled={pending}
          error={error}
        />

        {detailsRequired && (
          <div className="flex flex-col gap-5 border-t pt-5">
            <p className="text-sm text-muted-foreground">
              Resi ini tidak ditemukan pada pesanan lokal. RajaOngkir meminta
              jasa kirim dan 5 digit terakhir nomor telepon penerima untuk
              melacak resi yang tidak terkait pesanan.
            </p>
            <SelectField
              id="jasa-kirim-pelacakan"
              label="Jasa kirim"
              placeholder="Pilih jasa kirim"
              options={COURIER_OPTIONS}
              value={courier}
              onValueChange={setCourier}
              disabled={pending}
            />
            <TextField
              id="nomor-telepon-terakhir"
              label="5 digit terakhir nomor telepon"
              description="Masukkan angka saja, tanpa spasi atau tanda baca."
              value={lastPhoneNumber}
              onChange={(event) =>
                setLastPhoneNumber(
                  event.target.value.replace(/\D/g, "").slice(0, 5)
                )
              }
              inputMode="numeric"
              maxLength={5}
              autoComplete="off"
              disabled={pending}
              error={error}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <SpinnerGapIcon
                className="animate-spin"
                data-icon="inline-start"
                aria-hidden
              />
            ) : (
              <MagnifyingGlassIcon data-icon="inline-start" aria-hidden />
            )}
            {pending ? "Melacak..." : "Lacak"}
          </Button>
          {state.kind === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}
        </div>
      </form>

      {tracking && (
        <div className="mt-6 border-t pt-6">
          <ShipmentTrackingDetails tracking={tracking} />
        </div>
      )}
    </AdminCard>
  )
}

export { TrackingLookupForm }
