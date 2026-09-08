"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  refundReturnAction,
  reviewReturnAction,
} from "@/app/admin/orders/actions"
import { useNotification } from "@/components/notification/notification-provider"
import { Badge } from "@/components/ui/badge"
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
import { NumberField, TextField, TextareaField } from "@/components/form/fields"
import {
  REFUND_STATUSES,
  RETURN_REASONS,
  RETURN_STATUSES,
  type AdminReturnRequest,
} from "@/lib/returns/config"
import type { RefundActionInput, ReturnReviewInput } from "@/lib/returns/schema"
import { formatNumber, formatRupiah } from "@/utils/format/intl"

type DecisionKind = "approve" | "reject"
type InspectionInput = Extract<ReturnReviewInput, { kind: "inspect" }>
type InspectionField = "received" | "resellable"
type InspectionDraft = {
  readonly received: string
  readonly resellable: string
}

function createInspectionDrafts(
  items: AdminReturnRequest["items"]
): Record<string, InspectionDraft> {
  const drafts: Record<string, InspectionDraft> = {}

  for (const item of items) {
    drafts[item.id] = {
      received:
        item.receivedQuantity === null ? "" : String(item.receivedQuantity),
      resellable:
        item.resellableQuantity === null ? "" : String(item.resellableQuantity),
    }
  }

  return drafts
}

function parseQuantity(value: string) {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null

  const quantity = Number(trimmed)
  return Number.isSafeInteger(quantity) ? quantity : null
}

function ReturnReviewDialog({
  request,
}: {
  readonly request: AdminReturnRequest
}) {
  const router = useRouter()
  const { showNotification } = useNotification()
  const [open, setOpen] = useState(false)
  const [reviewNote, setReviewNote] = useState("")
  const [noteError, setNoteError] = useState<string | undefined>()
  const [inspectionError, setInspectionError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [refundReference, setRefundReference] = useState("")
  const [referenceError, setReferenceError] = useState<string | undefined>()
  const [inspection, setInspection] = useState(() =>
    createInspectionDrafts(request.items)
  )
  const [pending, startTransition] = useTransition()

  const refund = request.refund
  const idPrefix = request.id.replaceAll("/", "-")
  const noteId = `return-review-note-${idPrefix}`
  const referenceId = `return-refund-reference-${idPrefix}`

  function resetLocalState() {
    setReviewNote("")
    setNoteError(undefined)
    setInspectionError(null)
    setActionError(null)
    setRefundReference("")
    setReferenceError(undefined)
    setInspection(createInspectionDrafts(request.items))
  }

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return

    setOpen(nextOpen)
    resetLocalState()
  }

  function finish(message: string) {
    showNotification({ variant: "success", message })
    setOpen(false)
    router.refresh()
  }

  function runReview(input: ReturnReviewInput, successMessage: string) {
    if (pending) return

    setActionError(null)
    startTransition(async () => {
      try {
        const result = await reviewReturnAction(input)
        if (result.kind === "error") {
          setActionError(result.message)
          return
        }
        finish(successMessage)
      } catch {
        setActionError(
          "Pemeriksaan belum dapat dikonfirmasi. Muat ulang halaman sebelum mencoba lagi."
        )
      }
    })
  }

  function runRefund(input: RefundActionInput, successMessage: string) {
    if (pending) return

    setActionError(null)
    startTransition(async () => {
      try {
        const result = await refundReturnAction(input)
        if (result.kind === "error") {
          setActionError(result.message)
          return
        }
        finish(successMessage)
      } catch {
        setActionError(
          "Status dana belum dapat dipastikan. Periksa status; jangan melakukan pembayaran lain."
        )
      }
    })
  }

  function reviewDecision(kind: DecisionKind) {
    const note = reviewNote.trim()
    if (!note) {
      setNoteError("Catatan admin wajib diisi.")
      return
    }

    setNoteError(undefined)
    const input: ReturnReviewInput =
      kind === "approve"
        ? { kind: "approve", returnId: request.id, note }
        : { kind: "reject", returnId: request.id, note }

    runReview(
      input,
      kind === "approve"
        ? "Pengajuan retur disetujui."
        : "Pengajuan retur ditolak."
    )
  }

  function updateInspection(
    itemId: string,
    field: InspectionField,
    value: string
  ) {
    setInspection((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? { received: "", resellable: "" }),
        [field]: value,
      },
    }))
    setInspectionError(null)
    setActionError(null)
  }

  function inspectReturn() {
    const note = reviewNote.trim()
    if (!note) {
      setNoteError("Catatan admin wajib diisi.")
      return
    }

    const items: InspectionInput["items"] = []
    let valid = request.items.length > 0

    for (const item of request.items) {
      const draft = inspection[item.id] ?? { received: "", resellable: "" }
      const receivedQuantity = parseQuantity(draft.received)
      const resellableQuantity = parseQuantity(draft.resellable)

      if (
        receivedQuantity === null ||
        receivedQuantity !== item.quantity ||
        resellableQuantity === null ||
        resellableQuantity > receivedQuantity
      ) {
        valid = false
      }

      if (receivedQuantity !== null && resellableQuantity !== null) {
        items.push({
          id: item.id,
          receivedQuantity,
          resellableQuantity,
        })
      }
    }

    if (!valid || items.length !== request.items.length) {
      setInspectionError(
        "Semua jumlah yang diminta harus diterima secara fisik. Isi jumlah layak dijual kembali untuk setiap barang."
      )
      return
    }

    setNoteError(undefined)
    setInspectionError(null)
    const input: ReturnReviewInput = {
      kind: "inspect",
      returnId: request.id,
      note,
      items,
    }
    runReview(input, "Pemeriksaan retur berhasil disimpan.")
  }

  function reconcileRefund() {
    const input: RefundActionInput = {
      kind: "reconcile",
      returnId: request.id,
    }
    runRefund(input, "Status pengembalian dana diperbarui.")
  }

  function retryRefund() {
    const input: RefundActionInput = {
      kind: "refund",
      returnId: request.id,
    }
    runRefund(input, "Pengembalian dana diproses.")
  }

  function confirmOfflineRefund() {
    const reference = refundReference.trim()
    if (!reference) {
      setReferenceError("Nomor referensi transfer wajib diisi.")
      return
    }

    setReferenceError(undefined)
    const input: RefundActionInput = {
      kind: "confirm-offline",
      returnId: request.id,
      reference,
    }
    runRefund(input, "Pengembalian dana transfer manual dikonfirmasi.")
  }

  const closeButton = (
    <DialogClose
      render={<Button type="button" variant="outline" disabled={pending} />}
    >
      Tutup
    </DialogClose>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Tinjau retur
      </DialogTrigger>

      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tinjau pengajuan retur</DialogTitle>
          <DialogDescription>
            Pesanan <span className="font-mono">{request.orderId}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <dl className="grid gap-3 border-y py-3 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-xs text-muted-foreground">Status pengajuan</dt>
            <dd className="sm:text-right">
              <Badge>{RETURN_STATUSES[request.status]}</Badge>
            </dd>

            <dt className="text-xs text-muted-foreground">Alasan retur</dt>
            <dd className="sm:text-right">{RETURN_REASONS[request.reason]}</dd>
          </dl>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Rincian pelanggan</h3>
            <p className="border p-3 text-sm whitespace-pre-wrap">
              {request.details}
            </p>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                Foto lampiran
              </p>
              {request.photos.length > 0 ? (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {request.photos.map((photo, index) => (
                    <li key={photo.id}>
                      <a
                        href={photo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-4 hover:text-primary"
                      >
                        Buka foto {index + 1}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tidak ada foto terlampir.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Barang yang diretur</h3>
            <ul className="divide-y border">
              {request.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Diminta {formatNumber(item.quantity)} barang
                    </p>
                  </div>
                  <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-right text-xs">
                    <dt className="text-muted-foreground">Diterima</dt>
                    <dd>
                      {item.receivedQuantity === null
                        ? "Belum diperiksa"
                        : formatNumber(item.receivedQuantity)}
                    </dd>
                    <dt className="text-muted-foreground">Layak dijual</dt>
                    <dd>
                      {item.resellableQuantity === null
                        ? "Belum diperiksa"
                        : formatNumber(item.resellableQuantity)}
                    </dd>
                  </dl>
                </li>
              ))}
            </ul>
          </div>

          {request.note !== null && (
            <div className="border-l-2 border-border pl-3">
              <p className="text-xs font-medium">Catatan admin</p>
              <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
                {request.note}
              </p>
            </div>
          )}

          {refund && (
            <div className="flex flex-col gap-3 border p-3">
              <h3 className="text-sm font-medium">Pengembalian dana</h3>
              <dl className="grid gap-2 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="text-xs text-muted-foreground">Jumlah</dt>
                <dd className="font-medium tabular-nums sm:text-right">
                  {formatRupiah(refund.amount)}
                </dd>
                <dt className="text-xs text-muted-foreground">Metode</dt>
                <dd className="sm:text-right">
                  {refund.method === "midtrans"
                    ? "Midtrans"
                    : "Transfer manual"}
                </dd>
                <dt className="text-xs text-muted-foreground">Status dana</dt>
                <dd className="sm:text-right">
                  <Badge variant="outline">
                    {REFUND_STATUSES[refund.status]}
                  </Badge>
                </dd>
                {refund.reference !== null && (
                  <>
                    <dt className="text-xs text-muted-foreground">Referensi</dt>
                    <dd className="font-mono text-xs break-all sm:text-right">
                      {refund.reference}
                    </dd>
                  </>
                )}
              </dl>
              {(refund.lastError !== null || refund.status === "blocked") && (
                <p className="text-sm text-muted-foreground" role="status">
                  {refund.status === "blocked"
                    ? "Pengembalian dana memerlukan pemeriksaan admin. Periksa status penyedia pembayaran sebelum menentukan penyelesaian. Pengiriman ulang dinonaktifkan."
                    : "Terjadi kendala saat menghubungi penyedia pembayaran. Periksa statusnya sebelum mencoba lagi."}
                </p>
              )}
            </div>
          )}

          {request.status === "requested" && (
            <form
              onSubmit={(event) => event.preventDefault()}
              className="flex flex-col gap-4"
            >
              <TextareaField
                id={noteId}
                label="Catatan admin"
                placeholder="Tulis alasan keputusan"
                rows={4}
                maxLength={2000}
                value={reviewNote}
                required
                disabled={pending}
                error={noteError}
                onChange={(event) => {
                  setReviewNote(event.target.value)
                  setNoteError(undefined)
                  setActionError(null)
                }}
              />
              {actionError && (
                <p role="alert" className="text-sm text-destructive">
                  {actionError}
                </p>
              )}
              <DialogFooter>
                {closeButton}
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => reviewDecision("reject")}
                  disabled={pending}
                >
                  {pending ? "Menyimpan..." : "Tolak"}
                </Button>
                <Button
                  type="button"
                  onClick={() => reviewDecision("approve")}
                  disabled={pending}
                >
                  {pending ? "Menyimpan..." : "Setujui"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {request.status === "approved" && (
            <form
              onSubmit={(event) => event.preventDefault()}
              className="flex flex-col gap-4"
            >
              <TextareaField
                id={noteId}
                label="Catatan pemeriksaan"
                placeholder="Tulis hasil pemeriksaan"
                rows={4}
                maxLength={2000}
                value={reviewNote}
                required
                disabled={pending}
                error={noteError}
                onChange={(event) => {
                  setReviewNote(event.target.value)
                  setNoteError(undefined)
                  setActionError(null)
                }}
              />

              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-medium">Pemeriksaan barang</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pastikan seluruh jumlah yang diminta sudah diterima secara
                    fisik. Masukkan jumlah yang masih layak dijual kembali.
                  </p>
                </div>
                <ul className="flex flex-col gap-3">
                  {request.items.map((item) => {
                    const draft = inspection[item.id] ?? {
                      received: "",
                      resellable: "",
                    }

                    return (
                      <li key={item.id} className="border p-3">
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Jumlah diminta: {formatNumber(item.quantity)}
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <NumberField
                            id={`return-received-${idPrefix}-${item.id}`}
                            label="Jumlah diterima"
                            suffix="barang"
                            min={0}
                            max={item.quantity}
                            step={1}
                            value={draft.received}
                            required
                            disabled={pending}
                            onChange={(event) =>
                              updateInspection(
                                item.id,
                                "received",
                                event.target.value
                              )
                            }
                          />
                          <NumberField
                            id={`return-resellable-${idPrefix}-${item.id}`}
                            label="Layak dijual kembali"
                            suffix="barang"
                            min={0}
                            max={item.quantity}
                            step={1}
                            value={draft.resellable}
                            required
                            disabled={pending}
                            onChange={(event) =>
                              updateInspection(
                                item.id,
                                "resellable",
                                event.target.value
                              )
                            }
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {inspectionError && (
                <p role="alert" className="text-sm text-destructive">
                  {inspectionError}
                </p>
              )}
              {actionError && (
                <p role="alert" className="text-sm text-destructive">
                  {actionError}
                </p>
              )}
              <DialogFooter>
                {closeButton}
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => reviewDecision("reject")}
                  disabled={pending}
                >
                  {pending ? "Menyimpan..." : "Tolak"}
                </Button>
                <Button
                  type="button"
                  onClick={inspectReturn}
                  disabled={pending}
                >
                  {pending ? "Menyimpan..." : "Simpan pemeriksaan"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {request.status === "inspected" && (
            <div className="flex flex-col gap-4">
              {!refund && (
                <p className="text-sm text-muted-foreground">
                  Siapkan pengembalian nilai barang. Ongkos kirim tidak
                  dikembalikan.
                </p>
              )}

              {(!refund ||
                (refund.method === "midtrans" &&
                  refund.status === "ready")) && (
                <DialogFooter>
                  {closeButton}
                  <Button
                    type="button"
                    onClick={retryRefund}
                    disabled={pending}
                  >
                    {pending ? "Memproses..." : "Kembalikan dana"}
                  </Button>
                </DialogFooter>
              )}

              {refund?.method === "midtrans" &&
                (refund.status === "pending" ||
                  refund.status === "blocked") && (
                  <DialogFooter>
                    {closeButton}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={reconcileRefund}
                      disabled={pending}
                    >
                      {pending ? "Memeriksa..." : "Periksa status"}
                    </Button>
                    {refund.status === "pending" && (
                      <Button
                        type="button"
                        onClick={retryRefund}
                        disabled={pending}
                      >
                        {pending ? "Memproses..." : "Coba lagi"}
                      </Button>
                    )}
                  </DialogFooter>
                )}

              {refund?.method === "offline" && refund.status === "ready" && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    confirmOfflineRefund()
                  }}
                  className="flex flex-col gap-4"
                >
                  <p className="text-sm text-muted-foreground">
                    Lakukan transfer sejumlah di atas kepada pelanggan. Masukkan
                    nomor referensi transfer sebagai bukti sebelum konfirmasi.
                  </p>
                  <TextField
                    id={referenceId}
                    label="Nomor referensi transfer"
                    placeholder="Masukkan nomor referensi"
                    maxLength={500}
                    value={refundReference}
                    required
                    disabled={pending}
                    error={referenceError}
                    onChange={(event) => {
                      setRefundReference(event.target.value)
                      setReferenceError(undefined)
                      setActionError(null)
                    }}
                  />
                  {actionError && (
                    <p role="alert" className="text-sm text-destructive">
                      {actionError}
                    </p>
                  )}
                  <DialogFooter>
                    {closeButton}
                    <Button type="submit" disabled={pending}>
                      {pending ? "Menyimpan..." : "Konfirmasi transfer"}
                    </Button>
                  </DialogFooter>
                </form>
              )}

              {refund &&
                !(
                  (refund.method === "midtrans" && refund.status === "ready") ||
                  (refund.method === "midtrans" &&
                    (refund.status === "pending" ||
                      refund.status === "blocked")) ||
                  (refund.method === "offline" && refund.status === "ready")
                ) && <DialogFooter>{closeButton}</DialogFooter>}
              {actionError && refund?.method !== "offline" && (
                <p role="alert" className="text-sm text-destructive">
                  {actionError}
                </p>
              )}
            </div>
          )}

          {request.status === "rejected" && (
            <DialogFooter>{closeButton}</DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { ReturnReviewDialog }
