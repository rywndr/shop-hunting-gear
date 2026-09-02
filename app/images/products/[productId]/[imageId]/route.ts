import { z } from "zod"

import { canAccessAdmin } from "@/lib/auth/session"
import { getRequestSession } from "@/lib/auth/request"
import { storedProductImage } from "@/lib/products/service"
import { downloadProductImage } from "@/lib/products/storage"

const imageParamsSchema = z.object({
  productId: z.union([z.uuid(), z.string().regex(/^\d+$/)]),
  imageId: z.string().min(1),
})

function notFoundResponse() {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  })
}

export async function GET(
  request: Request,
  context: RouteContext<"/images/products/[productId]/[imageId]">
) {
  const parsedParams = imageParamsSchema.safeParse(await context.params)

  if (!parsedParams.success) {
    return notFoundResponse()
  }

  const stored = await storedProductImage(parsedParams.data)

  if (!stored) {
    return notFoundResponse()
  }

  if (stored.state !== "active") {
    const session = await getRequestSession(request)

    if (!canAccessAdmin(session)) {
      return notFoundResponse()
    }
  }

  const download = await downloadProductImage(stored.image.objectKey)

  if (download.kind === "not-found") {
    return notFoundResponse()
  }

  const headers = new Headers({
    "Cache-Control":
      stored.state === "active"
        ? "public, max-age=300, s-maxage=300"
        : "private, no-store",
    "Content-Type": download.mime,
    "X-Content-Type-Options": "nosniff",
  })

  if (download.contentLength !== null) {
    headers.set("Content-Length", String(download.contentLength))
  }

  if (download.etag) {
    headers.set("ETag", download.etag)
  }

  if (download.lastModified) {
    headers.set("Last-Modified", download.lastModified)
  }

  return new Response(download.body, { headers })
}
