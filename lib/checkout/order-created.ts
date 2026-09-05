type OrderCreatedResult =
  | { readonly kind: "success" }
  | { readonly kind: "error"; readonly message: string }

const ORDER_CREATED_CLEANUP_ERROR_MESSAGE =
  "Pesanan berhasil dibuat, tetapi keranjang belum dapat dikosongkan. Coba muat ulang halaman."

async function normalizeOrderCreated(
  onOrderCreated: () => Promise<OrderCreatedResult>
): Promise<OrderCreatedResult> {
  try {
    return await onOrderCreated()
  } catch {
    return {
      kind: "error",
      message: ORDER_CREATED_CLEANUP_ERROR_MESSAGE,
    }
  }
}

function completePaymentNavigation({
  cleanupResult,
  onCleanupError,
  navigate,
  refresh,
}: {
  readonly cleanupResult: Promise<OrderCreatedResult> | undefined
  readonly onCleanupError: (message: string) => void
  readonly navigate: () => void
  readonly refresh: () => void
}) {
  if (cleanupResult) {
    void cleanupResult.then((result) => {
      if (result.kind === "error") {
        onCleanupError(result.message)
      }
    })
  }

  navigate()
  refresh()
}

export {
  ORDER_CREATED_CLEANUP_ERROR_MESSAGE,
  completePaymentNavigation,
  normalizeOrderCreated,
}
export type { OrderCreatedResult }
