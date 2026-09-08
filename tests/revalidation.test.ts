import assert from "node:assert/strict"
import test from "node:test"

import { revalidatePathsBestEffort } from "../lib/returns/revalidation"

test("best-effort invalidation continues after one path fails", (t) => {
  t.mock.method(console, "error", () => {})
  const paths = ["/orders", "/admin/orders", "/admin/finance"]
  const attempted: string[] = []

  assert.doesNotThrow(() =>
    revalidatePathsBestEffort({
      paths,
      revalidate: (path) => {
        attempted.push(path)
        if (path === "/admin/orders") {
          throw new Error("invalidation unavailable")
        }
      },
    })
  )
  assert.deepEqual(attempted, paths)
})
