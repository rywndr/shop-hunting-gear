import { addressesForUser } from "@/lib/account/service"
import { getRequestSession } from "@/lib/auth/request"
import { cartWeight } from "@/lib/cart/config"
import { shippingQuoteRequestSchema } from "@/lib/checkout/schema"
import { cartItemsForUser } from "@/lib/cart/service"
import { storefrontProductBySlug } from "@/lib/products/service"
import { rajaOngkirShippingOptions } from "@/lib/shipping/rajaongkir"

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

  const [addresses, weight] = await Promise.all([
    addressesForUser(session.user.id),
    parsed.data.source === "cart"
      ? cartItemsForUser(session.user.id).then(cartWeight)
      : storefrontQuoteWeight({
          productSlug: parsed.data.productSlug,
          quantity: parsed.data.quantity,
        }),
  ])
  const selectedAddress = addresses.find(
    (address) => address.id === parsed.data.addressId
  )
  if (!selectedAddress) {
    return Response.json({ error: "Address not found." }, { status: 404 })
  }

  if (!selectedAddress.subdistrictId) {
    return Response.json(
      { error: "Address needs a RajaOngkir destination." },
      { status: 409 }
    )
  }

  if (weight <= 0) {
    return Response.json({ error: "Checkout is empty." }, { status: 400 })
  }

  try {
    const options = await rajaOngkirShippingOptions({
      destinationId: selectedAddress.subdistrictId,
      weight,
    })
    return Response.json({ weight, options })
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

  if (!product || product.stock === 0) {
    return 0
  }

  return product.weight * Math.min(quantity, product.stock)
}
