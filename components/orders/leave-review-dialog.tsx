"use client"

import { useEffect, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { StarIcon, TrashIcon, UploadSimpleIcon } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"

import { TextareaField } from "@/components/form/fields"
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
import type { OrderItem } from "@/lib/orders/config"
import {
  reviewFinalizeResponseSchema,
  reviewFormSchema,
  reviewUploadIntentResponseSchema,
  validateReviewMedia,
  type ReviewFormValues,
} from "@/lib/reviews/schema"
import { cn } from "@/lib/utils"

type SubmissionState =
  | { readonly kind: "idle" }
  | { readonly kind: "requesting-upload" }
  | { readonly kind: "uploading"; readonly progress: number }
  | { readonly kind: "processing" }
  | { readonly kind: "success" }
  | { readonly kind: "error"; readonly message: string }

type Preview = { readonly file: File; readonly url: string }

export function LeaveReviewDialog({
  orderId,
  items,
  triggerLabel,
}: {
  readonly orderId: string
  readonly items: readonly OrderItem[]
  readonly triggerLabel: string
}) {
  const eligible = items.filter((item) => !item.reviewed)
  const [remaining, setRemaining] = useState(eligible.map(({ id }) => id))
  const [open, setOpen] = useState(false)
  const [previews, setPreviews] = useState<Preview[]>([])
  const [state, setState] = useState<SubmissionState>({ kind: "idle" })
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const previewsRef = useRef(previews)
  const router = useRouter()
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: { orderItemId: eligible[0]?.id ?? "", rating: 0, body: "" },
  })
  useEffect(() => {
    previewsRef.current = previews
  }, [previews])
  const selectedRating = useWatch({ control: form.control, name: "rating" })
  const busy =
    state.kind === "requesting-upload" ||
    state.kind === "uploading" ||
    state.kind === "processing"
  const currentItems = eligible.filter((item) => remaining.includes(item.id))

  useEffect(
    () => () => {
      xhrRef.current?.abort()
      for (const preview of previewsRef.current)
        URL.revokeObjectURL(preview.url)
    },
    []
  )

  function clearMedia() {
    for (const preview of previewsRef.current) URL.revokeObjectURL(preview.url)
    setPreviews([])
  }
  function addFiles(files: readonly File[]) {
    const combined = [...previewsRef.current.map(({ file }) => file), ...files]
    const result = validateReviewMedia(
      combined.map((file) => ({ mime: file.type, size: file.size }))
    )
    if (result.kind !== "valid") {
      setState({ kind: "error", message: result.message })
      return
    }
    setPreviews((value) => [
      ...value,
      ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ])
    setState({ kind: "idle" })
  }
  function removeFile(index: number) {
    setPreviews((value) => {
      const target = value[index]
      if (target) URL.revokeObjectURL(target.url)
      return value.filter((_, itemIndex) => itemIndex !== index)
    })
  }
  function resetFor(nextRemaining: readonly string[]) {
    clearMedia()
    form.reset({ orderItemId: nextRemaining[0] ?? "", rating: 0, body: "" })
  }

  function uploadImage({
    file,
    uploadUrl,
    headers,
    completedBytes,
    totalBytes,
  }: {
    readonly file: File
    readonly uploadUrl: string
    readonly headers: Readonly<Record<string, string>>
    readonly completedBytes: number
    readonly totalBytes: number
  }) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhrRef.current = xhr
      xhr.open("PUT", uploadUrl)
      for (const [name, value] of Object.entries(headers)) {
        xhr.setRequestHeader(name, value)
      }
      xhr.upload.addEventListener("progress", (event) => {
        setState({
          kind: "uploading",
          progress: Math.round(
            ((completedBytes + Math.min(event.loaded, file.size)) /
              totalBytes) *
              100
          ),
        })
      })
      xhr.addEventListener("load", () => {
        xhrRef.current = null
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error("B2 upload failed."))
      })
      xhr.addEventListener("error", () => reject(new Error("Upload failed.")))
      xhr.addEventListener("abort", () => reject(new Error("Upload aborted.")))
      xhr.send(file)
    })
  }

  async function submitReview(values: ReviewFormValues) {
    if (busy) return
    const files = previews.map(({ file }) => file)
    const limits = validateReviewMedia(
      files.map((file) => ({ mime: file.type, size: file.size }))
    )
    if (limits.kind !== "valid") {
      setState({ kind: "error", message: limits.message })
      return
    }

    try {
      let uploadToken: string | null = null
      if (files.length > 0) {
        setState({ kind: "requesting-upload" })
        const intentResponse = await fetch(
          `/api/account/orders/${encodeURIComponent(orderId)}/reviews/uploads`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderItemId: values.orderItemId,
              files: files.map((file) => ({
                mime: file.type,
                size: file.size,
              })),
            }),
          }
        )
        const intentPayload: unknown = await intentResponse.json()
        const intent = reviewUploadIntentResponseSchema.safeParse(intentPayload)
        if (!intentResponse.ok || !intent.success) {
          throw new Error("Unggahan gambar tidak dapat disiapkan.")
        }
        uploadToken = intent.data.uploadToken
        const totalBytes = files.reduce((total, file) => total + file.size, 0)
        let completedBytes = 0
        for (const [index, file] of files.entries()) {
          const upload = intent.data.uploads[index]
          if (!upload) throw new Error("Data unggahan gambar tidak lengkap.")
          await uploadImage({
            file,
            uploadUrl: upload.uploadUrl,
            headers: upload.headers,
            completedBytes,
            totalBytes,
          })
          completedBytes += file.size
        }
      }

      setState({ kind: "processing" })
      const response = await fetch(
        `/api/account/orders/${encodeURIComponent(orderId)}/reviews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderItemId: values.orderItemId,
            rating: values.rating,
            body: values.body.trim(),
            uploadToken,
          }),
        }
      )
      const payload: unknown = await response.json()
      const parsed = reviewFinalizeResponseSchema.safeParse(payload)
      if (!parsed.success) throw new Error("Respons server tidak valid.")
      if (parsed.data.kind === "error") {
        throw new Error(parsed.data.error)
      }
      if (!response.ok) throw new Error("Ulasan tidak dapat dikirim.")
      const created = parsed.data

      const next = remaining.filter((id) => id !== created.orderItemId)
      setRemaining(next)
      setState({ kind: "success" })
      resetFor(next)
      router.refresh()
    } catch (error) {
      xhrRef.current = null
      setState({
        kind: "error",
        message:
          error instanceof Error && error.message !== "Upload failed."
            ? error.message
            : "Koneksi terputus. Coba lagi.",
      })
    }
  }

  // React Hook Form invokes this callback only after a submit event.
  // eslint-disable-next-line react-hooks/refs
  const submit = form.handleSubmit(submitReview)

  if (eligible.length === 0)
    return (
      <Button type="button" variant="outline" className="h-10" disabled>
        Ulasan Dikirim
      </Button>
    )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          setOpen(next)
          if (!next) setState({ kind: "idle" })
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" className="h-10" />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Beri ulasan</DialogTitle>
          <DialogDescription>
            Pesanan <span className="font-mono">{orderId}</span>. Ulasan dibuat
            per barang.
          </DialogDescription>
        </DialogHeader>
        {currentItems.length === 0 ? (
          <div className="py-6 text-center">
            <p className="font-medium">Semua ulasan berhasil dikirim.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Terima kasih sudah membagikan pengalaman Anda.
            </p>
          </div>
        ) : (
          <form
            id={`review-${orderId}`}
            onSubmit={submit}
            className="flex flex-col gap-5"
          >
            {currentItems.length > 1 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">Pilih barang</legend>
                {currentItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer gap-3 border p-3"
                  >
                    <input
                      type="radio"
                      value={item.id}
                      {...form.register("orderItemId")}
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {item.name}
                      </span>
                      {item.variant && (
                        <span className="block text-xs text-muted-foreground">
                          Varian: {item.variant}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            {currentItems.length === 1 && (
              <div className="border p-3">
                <p className="text-sm font-medium">{currentItems[0]?.name}</p>
                {currentItems[0]?.variant && (
                  <p className="text-xs text-muted-foreground">
                    Varian: {currentItems[0].variant}
                  </p>
                )}
              </div>
            )}
            <fieldset>
              <legend className="mb-2 text-sm font-medium">
                Nilai bintang
              </legend>
              <div
                className="flex gap-1"
                role="radiogroup"
                aria-label="Nilai ulasan 1 sampai 5 bintang"
              >
                <Controller
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <>
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <label key={rating} className="cursor-pointer">
                          <input
                            ref={field.ref}
                            className="sr-only"
                            type="radio"
                            name={field.name}
                            value={rating}
                            checked={field.value === rating}
                            onBlur={field.onBlur}
                            onChange={() => field.onChange(rating)}
                          />
                          <StarIcon
                            weight={
                              selectedRating >= rating ? "fill" : "regular"
                            }
                            className={cn(
                              "size-8",
                              selectedRating >= rating && "text-chart-2"
                            )}
                          />
                          <span className="sr-only">{rating} bintang</span>
                        </label>
                      ))}
                    </>
                  )}
                />
              </div>
              {form.formState.errors.rating && (
                <p role="alert" className="mt-1 text-sm text-destructive">
                  {form.formState.errors.rating.message}
                </p>
              )}
            </fieldset>
            <TextareaField
              id={`review-body-${orderId}`}
              label="Ulasan"
              placeholder="Ceritakan kualitas produk dan pengalaman Anda..."
              maxLength={1000}
              rows={5}
              error={form.formState.errors.body?.message}
              {...form.register("body")}
            />
            <div>
              <label
                className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed p-4 text-sm"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  addFiles(Array.from(event.dataTransfer.files))
                }}
              >
                <UploadSimpleIcon className="size-5" aria-hidden />
                <span>Tambah gambar</span>
                <span className="text-xs text-muted-foreground">
                  Maksimal 4 gambar, masing-masing 5 MiB
                </span>
                <input
                  type="file"
                  className="sr-only"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Pilih gambar ulasan"
                  onChange={(event) => {
                    addFiles(Array.from(event.target.files ?? []))
                    event.target.value = ""
                  }}
                />
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {previews.map((preview, index) => (
                  <div key={preview.url} className="relative border bg-muted">
                    <img // eslint-disable-line @next/next/no-img-element
                      src={preview.url}
                      alt={`Pratinjau gambar ${index + 1}`}
                      className="aspect-square size-full object-cover"
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="secondary"
                      className="absolute top-1 right-1"
                      aria-label={`Hapus lampiran ${index + 1}`}
                      onClick={() => removeFile(index)}
                    >
                      <TrashIcon aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div aria-live="polite">
              {state.kind === "requesting-upload" && (
                <p>Menyiapkan unggahan…</p>
              )}
              {state.kind === "uploading" && (
                <div>
                  <p className="text-sm">
                    Mengunggah gambar… {state.progress}%
                  </p>
                  <div
                    role="progressbar"
                    aria-label="Progres unggah gambar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={state.progress}
                    className="mt-1 h-2 bg-muted"
                  >
                    <span
                      className="block h-full bg-primary"
                      style={{ width: `${state.progress}%` }}
                    />
                  </div>
                </div>
              )}
              {state.kind === "processing" && (
                <p>Memproses gambar dan menyimpan ulasan…</p>
              )}
              {state.kind === "success" && <p>Ulasan berhasil dikirim.</p>}
              {state.kind === "error" && (
                <p role="alert" className="text-destructive">
                  {state.message}
                </p>
              )}
            </div>
          </form>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={busy} />}>
            {currentItems.length === 0 ? "Tutup" : "Batal"}
          </DialogClose>
          {currentItems.length > 0 && (
            <Button type="submit" form={`review-${orderId}`} disabled={busy}>
              {busy ? "Mengirim..." : "Kirim Ulasan"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
