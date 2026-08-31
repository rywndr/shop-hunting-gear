import {
  addressIdRequestSchema,
  createAddressRequestSchema,
  updateAddressRequestSchema,
} from "@/lib/account/schema"
import {
  addressesForUser,
  createAddressForUser,
  deleteAddressForUser,
  setPrimaryAddressForUser,
  updateAddressForUser,
} from "@/lib/account/service"
import { getRequestSession } from "@/lib/auth/request"
import { rajaOngkirAddressMatches } from "@/lib/shipping/rajaongkir"

function unauthorized() {
  return Response.json(
    { error: "Silakan masuk terlebih dahulu." },
    { status: 401 }
  )
}

function invalidRequest() {
  return Response.json({ error: "Data alamat tidak valid." }, { status: 400 })
}

async function requestJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

async function addressResponse(userId: string) {
  return Response.json({ addresses: await addressesForUser(userId) })
}

async function validRajaOngkirAddress(
  values: Parameters<typeof rajaOngkirAddressMatches>[0]
) {
  try {
    return await rajaOngkirAddressMatches(values)
  } catch {
    return null
  }
}

function locationUnavailable() {
  return Response.json(
    { error: "RajaOngkir locations are unavailable." },
    { status: 502 }
  )
}

export async function POST(request: Request) {
  const session = await getRequestSession(request)

  if (!session) {
    return unauthorized()
  }

  const parsed = createAddressRequestSchema.safeParse(
    await requestJson(request)
  )

  if (!parsed.success) {
    return invalidRequest()
  }

  const validLocation = await validRajaOngkirAddress(parsed.data)

  if (validLocation === null) return locationUnavailable()
  if (!validLocation) return invalidRequest()

  await createAddressForUser({ userId: session.user.id, values: parsed.data })
  return addressResponse(session.user.id)
}

export async function PUT(request: Request) {
  const session = await getRequestSession(request)

  if (!session) {
    return unauthorized()
  }

  const parsed = updateAddressRequestSchema.safeParse(
    await requestJson(request)
  )

  if (!parsed.success) {
    return invalidRequest()
  }

  const validLocation = await validRajaOngkirAddress(parsed.data.values)

  if (validLocation === null) return locationUnavailable()
  if (!validLocation) return invalidRequest()

  const updated = await updateAddressForUser({
    userId: session.user.id,
    id: parsed.data.id,
    values: parsed.data.values,
  })

  if (!updated) {
    return Response.json({ error: "Alamat tidak ditemukan." }, { status: 404 })
  }

  return addressResponse(session.user.id)
}

export async function PATCH(request: Request) {
  const session = await getRequestSession(request)

  if (!session) {
    return unauthorized()
  }

  const parsed = addressIdRequestSchema.safeParse(await requestJson(request))

  if (!parsed.success) {
    return invalidRequest()
  }

  const updated = await setPrimaryAddressForUser({
    userId: session.user.id,
    id: parsed.data.id,
  })

  if (!updated) {
    return Response.json({ error: "Alamat tidak ditemukan." }, { status: 404 })
  }

  return addressResponse(session.user.id)
}

export async function DELETE(request: Request) {
  const session = await getRequestSession(request)

  if (!session) {
    return unauthorized()
  }

  const parsed = addressIdRequestSchema.safeParse(await requestJson(request))

  if (!parsed.success) {
    return invalidRequest()
  }

  const deleted = await deleteAddressForUser({
    userId: session.user.id,
    id: parsed.data.id,
  })

  if (!deleted) {
    return Response.json({ error: "Alamat tidak ditemukan." }, { status: 404 })
  }

  return addressResponse(session.user.id)
}
