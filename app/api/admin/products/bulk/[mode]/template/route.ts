import { z } from "zod"

import { canAccessAdmin } from "@/lib/auth/session"
import { getRequestSession } from "@/lib/auth/request"
import { XLSX_MIME } from "@/lib/admin/product-bulk/limits"
import { bulkWorkbookFor } from "@/lib/admin/product-bulk/runner"
import { bulkFileName, isBulkMode } from "@/lib/admin/bulk"

const paramsSchema = z.object({
  mode: z.string().refine(isBulkMode, "Unknown bulk mode."),
})

export async function GET(
  request: Request,
  context: RouteContext<"/api/admin/products/bulk/[mode]/template">
) {
  if (!canAccessAdmin(await getRequestSession(request))) {
    return Response.json({ error: "Admin access required." }, { status: 403 })
  }

  const parsed = paramsSchema.safeParse(await context.params)

  if (!parsed.success) {
    return Response.json({ error: "Unknown bulk mode." }, { status: 400 })
  }

  const mode = parsed.data.mode

  try {
    const bytes = await bulkWorkbookFor(mode)

    return new Response(bytes, {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="${bulkFileName(mode)}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "admin.product_bulk_template_failed",
        mode,
        error: error instanceof Error ? error.message : String(error),
      })
    )

    return Response.json({ error: "Template failed." }, { status: 500 })
  }
}
