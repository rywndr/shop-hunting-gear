import "server-only"
import { revalidatePath } from "next/cache"

type PathRevalidator = (path: string) => void

export function revalidatePathsBestEffort({
  paths,
  revalidate = revalidatePath,
}: {
  readonly paths: readonly string[]
  readonly revalidate?: PathRevalidator
}) {
  for (const path of paths) {
    try {
      revalidate(path)
    } catch (error) {
      console.error("View invalidation failed.", {
        event: "returns.private_invalidation_failed",
        path,
        error,
      })
    }
  }
}

export function revalidateReturnViews({
  finance = false,
}: { readonly finance?: boolean } = {}) {
  revalidatePathsBestEffort({
    paths: ["/orders", "/admin/orders", ...(finance ? ["/admin/finance"] : [])],
  })
}
