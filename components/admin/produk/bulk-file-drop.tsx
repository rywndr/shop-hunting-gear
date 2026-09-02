"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowClockwiseIcon,
  FileXlsIcon,
  TrashIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react"

import { BulkResultTable } from "@/components/admin/produk/bulk-result-table"
import { Button } from "@/components/ui/button"
import {
  bulkImportHref,
  BULK_FILE_FORMATS,
  BULK_IMPORT_FIELD,
  type BulkMode,
} from "@/lib/admin/bulk"
import { MAX_XLSX_BYTES, XLSX_EXTENSION } from "@/lib/admin/product-bulk/limits"
import {
  bulkImportErrorSchema,
  bulkImportSummarySchema,
  type BulkImportSummary,
} from "@/lib/admin/product-bulk/types"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/utils/format/intl"

const MAX_MEGABYTES = Math.floor(MAX_XLSX_BYTES / (1024 * 1024))

type ImportState =
  | { readonly kind: "idle" }
  | { readonly kind: "uploading"; readonly progress: number }
  | { readonly kind: "processing" }
  | { readonly kind: "done"; readonly summary: BulkImportSummary }
  | { readonly kind: "error"; readonly message: string }

function stateLabel(state: ImportState) {
  switch (state.kind) {
    case "idle":
      return "Siap"
    case "uploading":
      return `Mengunggah file… ${state.progress}%`
    case "processing":
      return "Memvalidasi workbook dan mengimpor produk…"
    case "done":
      return "Selesai"
    case "error":
      return "Gagal"
    default: {
      const _exhaustive: never = state
      return _exhaustive
    }
  }
}

function formatFileSize(bytes: number) {
  const megabytes = bytes / (1024 * 1024)

  return megabytes >= 1
    ? `${formatNumber(Math.round(megabytes * 10) / 10)} MB`
    : `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} KB`
}

function importResponse({
  status,
  text,
}: {
  status: number
  text: string
}): ImportState {
  let payload: unknown

  try {
    payload = JSON.parse(text)
  } catch {
    return { kind: "error", message: "Respons server tidak dapat dibaca." }
  }

  if (status === 200) {
    const summary = bulkImportSummarySchema.safeParse(payload)

    return summary.success
      ? { kind: "done", summary: summary.data }
      : { kind: "error", message: "Respons server tidak dapat dibaca." }
  }

  const failure = bulkImportErrorSchema.safeParse(payload)

  return {
    kind: "error",
    message: failure.success
      ? failure.data.error
      : "Import gagal. Coba lagi atau periksa log server.",
  }
}

function ProgressBar({ state }: { state: ImportState }) {
  const determinate = state.kind === "uploading"
  const value = determinate ? state.progress : 100

  return (
    <div
      role="progressbar"
      aria-label="Progres import"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={determinate ? value : undefined}
      aria-valuetext={stateLabel(state)}
      className="h-1.5 w-full overflow-hidden bg-muted"
    >
      <div
        className={cn(
          "h-full bg-primary transition-[width]",
          !determinate && "animate-pulse"
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function SummaryCounts({ summary }: { summary: BulkImportSummary }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: "Baris diproses", value: summary.total },
        { label: "Berhasil", value: summary.successful },
        { label: "Gagal", value: summary.failed },
        { label: "Dilewati", value: summary.skipped },
      ].map((metric) => (
        <div key={metric.label} className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {metric.label}
          </dt>
          <dd className="font-heading text-xl font-bold tabular-nums">
            {formatNumber(metric.value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function BulkFileDrop({ mode }: { mode: BulkMode }) {
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<ImportState>({ kind: "idle" })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef<XMLHttpRequest | null>(null)
  const busy = state.kind === "uploading" || state.kind === "processing"

  useEffect(() => () => requestRef.current?.abort(), [])

  function selectFile(next: File | null) {
    setState(
      next && next.size > MAX_XLSX_BYTES
        ? {
            kind: "error",
            message: `Ukuran file maksimal ${MAX_MEGABYTES} MB.`,
          }
        : { kind: "idle" }
    )
    setFile(next)
  }

  function reset() {
    requestRef.current?.abort()
    requestRef.current = null

    if (inputRef.current) {
      inputRef.current.value = ""
    }

    setFile(null)
    setState({ kind: "idle" })
  }

  function startImport() {
    if (!file || busy) {
      return
    }

    const body = new FormData()
    body.set(BULK_IMPORT_FIELD, file)

    const request = new XMLHttpRequest()
    requestRef.current = request

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        setState({
          kind: "uploading",
          progress: Math.min(
            100,
            Math.round((event.loaded / event.total) * 100)
          ),
        })
      }
    })
    request.upload.addEventListener("load", () =>
      setState({ kind: "processing" })
    )
    request.addEventListener("load", () => {
      requestRef.current = null
      setState(
        importResponse({ status: request.status, text: request.responseText })
      )
    })
    request.addEventListener("error", () => {
      requestRef.current = null
      setState({
        kind: "error",
        message: "Koneksi ke server terputus. Coba lagi.",
      })
    })

    setState({ kind: "uploading", progress: 0 })
    request.open("POST", bulkImportHref(mode))
    request.send(body)
  }

  if (state.kind === "done") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Import selesai</p>
          <SummaryCounts summary={state.summary} />
        </div>

        <BulkResultTable summary={state.summary} />

        <div>
          <Button variant="outline" onClick={reset}>
            <UploadSimpleIcon aria-hidden />
            Upload file lain
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        tabIndex={-1}
        accept={BULK_FILE_FORMATS.join(",")}
        aria-label={`Pilih file ${XLSX_EXTENSION}`}
        className="sr-only"
        onChange={(event) => selectFile(event.target.files?.item(0) ?? null)}
      />

      {file ? (
        <div className="flex flex-wrap items-center gap-3 border border-input p-4">
          <FileXlsIcon className="size-6 text-muted-foreground" aria-hidden />

          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatFileSize(file.size)} · {stateLabel(state)}
            </span>
          </span>

          <span className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <ArrowClockwiseIcon aria-hidden />
              Ganti file
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={reset}>
              <TrashIcon aria-hidden />
              Hapus
            </Button>
          </span>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            selectFile(event.dataTransfer.files.item(0))
          }}
          className={cn(
            "flex flex-col items-center gap-3 border border-dashed border-input p-6 text-center transition-colors sm:p-8",
            dragging && "border-ring bg-muted/50"
          )}
        >
          <UploadSimpleIcon
            className="size-6 text-muted-foreground"
            aria-hidden
          />

          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              Letakkan file di sini atau pilih dari perangkat
            </span>
            <span className="text-xs text-muted-foreground">
              Format {XLSX_EXTENSION}, maksimal {MAX_MEGABYTES} MB
            </span>
          </span>

          <Button
            variant="outline"
            size="lg"
            onClick={() => inputRef.current?.click()}
          >
            Pilih file
          </Button>
        </div>
      )}

      {busy && <ProgressBar state={state} />}

      {state.kind === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {stateLabel(state)}: {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" disabled={!file || busy} onClick={startImport}>
          {state.kind === "error" ? "Coba Lagi" : mode.importLabel}
        </Button>

        <span aria-live="polite" className="text-xs text-muted-foreground">
          {stateLabel(state)}
        </span>
      </div>
    </div>
  )
}

export { BulkFileDrop }
