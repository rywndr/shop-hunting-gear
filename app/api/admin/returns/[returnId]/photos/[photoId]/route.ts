import { and, eq } from "drizzle-orm"
import { canAccessAdmin, getCurrentSession } from "@/lib/auth/session"
import { db } from "@/lib/db/client"
import { returnPhoto } from "@/lib/db/schema/return"
import { signedB2GetUrl } from "@/lib/storage/b2"

export async function GET(
  _request: Request,
  context: { params: Promise<{ returnId: string; photoId: string }> }
) {
  if (!canAccessAdmin(await getCurrentSession()))
    return new Response("Unauthorized.", {
      status: 403,
      headers: { "Cache-Control": "private, no-store" },
    })
  const { returnId, photoId } = await context.params
  const [photo] = await db
    .select()
    .from(returnPhoto)
    .where(and(eq(returnPhoto.id, photoId), eq(returnPhoto.returnId, returnId)))
  if (!photo) return new Response("Photo not found.", { status: 404 })
  return new Response(null, {
    status: 302,
    headers: {
      Location: await signedB2GetUrl(photo.objectKey, 60),
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  })
}
