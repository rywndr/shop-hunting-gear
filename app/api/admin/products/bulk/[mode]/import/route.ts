import { z } from "zod"

import { canAccessAdmin } from "@/lib/auth/session"
import { getRequestSession } from "@/lib/auth/request"
import { BULK_IMPORT_FIELD, isBulkMode } from "@/lib/admin/bulk"
import {
  megabytes,
  MAX_XLSX_BYTES,
  XLSX_EXTENSION,
} from "@/lib/admin/product-bulk/limits"
import { runBulkImport } from "@/lib/admin/product-bulk/runner"

const paramsSchema = z.object({
  mode: z.string().refine(isBulkMode, "Unknown bulk mode."),
})

export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/products/bulk/[mode]/import">
) {
  if (!canAccessAdmin(await getRequestSession(request))) {
    return Response.json(
      { error: "Anda tidak dapat mengimpor produk." },
      { status: 403 }
    )
  }

  const parsed = paramsSchema.safeParse(await context.params)

  if (!parsed.success) {
    return Response.json(
      { error: "Mode import tidak dikenal." },
      { status: 400 }
    )
  }

  const mode = parsed.data.mode
  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: "File tidak dapat dibaca." }, { status: 400 })
  }

  const file = formData.get(BULK_IMPORT_FIELD)

  if (!(file instanceof File)) {
    return Response.json({ error: "Pilih file .xlsx." }, { status: 400 })
  }

  if (!file.name.toLowerCase().endsWith(XLSX_EXTENSION)) {
    return Response.json(
      { error: `Format file harus ${XLSX_EXTENSION}.` },
      { status: 400 }
    )
  }

  if (file.size > MAX_XLSX_BYTES) {
    return Response.json(
      {
        error: `Ukuran file maksimal ${megabytes(MAX_XLSX_BYTES)} MB.`,
      },
      { status: 413 }
    )
  }

  try {
    const result = await runBulkImport({
      mode,
      bytes: await file.arrayBuffer(),
    })

    return result.kind === "invalid"
      ? Response.json({ error: result.message }, { status: 400 })
      : Response.json(result.summary)
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "admin.product_bulk_import_failed",
        mode,
        error: error instanceof Error ? error.message : String(error),
      })
    )

    return Response.json(
      { error: "Import gagal. Periksa log server." },
      { status: 500 }
    )
  }
}
