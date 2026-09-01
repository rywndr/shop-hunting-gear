import { Buffer } from "node:buffer"
import { createHash, timingSafeEqual } from "node:crypto"

export function midtransSignature({
  orderId,
  statusCode,
  grossAmount,
  serverKey,
}: {
  readonly orderId: string
  readonly statusCode: string
  readonly grossAmount: string
  readonly serverKey: string
}) {
  return createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex")
}

export function hasValidMidtransSignature({
  orderId,
  statusCode,
  grossAmount,
  signature,
  serverKey,
}: {
  readonly orderId: string
  readonly statusCode: string
  readonly grossAmount: string
  readonly signature: string
  readonly serverKey: string
}) {
  const expected = midtransSignature({
    orderId,
    statusCode,
    grossAmount,
    serverKey,
  })
  const expectedBytes = Buffer.from(expected, "utf8")
  const actualBytes = Buffer.from(signature, "utf8")

  return (
    expectedBytes.length === actualBytes.length &&
    timingSafeEqual(expectedBytes, actualBytes)
  )
}
