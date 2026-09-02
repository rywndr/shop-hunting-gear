import assert from "node:assert/strict"
import test from "node:test"

import {
  classifyMidtransPayment,
  grossAmountMatches,
  paymentTransition,
} from "../lib/payments/midtrans/reconciliation"
import {
  hasValidMidtransSignature,
  midtransSignature,
} from "../lib/payments/midtrans/security"

test("settlement and accepted capture are paid outcomes", () => {
  assert.deepEqual(
    classifyMidtransPayment({
      transactionStatus: "settlement",
      fraudStatus: null,
    }),
    { kind: "paid", paymentStatus: "paid" }
  )
  assert.deepEqual(
    classifyMidtransPayment({
      transactionStatus: "capture",
      fraudStatus: "accept",
    }),
    { kind: "paid", paymentStatus: "paid" }
  )
})

test("authorize is an authorized pending outcome", () => {
  assert.deepEqual(
    classifyMidtransPayment({
      transactionStatus: "authorize",
      fraudStatus: null,
    }),
    { kind: "pending", paymentStatus: "authorized" }
  )
})

test("a challenged capture remains pending", () => {
  assert.deepEqual(
    classifyMidtransPayment({
      transactionStatus: "capture",
      fraudStatus: "challenge",
    }),
    { kind: "pending", paymentStatus: "authorized" }
  )
})

test("authorized state does not regress to pending", () => {
  assert.deepEqual(
    paymentTransition({
      current: "authorized",
      incoming: classifyMidtransPayment({
        transactionStatus: "pending",
        fraudStatus: null,
      }),
    }),
    { kind: "ignore", paymentStatus: "authorized" }
  )
})

test("unknown provider statuses do not change local payment state", () => {
  const incoming = classifyMidtransPayment({
    transactionStatus: "future_provider_state",
    fraudStatus: null,
  })

  assert.deepEqual(incoming, {
    kind: "unknown",
    transactionStatus: "future_provider_state",
  })
  assert.deepEqual(paymentTransition({ current: "pending", incoming }), {
    kind: "unknown",
    paymentStatus: "pending",
    transactionStatus: "future_provider_state",
  })
})

test("a paid order cannot regress on a delayed cancellation", () => {
  assert.deepEqual(
    paymentTransition({
      current: "paid",
      incoming: classifyMidtransPayment({
        transactionStatus: "cancel",
        fraudStatus: null,
      }),
    }),
    { kind: "ignore", paymentStatus: "paid" }
  )
})

test("a refund cannot create revenue state for an unpaid order", () => {
  assert.deepEqual(
    paymentTransition({
      current: "pending",
      incoming: classifyMidtransPayment({
        transactionStatus: "refund",
        fraudStatus: null,
      }),
    }),
    { kind: "ignore", paymentStatus: "pending" }
  )
})

test("a settlement wins a cancellation race", () => {
  assert.deepEqual(
    paymentTransition({
      current: "cancelled",
      incoming: classifyMidtransPayment({
        transactionStatus: "settlement",
        fraudStatus: null,
      }),
    }),
    { kind: "settle", paymentStatus: "paid" }
  )
})

test("refunds change payment state without releasing inventory", () => {
  assert.deepEqual(
    paymentTransition({
      current: "paid",
      incoming: classifyMidtransPayment({
        transactionStatus: "partial_refund",
        fraudStatus: "accept",
      }),
    }),
    { kind: "record", paymentStatus: "partial_refund" }
  )
})

test("duplicate terminal events do not repeat their side effect", () => {
  const incoming = classifyMidtransPayment({
    transactionStatus: "expire",
    fraudStatus: null,
  })

  assert.deepEqual(paymentTransition({ current: "pending", incoming }), {
    kind: "release",
    paymentStatus: "expired",
  })
  assert.deepEqual(paymentTransition({ current: "expired", incoming }), {
    kind: "ignore",
    paymentStatus: "expired",
  })
})

test("IDR amount comparison does not use floating point", () => {
  assert.equal(
    grossAmountMatches("9007199254740991.00", 9007199254740991),
    true
  )
  assert.equal(grossAmountMatches("10000.01", 10000), false)
  assert.equal(grossAmountMatches("1e4", 10000), false)
})

test("Midtrans signatures compare in constant time", () => {
  const input = {
    orderId: "HG-order",
    statusCode: "200",
    grossAmount: "10000.00",
    serverKey: "server-key",
  }
  const signature = midtransSignature(input)

  assert.equal(hasValidMidtransSignature({ ...input, signature }), true)
  assert.equal(
    hasValidMidtransSignature({
      ...input,
      signature: `${signature.slice(0, -1)}0`,
    }),
    false
  )
})
