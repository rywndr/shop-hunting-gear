import "server-only"

import {
  lookup as dnsLookup,
  type LookupAddress,
  type LookupAllOptions,
  type LookupOneOptions,
} from "node:dns"
import { lookup } from "node:dns/promises"
import { request as httpsRequest } from "node:https"
import { isIP } from "node:net"
import { Readable } from "node:stream"
import sharp from "sharp"

import { type ProductImageMime } from "@/lib/products/storage"

import {
  megabytes,
  MAX_IMAGE_BYTES,
  MAX_REDIRECTS,
  REMOTE_IMAGE_TIMEOUT_MS,
} from "./limits"

const MAX_IMAGE_PIXELS = 40_000_000
const PROBE_SIZE = 16

const SHARP_MIMES = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const satisfies Readonly<Record<string, ProductImageMime>>

function isSharpFormat(value: string): value is keyof typeof SHARP_MIMES {
  return Object.hasOwn(SHARP_MIMES, value)
}

export type RemoteImageFailure =
  | "invalid-url"
  | "blocked-address"
  | "too-many-redirects"
  | "unreachable"
  | "http-error"
  | "too-large"
  | "unsupported-format"

export class RemoteImageError extends Error {
  readonly failure: RemoteImageFailure
  readonly status: number | null

  constructor({
    failure,
    status = null,
    cause,
  }: {
    failure: RemoteImageFailure
    status?: number | null
    cause?: unknown
  }) {
    super(`Remote product image failed: ${failure}.`, { cause })
    this.name = "RemoteImageError"
    this.failure = failure
    this.status = status
  }
}

function reject(failure: RemoteImageFailure, cause?: unknown): never {
  throw new RemoteImageError({ failure, cause })
}

function ipv4Bytes(value: string) {
  const parts = value.split(".")

  if (parts.length !== 4) {
    return null
  }

  const bytes = parts.map((part) =>
    /^\d{1,3}$/.test(part) ? Number(part) : Number.NaN
  )

  return bytes.every((byte) => byte >= 0 && byte <= 255) ? bytes : null
}

const BLOCKED_IPV4 = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const satisfies readonly (readonly [string, number])[]

function ipv4Number(bytes: readonly number[]) {
  return bytes.reduce((total, byte) => total * 256 + byte, 0)
}

function isBlockedIpv4(value: string) {
  const bytes = ipv4Bytes(value)

  if (!bytes) {
    return true
  }

  const address = ipv4Number(bytes)

  return BLOCKED_IPV4.some(([network, prefix]) => {
    const networkBytes = ipv4Bytes(network)

    if (!networkBytes) {
      return true
    }

    const mask = (0xffffffff << (32 - prefix)) >>> 0

    return (address & mask) >>> 0 === (ipv4Number(networkBytes) & mask) >>> 0
  })
}

function hextets(part: string) {
  if (part === "") {
    return []
  }

  const chunks = part.split(":")
  const groups: number[] = []

  for (const [index, chunk] of chunks.entries()) {
    if (chunk.includes(".")) {
      const bytes = ipv4Bytes(chunk)

      if (!bytes || index !== chunks.length - 1) {
        return null
      }

      groups.push((bytes[0] << 8) | bytes[1], (bytes[2] << 8) | bytes[3])
      continue
    }

    if (!/^[0-9a-f]{1,4}$/i.test(chunk)) {
      return null
    }

    groups.push(Number.parseInt(chunk, 16))
  }

  return groups
}

function ipv6Groups(value: string) {
  const address = value.replace(/%.*$/, "")
  const [head, tail, ...rest] = address.split("::")

  if (rest.length > 0 || head === undefined) {
    return null
  }

  const headGroups = hextets(head)

  if (!headGroups) {
    return null
  }

  if (tail === undefined) {
    return headGroups.length === 8 ? headGroups : null
  }

  const tailGroups = hextets(tail)

  if (!tailGroups || headGroups.length + tailGroups.length > 7) {
    return null
  }

  return [
    ...headGroups,
    ...Array.from(
      { length: 8 - headGroups.length - tailGroups.length },
      () => 0
    ),
    ...tailGroups,
  ]
}

function isBlockedIpv6(value: string) {
  const groups = ipv6Groups(value)

  if (!groups) {
    return true
  }

  const [first, second, third, fourth, fifth, sixth, seventh, eighth] = groups
  const isMappedIpv4 =
    first === 0 &&
    second === 0 &&
    third === 0 &&
    fourth === 0 &&
    fifth === 0 &&
    sixth === 0xffff
  const isNat64 = first === 0x64 && second === 0xff9b

  if (isMappedIpv4 || isNat64) {
    const embedded = [
      seventh >> 8,
      seventh & 0xff,
      eighth >> 8,
      eighth & 0xff,
    ].join(".")

    return isBlockedIpv4(embedded)
  }

  if (groups.every((group) => group === 0)) {
    return true
  }

  if (groups.slice(0, 7).every((group) => group === 0) && eighth === 1) {
    return true
  }

  const highByte = first >> 8
  const lowByte = first & 0xff

  return (
    (highByte & 0xfe) === 0xfc ||
    (highByte === 0xfe && (lowByte & 0xc0) === 0x80) ||
    (highByte === 0xfe && (lowByte & 0xc0) === 0xc0) ||
    highByte === 0xff ||
    (first === 0x2001 && second === 0x0db8) ||
    (first === 0x0100 && second === 0 && third === 0 && fourth === 0)
  )
}

export function isBlockedAddress(value: string) {
  const version = isIP(value)

  switch (version) {
    case 4:
      return isBlockedIpv4(value)
    case 6:
      return isBlockedIpv6(value)
    default:
      return true
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
])

export function parseRemoteImageUrl(value: string) {
  let url: URL

  try {
    url = new URL(value.trim())
  } catch {
    return reject("invalid-url")
  }

  if (url.protocol !== "https:") {
    reject("invalid-url")
  }

  if (url.username !== "" || url.password !== "") {
    reject("invalid-url")
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase()

  if (hostname === "" || BLOCKED_HOSTNAMES.has(hostname)) {
    reject("blocked-address")
  }

  if (hostname.endsWith(".localhost") || hostname.endsWith(".internal")) {
    reject("blocked-address")
  }

  if (isIP(hostname) !== 0 && isBlockedAddress(hostname)) {
    reject("blocked-address")
  }

  return { url, hostname }
}

export type RemoteImageResponse = {
  readonly status: number
  readonly location: string | null
  readonly body: ReadableStream<Uint8Array> | null
}

export type RemoteImageTransport = {
  readonly request: (
    url: URL,
    signal: AbortSignal
  ) => Promise<RemoteImageResponse>
  readonly resolve: (hostname: string) => Promise<readonly string[]>
}

class BlockedAddressError extends Error {
  constructor() {
    super("Remote product image address is not allowed.")
    this.name = "BlockedAddressError"
  }
}

/** Node can wrap a socket error in `cause` or in an AggregateError. */
export function isBlockedAddressError(error: unknown): boolean {
  if (error instanceof BlockedAddressError) {
    return true
  }

  if (error instanceof AggregateError) {
    return error.errors.some(isBlockedAddressError)
  }

  return error instanceof Error && error.cause !== undefined
    ? isBlockedAddressError(error.cause)
    : false
}

/**
 * Screens the addresses inside the resolver the socket actually uses, so a
 * rebinding answer cannot slip between the check and the connection.
 */
export function guardedLookup(
  hostname: string,
  options: LookupOneOptions | LookupAllOptions,
  callback: (
    error: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family?: number
  ) => void
) {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, "", 0)
      return
    }

    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => isBlockedAddress(address))
    ) {
      callback(new BlockedAddressError(), "", 0)
      return
    }

    if (options.all === true) {
      callback(null, addresses)
      return
    }

    const [first] = addresses
    callback(null, first.address, first.family)
  })
}

function nodeRequest(url: URL, signal: AbortSignal) {
  return new Promise<RemoteImageResponse>((resolve, rejectRequest) => {
    const request = httpsRequest(
      url,
      {
        method: "GET",
        headers: { accept: "image/*" },
        lookup: guardedLookup,
        signal,
      },
      (response) => {
        const location = response.headers.location

        resolve({
          status: response.statusCode ?? 0,
          location: typeof location === "string" ? location : null,
          body: Readable.toWeb(response) as ReadableStream<Uint8Array>,
        })
      }
    )

    request.on("error", rejectRequest)
    request.end()
  })
}

const DEFAULT_TRANSPORT: RemoteImageTransport = {
  request: nodeRequest,
  resolve: async (hostname) =>
    (await lookup(hostname, { all: true })).map(({ address }) => address),
}

async function assertPublicHostname({
  hostname,
  transport,
}: {
  hostname: string
  transport: RemoteImageTransport
}) {
  if (isIP(hostname) !== 0) {
    if (isBlockedAddress(hostname)) {
      reject("blocked-address")
    }

    return
  }

  let addresses: readonly string[]

  try {
    addresses = await transport.resolve(hostname)
  } catch (error) {
    return reject("unreachable", error)
  }

  if (addresses.length === 0 || addresses.some(isBlockedAddress)) {
    reject("blocked-address")
  }
}

async function readCappedBody(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  try {
    for (;;) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      size += value.byteLength

      if (size > MAX_IMAGE_BYTES) {
        reject("too-large")
      }

      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }

  const bytes = new Uint8Array(size)
  let offset = 0

  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  return bytes
}

async function drain(body: ReadableStream<Uint8Array> | null) {
  await body?.cancel().catch(() => undefined)
}

async function fetchFollowingRedirects({
  value,
  transport,
}: {
  value: string
  transport: RemoteImageTransport
}) {
  let target = value

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const { url, hostname } = parseRemoteImageUrl(target)
    await assertPublicHostname({ hostname, transport })

    let response: RemoteImageResponse

    try {
      response = await transport.request(
        url,
        AbortSignal.timeout(REMOTE_IMAGE_TIMEOUT_MS)
      )
    } catch (error) {
      return reject(
        isBlockedAddressError(error) ? "blocked-address" : "unreachable",
        error
      )
    }

    if (response.status >= 300 && response.status < 400) {
      await drain(response.body)

      if (!response.location) {
        throw new RemoteImageError({
          failure: "http-error",
          status: response.status,
        })
      }

      target = new URL(response.location, url).toString()
      continue
    }

    if (response.status < 200 || response.status >= 300) {
      await drain(response.body)
      throw new RemoteImageError({
        failure: "http-error",
        status: response.status,
      })
    }

    if (!response.body) {
      reject("unreachable")
    }

    return response.body
  }

  return reject("too-many-redirects")
}

export type RemoteImage = {
  readonly bytes: Uint8Array
  readonly mime: ProductImageMime
}

/** Validates decoded image data instead of trusting the URL or Content-Type. */
export async function fetchRemoteImage(
  value: string,
  transport: RemoteImageTransport = DEFAULT_TRANSPORT
): Promise<RemoteImage> {
  const body = await fetchFollowingRedirects({ value, transport })
  const bytes = await readCappedBody(body)

  if (bytes.byteLength === 0) {
    reject("unsupported-format")
  }

  const image = sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS })
  let format: string | undefined

  try {
    const metadata = await image.metadata()
    format = metadata.format
    await image
      .clone()
      .resize({ width: PROBE_SIZE, height: PROBE_SIZE, fit: "inside" })
      .toBuffer()
  } catch (error) {
    return reject("unsupported-format", error)
  }

  if (!format || !isSharpFormat(format)) {
    reject("unsupported-format")
  }

  return { bytes, mime: SHARP_MIMES[format] }
}

export function remoteImageMessage({
  slot,
  error,
}: {
  slot: number
  error: RemoteImageError
}) {
  const url = `URL Gambar ${slot}`
  const image = `Gambar ${slot}`

  switch (error.failure) {
    case "invalid-url":
      return `${url} tidak valid.`
    case "blocked-address":
      return `${url} mengarah ke alamat yang tidak diizinkan.`
    case "too-many-redirects":
      return `${url} punya terlalu banyak pengalihan.`
    case "unreachable":
      return `${image} tidak dapat diunduh.`
    case "http-error":
      return error.status === null
        ? `${image} tidak dapat diunduh.`
        : `Server gambar mengembalikan HTTP ${error.status} untuk ${image}.`
    case "too-large":
      return `${image} melebihi batas ukuran ${megabytes(MAX_IMAGE_BYTES)} MB.`
    case "unsupported-format":
      return `Format ${image} tidak didukung.`
    default: {
      const _exhaustive: never = error.failure
      return _exhaustive
    }
  }
}
