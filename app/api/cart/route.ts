import { getRequestSession } from "@/lib/auth/request"
import {
  addCartItemSchema,
  removeCartItemSchema,
  updateCartItemSchema,
} from "@/lib/cart/schema"
import {
  addCartItemForUser,
  cartItemsForUser,
  clearCartForUser,
  removeCartItemForUser,
  updateCartItemForUser,
} from "@/lib/cart/service"

function unauthorized() {
  return Response.json({ error: "Authentication required." }, { status: 401 })
}

function invalidRequest() {
  return Response.json({ error: "Invalid cart data." }, { status: 400 })
}

async function requestJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

export async function GET(request: Request) {
  const session = await getRequestSession(request)

  if (!session) {
    return unauthorized()
  }

  return Response.json({ items: await cartItemsForUser(session.user.id) })
}

export async function POST(request: Request) {
  const session = await getRequestSession(request)

  if (!session) {
    return unauthorized()
  }

  const parsed = addCartItemSchema.safeParse(await requestJson(request))

  if (!parsed.success) {
    return invalidRequest()
  }

  const result = await addCartItemForUser({
    userId: session.user.id,
    input: parsed.data,
  })

  if (result.kind === "invalid") {
    return Response.json({ error: result.message }, { status: 400 })
  }

  return Response.json({ items: await cartItemsForUser(session.user.id) })
}

export async function PATCH(request: Request) {
  const session = await getRequestSession(request)

  if (!session) {
    return unauthorized()
  }

  const parsed = updateCartItemSchema.safeParse(await requestJson(request))

  if (!parsed.success) {
    return invalidRequest()
  }

  const updated = await updateCartItemForUser({
    userId: session.user.id,
    itemId: parsed.data.itemId,
    quantity: parsed.data.quantity,
  })

  if (!updated) {
    return Response.json({ error: "Cart item not found." }, { status: 404 })
  }

  return Response.json({ items: await cartItemsForUser(session.user.id) })
}

export async function DELETE(request: Request) {
  const session = await getRequestSession(request)

  if (!session) {
    return unauthorized()
  }

  const parsed = removeCartItemSchema.safeParse(await requestJson(request))

  if (!parsed.success) {
    return invalidRequest()
  }

  if ("clear" in parsed.data) {
    await clearCartForUser(session.user.id)
  } else {
    await removeCartItemForUser({
      userId: session.user.id,
      itemId: parsed.data.itemId,
    })
  }

  return Response.json({ items: await cartItemsForUser(session.user.id) })
}
