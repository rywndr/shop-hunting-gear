import assert from "node:assert/strict"
import test from "node:test"
import sharp from "sharp"

import { MAX_IMAGE_BYTES } from "../lib/admin/product-bulk/limits"
import {
  fetchRemoteImage,
  isBlockedAddress,
  parseRemoteImageUrl,
  remoteImageMessage,
  RemoteImageError,
  type RemoteImageFailure,
  type RemoteImageTransport,
} from "../lib/admin/product-bulk/remote-image"

const PUBLIC_ADDRESS = "93.184.216.34"
const URL_UNDER_TEST = "https://cdn.example.com/foto.jpg"

function transport({
  handler,
  addresses = [PUBLIC_ADDRESS],
}: {
  handler: (url: URL) => Response | Promise<Response>
  addresses?: readonly string[]
}): RemoteImageTransport {
  return {
    fetch: async (input) => handler(new URL(String(input))),
    resolve: async () => addresses,
  }
}

async function failureOf(
  run: () => Promise<unknown>
): Promise<RemoteImageFailure> {
  try {
    await run()
  } catch (error) {
    assert.ok(error instanceof RemoteImageError, String(error))
    return error.failure
  }

  throw new Error("Expected a RemoteImageError.")
}

test("private, loopback, link-local, and metadata addresses are blocked", () => {
  for (const address of [
    "127.0.0.1",
    "127.53.1.9",
    "0.0.0.0",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "198.18.0.1",
    "224.0.0.1",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "64:ff9b::169.254.169.254",
    "2001:db8::1",
    "bukan-alamat",
  ]) {
    assert.equal(isBlockedAddress(address), true, address)
  }
})

test("public addresses pass the address filter", () => {
  for (const address of [
    PUBLIC_ADDRESS,
    "8.8.8.8",
    "172.32.0.1",
    "2606:2800:220:1:248:1893:25c8:1946",
  ]) {
    assert.equal(isBlockedAddress(address), false, address)
  }
})

test("only https urls without credentials are accepted", () => {
  assert.doesNotThrow(() => parseRemoteImageUrl(URL_UNDER_TEST))

  for (const value of [
    "bukan-url",
    "http://cdn.example.com/a.jpg",
    "ftp://cdn.example.com/a.jpg",
    "file:///etc/passwd",
    "https://user:secret@cdn.example.com/a.jpg",
  ]) {
    assert.throws(() => parseRemoteImageUrl(value), RemoteImageError, value)
  }
})

test("local and internal hostnames are blocked before any request", () => {
  for (const value of [
    "https://localhost/a.jpg",
    "https://app.localhost/a.jpg",
    "https://metadata.google.internal/a.jpg",
    "https://queue.internal/a.jpg",
    "https://[::1]/a.jpg",
    "https://127.0.0.1/a.jpg",
  ]) {
    assert.throws(() => parseRemoteImageUrl(value), RemoteImageError, value)
  }
})

test("a hostname that resolves to a private address is blocked", async () => {
  const failure = await failureOf(() =>
    fetchRemoteImage(
      URL_UNDER_TEST,
      transport({
        addresses: ["10.0.0.5"],
        handler: () => new Response(null, { status: 200 }),
      })
    )
  )

  assert.equal(failure, "blocked-address")
})

test("a hostname without addresses is blocked", async () => {
  const failure = await failureOf(() =>
    fetchRemoteImage(
      URL_UNDER_TEST,
      transport({
        addresses: [],
        handler: () => new Response(null, { status: 200 }),
      })
    )
  )

  assert.equal(failure, "blocked-address")
})

test("an http status failure reports the status", async () => {
  try {
    await fetchRemoteImage(
      URL_UNDER_TEST,
      transport({ handler: () => new Response(null, { status: 404 }) })
    )
    throw new Error("Expected a RemoteImageError.")
  } catch (error) {
    assert.ok(error instanceof RemoteImageError)
    assert.equal(error.failure, "http-error")
    assert.equal(error.status, 404)
    assert.equal(
      remoteImageMessage({ slot: 2, error }),
      "Server gambar mengembalikan HTTP 404 untuk Gambar 2."
    )
  }
})

test("a redirect to a private address is blocked", async () => {
  const failure = await failureOf(() =>
    fetchRemoteImage(
      URL_UNDER_TEST,
      transport({
        addresses: ["10.0.0.9"],
        handler: (url) =>
          url.hostname === "cdn.example.com"
            ? new Response(null, {
                status: 302,
                headers: { location: "https://internal.example.com/a.jpg" },
              })
            : new Response(null, { status: 200 }),
      })
    )
  )

  assert.equal(failure, "blocked-address")
})

test("an endless redirect chain stops at the redirect limit", async () => {
  let hops = 0
  const failure = await failureOf(() =>
    fetchRemoteImage(
      URL_UNDER_TEST,
      transport({
        handler: () => {
          hops += 1
          return new Response(null, {
            status: 302,
            headers: { location: `https://cdn.example.com/${hops}.jpg` },
          })
        },
      })
    )
  )

  assert.equal(failure, "too-many-redirects")
  assert.ok(hops <= 5, `too many hops: ${hops}`)
})

test("a network abort reports an unreachable image", async () => {
  const failure = await failureOf(() =>
    fetchRemoteImage(
      URL_UNDER_TEST,
      transport({
        handler: () => {
          throw new DOMException("The operation was aborted.", "TimeoutError")
        },
      })
    )
  )

  assert.equal(failure, "unreachable")
})

test("an oversized image stops while streaming", async () => {
  const chunk = new Uint8Array(1024 * 1024)
  const chunks = Math.ceil(MAX_IMAGE_BYTES / chunk.byteLength) + 1
  let sent = 0
  const failure = await failureOf(() =>
    fetchRemoteImage(
      URL_UNDER_TEST,
      transport({
        handler: () =>
          new Response(
            new ReadableStream<Uint8Array>({
              pull(controller) {
                if (sent >= chunks) {
                  controller.close()
                  return
                }

                sent += 1
                controller.enqueue(chunk)
              },
            }),
            { status: 200, headers: { "content-length": "10" } }
          ),
      })
    )
  )

  assert.equal(failure, "too-large")
  assert.ok(sent <= chunks, "the reader kept pulling after the limit")
})

test("bytes that are not an image are rejected", async () => {
  const failure = await failureOf(() =>
    fetchRemoteImage(
      URL_UNDER_TEST,
      transport({
        handler: () =>
          new Response(new TextEncoder().encode("<html>bukan gambar</html>"), {
            status: 200,
            headers: { "content-type": "image/jpeg" },
          }),
      })
    )
  )

  assert.equal(failure, "unsupported-format")
})

test("an empty body is rejected", async () => {
  const failure = await failureOf(() =>
    fetchRemoteImage(
      URL_UNDER_TEST,
      transport({
        handler: () => new Response(new Uint8Array(), { status: 200 }),
      })
    )
  )

  assert.equal(failure, "unsupported-format")
})

async function sampleImage(format: "png" | "jpeg" | "webp" | "gif") {
  const image = sharp({
    create: {
      width: 24,
      height: 24,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })

  switch (format) {
    case "png":
      return image.png().toBuffer()
    case "jpeg":
      return image.jpeg().toBuffer()
    case "webp":
      return image.webp().toBuffer()
    case "gif":
      return image.gif().toBuffer()
  }
}

test("supported formats resolve to the stored mime type", async () => {
  for (const [format, mime] of [
    ["png", "image/png"],
    ["jpeg", "image/jpeg"],
    ["webp", "image/webp"],
  ] as const) {
    const bytes = await sampleImage(format)
    const image = await fetchRemoteImage(
      URL_UNDER_TEST,
      transport({
        handler: () =>
          new Response(bytes, {
            status: 200,
            headers: { "content-type": "application/octet-stream" },
          }),
      })
    )

    assert.equal(image.mime, mime)
    assert.equal(image.bytes.byteLength, bytes.byteLength)
  }
})

test("an unsupported image format is rejected despite a valid image", async () => {
  const bytes = await sampleImage("gif")
  const failure = await failureOf(() =>
    fetchRemoteImage(
      URL_UNDER_TEST,
      transport({
        handler: () =>
          new Response(bytes, {
            status: 200,
            headers: { "content-type": "image/png" },
          }),
      })
    )
  )

  assert.equal(failure, "unsupported-format")
})

test("image failures read as Indonesian row messages", () => {
  const messages = (
    [
      "invalid-url",
      "blocked-address",
      "unreachable",
      "too-large",
      "unsupported-format",
      "too-many-redirects",
    ] as const
  ).map((failure) =>
    remoteImageMessage({ slot: 1, error: new RemoteImageError({ failure }) })
  )

  assert.deepEqual(messages, [
    "URL Gambar 1 tidak valid.",
    "URL Gambar 1 mengarah ke alamat yang tidak diizinkan.",
    "Gambar 1 tidak dapat diunduh.",
    "Gambar 1 melebihi batas ukuran 10 MB.",
    "Format Gambar 1 tidak didukung.",
    "URL Gambar 1 punya terlalu banyak pengalihan.",
  ])
})

test("public marketplace cdn hosts pass the url and address screen", () => {
  for (const value of [
    "https://id-live.slatic.net/p/02d7d55da58351c6a95e1a6c5a6d143c.jpg",
    "https://cf.shopee.co.id/file/id-11134207-82251-mfw7b3lnsao879",
    "https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/076f384aec3a4ed6bd9bd48169e17d15~tplv-aphluv4xwc-origin-jpeg.jpeg?dr=15568&width=567",
  ]) {
    const parsed = parseRemoteImageUrl(value)

    assert.equal(parsed.url.toString(), value)
  }
})

test("a url without a file extension still reaches the byte check", async () => {
  const bytes = await sampleImage("jpeg")
  const image = await fetchRemoteImage(
    "https://cf.shopee.co.id/file/id-11134207-82251-mfw7b3lnsao879",
    transport({
      handler: () =>
        new Response(bytes, {
          status: 200,
          headers: { "content-type": "binary/octet-stream" },
        }),
    })
  )

  assert.equal(image.mime, "image/jpeg")
})
