import assert from "node:assert/strict"
import test from "node:test"

import {
  completeRouteProgress,
  getRouteProgressSnapshot,
  startRouteProgress,
} from "../lib/navigation/route-progress"

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { location: new URL("https://example.com/") },
})

function setCommittedRoute(url: string) {
  window.location.href = new URL(url, window.location.href).href
  completeRouteProgress(url)
}

test("route progress follows navigation lifecycle", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] })
  setCommittedRoute("/")

  startRouteProgress("/product/foo")
  assert.deepEqual(getRouteProgressSnapshot(), {
    generation: 1,
    pending: true,
    visible: false,
    committed: "/",
    source: "/",
    target: "/product/foo",
  })

  context.mock.timers.tick(120)
  assert.equal(getRouteProgressSnapshot().visible, true)

  completeRouteProgress("/product/foo")
  assert.deepEqual(getRouteProgressSnapshot(), {
    generation: 1,
    pending: false,
    visible: false,
    committed: "/product/foo",
    source: null,
    target: null,
  })

  startRouteProgress("/fast")
  completeRouteProgress("/fast")
  context.mock.timers.tick(120)
  assert.equal(getRouteProgressSnapshot().visible, false)

  startRouteProgress("/first")
  context.mock.timers.tick(60)
  startRouteProgress("/second")
  context.mock.timers.tick(60)
  assert.deepEqual(getRouteProgressSnapshot(), {
    generation: 4,
    pending: true,
    visible: false,
    committed: "/fast",
    source: "/fast",
    target: "/second",
  })
  completeRouteProgress("/second")
  assert.equal(getRouteProgressSnapshot().pending, false)

  setCommittedRoute("/")
  startRouteProgress("/product/foo")
  startRouteProgress("/")
  assert.deepEqual(getRouteProgressSnapshot(), {
    generation: 6,
    pending: false,
    visible: false,
    committed: "/",
    source: null,
    target: null,
  })

  startRouteProgress("/?q=hunting%20gear")
  completeRouteProgress("/?q=hunting+gear")
  assert.equal(getRouteProgressSnapshot().pending, false)
  assert.equal(getRouteProgressSnapshot().committed, "/?q=hunting+gear")

  setCommittedRoute("/admin/produk?tab=active")
  startRouteProgress("/admin/produk?tab=all")
  completeRouteProgress("/admin/produk?tab=all")
  assert.equal(getRouteProgressSnapshot().pending, false)

  setCommittedRoute("/admin")
  startRouteProgress("/admin/produk")
  completeRouteProgress("/admin/produk?tab=active")
  assert.equal(getRouteProgressSnapshot().pending, false)

  setCommittedRoute("/")
  startRouteProgress("/slow")
  completeRouteProgress("/")
  assert.equal(getRouteProgressSnapshot().pending, true)
  completeRouteProgress("/slow")

  setCommittedRoute("/product/foo")
  window.location.href = "https://example.com/"
  startRouteProgress("/")
  assert.equal(getRouteProgressSnapshot().pending, true)
  assert.equal(getRouteProgressSnapshot().source, "/product/foo")
  completeRouteProgress("/")
  assert.equal(getRouteProgressSnapshot().pending, false)

  setCommittedRoute("/akun")
  startRouteProgress("/")
  startRouteProgress("/admin")
  completeRouteProgress("/")
  assert.equal(getRouteProgressSnapshot().pending, false)
  assert.equal(getRouteProgressSnapshot().committed, "/")

  startRouteProgress("/unresolved")
  context.mock.timers.tick(120_000)
  assert.deepEqual(getRouteProgressSnapshot(), {
    generation: 14,
    pending: false,
    visible: false,
    committed: "/",
    source: null,
    target: null,
  })
})
