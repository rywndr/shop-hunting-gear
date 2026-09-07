import "server-only"

import { revalidateTag } from "next/cache"

export const STOREFRONT_PRODUCTS_TAG = "storefront-products"

// Shared by Server Actions and Route Handlers. Inventory changes must expire
// immediately rather than serve stale stock while revalidating in the background.
export function invalidateStorefrontProducts() {
  try {
    revalidateTag(STOREFRONT_PRODUCTS_TAG, { expire: 0 })
  } catch (error) {
    // The database has committed. Do not let a cache failure trigger callers'
    // upload cleanup or make them retry a successful inventory mutation.
    console.error("Storefront cache invalidation failed.", {
      event: "storefront.invalidation_failed",
      tag: STOREFRONT_PRODUCTS_TAG,
      error,
    })
  }
}
