"use client"

import {
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react"
import { useRouter } from "next/navigation"

import { submitReturnAction } from "@/app/(account)/orders/actions"
import { TextField, SelectField, TextareaField } from "@/components/form/fields"
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
import type { Order } from "@/lib/orders/config"
import { RETURN_REASONS } from "@/lib/returns/config"
import {
  RETURN_PHOTO_LIMITS,
  returnPhotoMimeSchema,
} from "@/lib/returns/schema"
import { formatNumber } from "@/utils/format/intl"

const RETURN_REASON_OPTIONS = Object.entries(RETURN_REASONS).map(
  ([value, label]) => ({ value, label })
)

const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp"

type ReturnFormErrors = {
  reason?: string
  details?: string
  photos?: string
}

type ReturnOrderDialogProps = {
  readonly order: Pick<Order, "id" | "items">
  readonly triggerLabel: string
}

function validateReturnPhotos(files: readonly File[]) {
  if (files.length === 0) {
    return "Pilih minimal satu foto kondisi barang."
  }

  if (files.length > RETURN_PHOTO_LIMITS.count) {
    return `Pilih maksimal ${RETURN_PHOTO_LIMITS.count} foto.`
  }

  if (
    files.some((file) => !returnPhotoMimeSchema.safeParse(file.type).success)
  ) {
    return "Gunakan foto berformat JPEG, PNG, atau WEBP."
  }

  if (files.some((file) => file.size > RETURN_PHOTO_LIMITS.bytes)) {
    return "Ukuran setiap foto maksimal 5 MiB."
  }

  return null
}

function nonEmptyFile(value: FormDataEntryValue): value is File {
  return value instanceof File && value.size > 0
}

function ReturnOrderDialog({ order, triggerLabel }: ReturnOrderDialogProps) {
  const router = useRouter()
  const { showNotification } = useNotification()
  const formRef = useRef<HTMLFormElement>(null)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [photoNames, setPhotoNames] = useState<readonly string[]>([])
  const [errors, setErrors] = useState<ReturnFormErrors>({})
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const idPrefix = order.id.replaceAll("/", "-")
  const reasonId = `return-reason-${idPrefix}`
  const detailsId = `return-details-${idPrefix}`
  const photosId = `return-photos-${idPrefix}`

  function resetForm() {
    formRef.current?.reset()
    setReason("")
    setPhotoNames([])
    setErrors({})
    setActionError(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return

    setOpen(nextOpen)
    if (!nextOpen) resetForm()
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    const error = validateReturnPhotos(files)

    if (error) {
      setPhotoNames([])
      setErrors((current) => ({ ...current, photos: error }))
      event.currentTarget.value = ""
      return
    }

    setPhotoNames(files.map((file) => file.name))
    setErrors((current) => ({ ...current, photos: undefined }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const formData = new FormData(event.currentTarget)
    const nextErrors: ReturnFormErrors = {}
    const submittedReason = formData.get("reason")
    const submittedDetails = formData.get("details")
    const photos = formData.getAll("photos").filter(nonEmptyFile)

    if (
      typeof submittedReason !== "string" ||
      !Object.hasOwn(RETURN_REASONS, submittedReason)
    ) {
      nextErrors.reason = "Pilih alasan retur."
    }

    if (
      typeof submittedDetails !== "string" ||
      submittedDetails.trim().length === 0
    ) {
      nextErrors.details = "Jelaskan kondisi barang dan alasan retur."
    }

    const photoError = validateReturnPhotos(photos)
    if (photoError) nextErrors.photos = photoError

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setActionError(null)
    startTransition(async () => {
      try {
        const result = await submitReturnAction(formData)

        if (result.kind === "error") {
          setActionError(result.message)
          return
        }

        showNotification({
          variant: "success",
          message: "Pengajuan retur berhasil dikirim.",
        })
        setOpen(false)
        resetForm()
        router.refresh()
      } catch {
        setActionError(
          "Pengajuan belum dapat dikonfirmasi. Muat ulang riwayat pesanan sebelum mencoba lagi."
        )
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button type="button" variant="outline" className="h-10" />}
      >
        {triggerLabel}
      </DialogTrigger>

      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ajukan retur barang</DialogTitle>
          <DialogDescription>
            Pengajuan ini berlaku untuk seluruh barang dalam pesanan {order.id}.
          </DialogDescription>
        </DialogHeader>

        <form
          ref={formRef}
          noValidate
          onSubmit={submit}
          className="flex flex-col gap-5"
        >
          <input type="hidden" name="orderId" value={order.id} />

          <div className="border">
            <h3 className="border-b px-3 py-2 text-sm font-medium">
              Barang dalam transaksi
            </h3>
            <ul className="divide-y">
              {order.items.map((item, index) => (
                <li
                  key={`${item.id}-${index}`}
                  className="flex items-start justify-between gap-4 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    {item.variant && (
                      <p className="text-xs text-muted-foreground">
                        {item.variant}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {formatNumber(item.quantity)} barang
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <ul className="flex flex-col gap-1 border-y py-3 text-xs text-muted-foreground">
            <li>
              Pengembalian dana hanya mencakup nilai barang, bukan ongkos kirim.
            </li>
            <li>Biaya pengiriman balik menjadi tanggung jawab pelanggan.</li>
            <li>Ajukan retur dalam 7 hari sejak pesanan ditandai selesai.</li>
          </ul>

          <SelectField
            id={reasonId}
            label="Alasan retur"
            placeholder="Pilih alasan retur"
            options={RETURN_REASON_OPTIONS}
            value={reason}
            name="reason"
            onValueChange={(value) => {
              setReason(value)
              setErrors((current) => ({ ...current, reason: undefined }))
            }}
            error={errors.reason}
            disabled={pending}
          />

          <TextareaField
            id={detailsId}
            label="Rincian kondisi barang"
            placeholder="Jelaskan kondisi barang dan alasan retur"
            rows={4}
            maxLength={2000}
            name="details"
            required
            error={errors.details}
            disabled={pending}
            onChange={() =>
              setErrors((current) => ({ ...current, details: undefined }))
            }
          />

          <div className="flex flex-col gap-2">
            <TextField
              id={photosId}
              label="Foto kondisi barang"
              description="Wajib 1 sampai 4 foto JPEG, PNG, atau WEBP. Maksimal 5 MiB per foto."
              type="file"
              name="photos"
              multiple
              required
              accept={PHOTO_ACCEPT}
              error={errors.photos}
              disabled={pending}
              onChange={handlePhotoChange}
            />
            {photoNames.length > 0 && (
              <ul
                className="text-xs text-muted-foreground"
                aria-label="Foto yang dipilih"
              >
                {photoNames.map((name, index) => (
                  <li key={`${name}-${index}`} className="truncate">
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {actionError && (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          )}

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pending} />
              }
            >
              Batal
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Mengirim..." : "Kirim Pengajuan Retur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { ReturnOrderDialog }
