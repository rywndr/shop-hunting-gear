import assert from "node:assert/strict"
import test from "node:test"

import { canMarkOrderCompleted, canMarkOrderPaid } from "../lib/admin/orders"
import {
  manualOrderDeliveryMethod,
  manualOrderSchema,
  manualOrderVariantOptions,
  manualOrderVariantSelection,
  MANUAL_ORDER_DEFAULT_VALUES,
  NO_VARIANT_OPTION,
  type ManualOrderInput,
} from "../lib/admin/manual-order"

const PRODUCT = {
  slug: "senapan-angin",
  name: "Senapan Angin",
  price: 2_500_000,
  stock: 4,
  variants: [
    { label: "Kaliber", options: ["4.5 mm", "5.5 mm"] },
    { label: "Warna", options: ["Hitam"] },
  ],
} as const

const COURIER_ORDER = {
  ...MANUAL_ORDER_DEFAULT_VALUES,
  customerId: "user-1",
  productSlug: PRODUCT.slug,
  variant: "Kaliber: 4.5 mm / Warna: Hitam",
  quantity: 2,
  recipient: "Budi",
  phone: "081234567890",
  address: "Jalan Merdeka 10, Bandung, Jawa Barat 40111",
  deliveryMethod: "jne",
  shippingCost: 25_000,
} satisfies ManualOrderInput

test("store pickup resolves to manual fulfillment, not a courier", () => {
  const pickup = manualOrderDeliveryMethod("pickup")

  assert.equal(pickup?.courier, "manual")
  assert.equal(pickup?.courierName, "Ambil di toko")
  assert.equal(pickup?.service, "Pickup")
  assert.equal(pickup?.requiresAddress, false)
})

test("store courier is manual fulfillment that still ships", () => {
  const storeCourier = manualOrderDeliveryMethod("store-courier")

  assert.equal(storeCourier?.courier, "manual")
  assert.equal(storeCourier?.requiresAddress, true)
})

test("real couriers keep their own courier code", () => {
  assert.equal(manualOrderDeliveryMethod("jne")?.courier, "jne")
  assert.equal(manualOrderDeliveryMethod("unknown-courier"), undefined)
})

test("a courier order requires a delivery address", () => {
  assert.equal(manualOrderSchema.safeParse(COURIER_ORDER).success, true)

  const missingAddress = manualOrderSchema.safeParse({
    ...COURIER_ORDER,
    address: "",
  })

  assert.equal(missingAddress.success, false)
  assert.equal(
    missingAddress.error?.issues.some((issue) => issue.path[0] === "address"),
    true
  )
})

test("store pickup needs no address and forces a zero shipping cost", () => {
  const pickup = manualOrderSchema.safeParse({
    ...COURIER_ORDER,
    deliveryMethod: "pickup",
    address: "",
    shippingCost: 0,
  })

  assert.equal(pickup.success, true)

  const paidPickup = manualOrderSchema.safeParse({
    ...COURIER_ORDER,
    deliveryMethod: "pickup",
    address: "",
    shippingCost: 15_000,
  })

  assert.equal(paidPickup.success, false)
  assert.equal(
    paidPickup.error?.issues.some((issue) => issue.path[0] === "shippingCost"),
    true
  )
})

test("a delivery method is required", () => {
  const parsed = manualOrderSchema.safeParse({
    ...COURIER_ORDER,
    deliveryMethod: "",
  })

  assert.equal(parsed.success, false)
  assert.equal(
    parsed.error?.issues.some((issue) => issue.path[0] === "deliveryMethod"),
    true
  )
})

test("a customer is identified by id, not by name", () => {
  const parsed = manualOrderSchema.safeParse({
    ...COURIER_ORDER,
    customerId: "",
  })

  assert.equal(parsed.success, false)
  assert.equal(
    parsed.error?.issues.some((issue) => issue.path[0] === "customerId"),
    true
  )
})

test("quantities must be positive integers", () => {
  assert.equal(
    manualOrderSchema.safeParse({ ...COURIER_ORDER, quantity: 0 }).success,
    false
  )
  assert.equal(
    manualOrderSchema.safeParse({ ...COURIER_ORDER, quantity: 1.5 }).success,
    false
  )
})

test("variant combinations map back to structured variants", () => {
  assert.deepEqual(manualOrderVariantOptions(PRODUCT), [
    "Kaliber: 4.5 mm / Warna: Hitam",
    "Kaliber: 5.5 mm / Warna: Hitam",
  ])
  assert.deepEqual(
    manualOrderVariantSelection({
      product: PRODUCT,
      variant: "Kaliber: 5.5 mm / Warna: Hitam",
    })?.variants,
    [
      { label: "Kaliber", value: "5.5 mm" },
      { label: "Warna", value: "Hitam" },
    ]
  )
})

test("an unknown variant has no selection", () => {
  assert.equal(
    manualOrderVariantSelection({ product: PRODUCT, variant: "Kaliber: 7 mm" }),
    undefined
  )
})

test("a product without variants has one empty selection", () => {
  const selection = manualOrderVariantSelection({
    product: { ...PRODUCT, variants: [] },
    variant: NO_VARIANT_OPTION,
  })

  assert.deepEqual(selection?.variants, [])
})

test("only reserved unpaid manual orders may be marked paid", () => {
  assert.equal(
    canMarkOrderPaid({
      sourceKind: "manual",
      paymentStatus: "pending",
      fulfillmentStatus: "awaiting_payment",
    }),
    true
  )
  assert.equal(
    canMarkOrderPaid({
      sourceKind: "manual",
      paymentStatus: "authorized",
      fulfillmentStatus: "awaiting_payment",
    }),
    true
  )
  assert.equal(
    canMarkOrderPaid({
      sourceKind: "manual",
      paymentStatus: "paid",
      fulfillmentStatus: "processing",
    }),
    false
  )
  assert.equal(
    canMarkOrderPaid({
      sourceKind: "manual",
      paymentStatus: "cancelled",
      fulfillmentStatus: "cancelled",
    }),
    false
  )
})

test("provider-backed orders are never settled by an admin", () => {
  for (const sourceKind of ["cart", "product"] as const) {
    assert.equal(
      canMarkOrderPaid({
        sourceKind,
        paymentStatus: "pending",
        fulfillmentStatus: "awaiting_payment",
      }),
      false
    )
  }
})

test("completion needs recognized revenue and an open fulfillment", () => {
  assert.equal(
    canMarkOrderCompleted({
      paymentStatus: "paid",
      fulfillmentStatus: "processing",
    }),
    true
  )
  assert.equal(
    canMarkOrderCompleted({
      paymentStatus: "paid",
      fulfillmentStatus: "shipped",
    }),
    true
  )
  assert.equal(
    canMarkOrderCompleted({
      paymentStatus: "pending",
      fulfillmentStatus: "awaiting_payment",
    }),
    false
  )
  assert.equal(
    canMarkOrderCompleted({
      paymentStatus: "paid",
      fulfillmentStatus: "completed",
    }),
    false
  )
})
