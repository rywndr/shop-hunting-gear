import { z } from "zod"

import { getRequestSession } from "@/lib/auth/request"
import { rajaOngkirLocations } from "@/lib/shipping/rajaongkir"
import { locationLevelSchema } from "@/lib/shipping/schema"

const requestSchema = z
  .object({
    level: locationLevelSchema,
    parentId: z.coerce.number().int().positive().optional(),
  })
  .refine(
    (value) => value.level === "province" || value.parentId !== undefined,
    { path: ["parentId"] }
  )

export async function GET(request: Request) {
  const session = await getRequestSession(request)

  if (!session) {
    return Response.json({ error: "Authentication required." }, { status: 401 })
  }

  const url = new URL(request.url)
  const parsed = requestSchema.safeParse({
    level: url.searchParams.get("level"),
    parentId: url.searchParams.get("parentId") ?? undefined,
  })

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid location request." },
      { status: 400 }
    )
  }

  try {
    const locations = await rajaOngkirLocations(parsed.data)
    return Response.json({ locations })
  } catch {
    return Response.json(
      { error: "RajaOngkir locations are unavailable." },
      { status: 502 }
    )
  }
}
