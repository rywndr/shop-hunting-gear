import assert from "node:assert/strict"
import test from "node:test"

import {
  trackingCourierForShippingCourier,
  rajaOngkirTrackingCourier,
} from "../lib/shipping/config"
import {
  RajaOngkirTrackingError,
  RAJA_ONGKIR_TRACKING_ENDPOINT,
  parseRajaOngkirTrackingResponse,
  rajaOngkirTracking,
} from "../lib/shipping/rajaongkir"
import {
  customTrackingRequestSchema,
  lastFivePhoneDigits,
  trackingCourierFromCustomValue,
  trackingInputFromOrder,
} from "../lib/shipping/tracking"

const originalRajaOngkirApiKey = process.env.RAJAONGKIR_API_KEY
process.env.RAJAONGKIR_API_KEY = "test-rajaongkir-key"

test.after(() => {
  if (originalRajaOngkirApiKey === undefined) {
    delete process.env.RAJAONGKIR_API_KEY
  } else {
    process.env.RAJAONGKIR_API_KEY = originalRajaOngkirApiKey
  }
})

const TRACKING_INPUT = {
  awb: "JP1234567890",
  courier: "jne",
  lastPhoneNumber: "67890",
} as const

function successPayload() {
  return {
    meta: { message: "success", code: 200, status: "success" },
    data: {
      delivered: true,
      summary: {
        courier_code: "jne",
        courier_name: "JNE",
        waybill_number: "JP1234567890",
        service_code: "REG",
        waybill_date: "2026-04-01",
        shipper_name: "Toko",
        receiver_name: "Budi",
        origin: "Bandung",
        destination: "Jakarta",
        status: "DELIVERED",
      },
      details: {
        waybill_number: "JP1234567890",
        waybill_date: "2026-04-01",
        waybill_time: "09:00:00",
        weight: "1000",
        origin: "Bandung",
        destination: "Jakarta",
        shipper_name: "Toko",
        shipper_address1: "Jalan Toko",
        shipper_address2: "",
        shipper_address3: "",
        shipper_city: "Bandung",
        receiver_name: "Budi",
        receiver_address1: "Jalan Rumah",
        receiver_address2: "",
        receiver_address3: "",
        receiver_city: "Jakarta",
      },
      delivery_status: {
        status: "DELIVERED",
        pod_receiver: "Budi",
        pod_date: "2026-04-03",
        pod_time: "14:30:00",
      },
      manifest: [
        {
          manifest_code: "1",
          manifest_description: "Manifested",
          manifest_date: "2026-04-01",
          manifest_time: "09:00:00",
          city_name: "Bandung",
        },
        {
          manifest_code: "2",
          manifest_description: "Delivered",
          manifest_date: "2026-04-03",
          manifest_time: "14:30:00",
          city_name: "Jakarta",
        },
      ],
    },
  }
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

test("custom tracking accepts the POST JSON body shape", () => {
  assert.deepEqual(
    customTrackingRequestSchema.parse(TRACKING_INPUT),
    TRACKING_INPUT
  )
})

test("custom tracking rejects invalid POST input", () => {
  assert.equal(
    customTrackingRequestSchema.safeParse({
      awb: "",
      courier: "jne",
      lastPhoneNumber: "67890",
    }).success,
    false
  )
  assert.equal(customTrackingRequestSchema.safeParse(null).success, false)
})

test("manual custom tracking details remain valid after needs-details", () => {
  const initial = customTrackingRequestSchema.parse({ awb: TRACKING_INPUT.awb })
  assert.equal(initial.courier, undefined)
  assert.equal(initial.lastPhoneNumber, undefined)

  const manual = customTrackingRequestSchema.parse(TRACKING_INPUT)
  assert.equal(trackingCourierFromCustomValue(manual.courier ?? ""), "jne")
  assert.equal(manual.lastPhoneNumber, "67890")
})

test("phone normalization returns the last five numeric digits", () => {
  assert.equal(lastFivePhoneDigits("+62 (812) 345-67890"), "67890")
  assert.equal(lastFivePhoneDigits("0812-3456-7890"), "67890")
  assert.equal(lastFivePhoneDigits("12-34"), null)
  assert.equal(lastFivePhoneDigits(null), null)
})

test("saved shipping couriers use an explicit tracking mapping", () => {
  assert.equal(trackingCourierForShippingCourier("jne"), "jne")
  assert.equal(trackingCourierForShippingCourier("jnt"), "jnt")
  assert.equal(trackingCourierForShippingCourier("tiki"), "tiki")
  assert.equal(trackingCourierForShippingCourier("pos"), "pos")
  assert.equal(trackingCourierForShippingCourier("sicepat"), null)
  assert.equal(trackingCourierForShippingCourier("manual"), null)
  assert.equal(rajaOngkirTrackingCourier("jne"), "jne")
  assert.equal(rajaOngkirTrackingCourier("sicepat"), null)
})

test("order tracking input derives resi, courier, and phone server-side", () => {
  assert.deepEqual(
    trackingInputFromOrder({
      tracking: " JP1234567890 ",
      shippingCourier: "jne",
      phone: "0812-345-67890",
    }),
    {
      kind: "ready",
      input: TRACKING_INPUT,
    }
  )
})

test("orders without usable resi or phone are rejected before the API call", () => {
  assert.deepEqual(
    trackingInputFromOrder({
      tracking: null,
      shippingCourier: "jne",
      phone: "081234567890",
    }),
    { kind: "missing-tracking" }
  )
  assert.deepEqual(
    trackingInputFromOrder({
      tracking: "JP1234567890",
      shippingCourier: "jne",
      phone: "1234",
    }),
    { kind: "invalid-phone" }
  )
  assert.deepEqual(
    trackingInputFromOrder({
      tracking: "JP1234567890",
      shippingCourier: "manual",
      phone: "081234567890",
    }),
    { kind: "unsupported-courier" }
  )
})

test("the RajaOngkir client rejects invalid tracking input locally", async () => {
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => {
    called = true
    return jsonResponse(successPayload())
  }

  try {
    await assert.rejects(
      () =>
        rajaOngkirTracking({
          ...TRACKING_INPUT,
          lastPhoneNumber: "1234",
        }),
      (error: unknown) =>
        error instanceof RajaOngkirTrackingError &&
        error.kind === "invalid-input"
    )
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("the RajaOngkir client sends the documented form body", async () => {
  const originalFetch = globalThis.fetch
  let requestChecked = false

  globalThis.fetch = async (input, init) => {
    assert.equal(input, RAJA_ONGKIR_TRACKING_ENDPOINT)
    assert.equal(init?.method, "POST")
    const headers = new Headers(init?.headers)
    assert.equal(headers.get("key"), "test-rajaongkir-key")
    assert.equal(
      headers.get("content-type"),
      "application/x-www-form-urlencoded"
    )
    assert.ok(init?.body instanceof URLSearchParams)
    if (!(init?.body instanceof URLSearchParams)) {
      throw new Error("Expected a URL-encoded tracking body.")
    }
    assert.equal(init.body.get("awb"), TRACKING_INPUT.awb)
    assert.equal(init.body.get("courier"), TRACKING_INPUT.courier)
    assert.equal(
      init.body.get("last_phone_number"),
      TRACKING_INPUT.lastPhoneNumber
    )
    requestChecked = true
    return jsonResponse(successPayload())
  }

  try {
    const result = await rajaOngkirTracking(TRACKING_INPUT)
    assert.equal(requestChecked, true)
    assert.equal(result.delivered, true)
    assert.equal(result.summary.receiverName, "Budi")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("the tracking response parser normalizes documented fields and keeps manifest order", () => {
  assert.deepEqual(parseRajaOngkirTrackingResponse(successPayload()), {
    delivered: true,
    summary: {
      courierCode: "jne",
      courierName: "JNE",
      waybillNumber: "JP1234567890",
      serviceCode: "REG",
      waybillDate: "2026-04-01",
      origin: "Bandung",
      destination: "Jakarta",
      status: "DELIVERED",
      receiverName: "Budi",
    },
    deliveryStatus: {
      status: "DELIVERED",
      podReceiver: "Budi",
      podDate: "2026-04-03",
      podTime: "14:30:00",
    },
    manifest: [
      {
        description: "Manifested",
        date: "2026-04-01",
        time: "09:00:00",
        city: "Bandung",
      },
      {
        description: "Delivered",
        date: "2026-04-03",
        time: "14:30:00",
        city: "Jakarta",
      },
    ],
  })
})

test("a 400 response is exposed as an invalid-input failure", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => jsonResponse({}, 400)

  try {
    await assert.rejects(
      () => rajaOngkirTracking(TRACKING_INPUT),
      (error: unknown) =>
        error instanceof RajaOngkirTrackingError &&
        error.kind === "invalid-input" &&
        error.status === 400
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("a 404 response is exposed as an AWB-not-found failure", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => jsonResponse({ data: null }, 404)

  try {
    await assert.rejects(
      () => rajaOngkirTracking(TRACKING_INPUT),
      (error: unknown) =>
        error instanceof RajaOngkirTrackingError &&
        error.kind === "not-found" &&
        error.status === 404
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("an invalid successful response is rejected without trusting its shape", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    jsonResponse({
      meta: { message: "success", code: 200, status: "success" },
      data: { delivered: true },
    })

  try {
    await assert.rejects(
      () => rajaOngkirTracking(TRACKING_INPUT),
      (error: unknown) =>
        error instanceof RajaOngkirTrackingError &&
        error.kind === "invalid-response"
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("malformed JSON is exposed as an invalid response", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response("{not-json", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })

  try {
    await assert.rejects(
      () => rajaOngkirTracking(TRACKING_INPUT),
      (error: unknown) =>
        error instanceof RajaOngkirTrackingError &&
        error.kind === "invalid-response"
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("an HTTP 401 response never exposes authentication details", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => jsonResponse({}, 401)

  try {
    await assert.rejects(
      () => rajaOngkirTracking(TRACKING_INPUT),
      (error: unknown) =>
        error instanceof RajaOngkirTrackingError &&
        error.kind === "unauthorized" &&
        error.status === 401
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("network failures are classified before reaching the UI", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error("connection refused")
  }

  try {
    await assert.rejects(
      () => rajaOngkirTracking(TRACKING_INPUT),
      (error: unknown) =>
        error instanceof RajaOngkirTrackingError && error.kind === "network"
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
