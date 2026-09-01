import { getRequestSession } from "@/lib/auth/request"
import { cartWeight } from "@/lib/cart/config"
import { shippingQuoteRequestSchema } from "@/lib/checkout/schema"
import { cartItemsForUser } from "@/lib/cart/service"
import { storefrontProductBySlug } from "@/lib/products/service"
import { shippingOptionsForUser } from "@/lib/shipping/service"

export async function GET(request: Request) {
  const session = await getRequestSession(request)

  if (!session) {
    return Response.json({ error: "Authentication required." }, { status: 401 })
  }

  const url = new URL(request.url)
  const parsed = shippingQuoteRequestSchema.safeParse({
    source: url.searchParams.get("source"),
    addressId: url.searchParams.get("addressId"),
    productSlug: url.searchParams.get("productSlug") ?? undefined,
    quantity: url.searchParams.get("quantity") ?? undefined,
  })

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid shipping request." },
      { status: 400 }
    )
  }

  const weight =
    parsed.data.source === "cart"
      ? await cartItemsForUser(session.user.id, {
          preserveQuantity: true,
        }).then(cartWeight)
      : await storefrontQuoteWeight({
          productSlug: parsed.data.productSlug,
          quantity: parsed.data.quantity,
        })

  try {
    const result = await shippingOptionsForUser({
      userId: session.user.id,
      addressId: parsed.data.addressId,
      weight,
    })

    switch (result.kind) {
      case "ready":
        return Response.json({ weight, options: result.options })
      case "address-not-found":
        return Response.json({ error: "Address not found." }, { status: 404 })
      case "address-incomplete":
        return Response.json(
          { error: "Address needs a RajaOngkir destination." },
          { status: 409 }
        )
      case "empty-checkout":
        return Response.json({ error: "Checkout is empty." }, { status: 400 })
      default: {
        const _exhaustive: never = result
        return _exhaustive
      }
    }
  } catch {
    return Response.json(
      { error: "RajaOngkir shipping costs are unavailable." },
      { status: 502 }
    )
  }
}

async function storefrontQuoteWeight({
  productSlug,
  quantity,
}: {
  productSlug: string
  quantity: number
}) {
  const product = await storefrontProductBySlug(productSlug)

  if (!product) {
    return 0
  }

  return product.weight * quantity
}
