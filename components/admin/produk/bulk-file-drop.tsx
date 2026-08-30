import { UploadSimpleIcon } from "@phosphor-icons/react/ssr"

import { buttonVariants } from "@/components/ui/button"
import { BULK_FILE_FORMATS } from "@/lib/admin/bulk"
import { cn } from "@/lib/utils"

function BulkFileDrop() {
  return (
    <label className="relative flex flex-col items-center gap-3 border border-dashed border-input p-6 text-center transition-colors hover:bg-muted/50 has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/30 sm:p-8">
      <UploadSimpleIcon className="size-6 text-muted-foreground" aria-hidden />

      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          Letakkan file di sini atau pilih dari perangkat
        </span>
        <span className="text-xs text-muted-foreground">
          Format {BULK_FILE_FORMATS.join(" atau ")}
        </span>
      </span>

      <span
        aria-hidden
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "pointer-events-none"
        )}
      >
        Pilih file
      </span>

      <input
        type="file"
        accept={BULK_FILE_FORMATS.join(",")}
        aria-label="Pilih file .xlsx atau .csv"
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  )
}

export { BulkFileDrop }
