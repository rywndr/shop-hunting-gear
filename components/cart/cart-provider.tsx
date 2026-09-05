"use client"

import {
  useCallback,
  createContext,
  useEffect,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  cartItemCount,
  type AddToCartInput,
  type CartItem,
} from "@/lib/cart/config"
import { cartItemsResponseSchema } from "@/lib/cart/schema"
import { authClient } from "@/lib/auth/client"
import { useNotification } from "@/components/notification/notification-provider"

type CartContextValue = {
  readonly items: readonly CartItem[]
  readonly itemCount: number
  readonly open: boolean
  readonly pending: boolean
  readonly error: string | undefined
  readonly addItem: (input: AddToCartInput) => Promise<void>
  readonly removeItem: (itemId: string) => Promise<void>
  readonly clearCart: (options?: ClearCartOptions) => Promise<CartMutationResult>
  readonly setItemQuantity: (input: {
    readonly itemId: string
    readonly quantity: number
  }) => Promise<void>
  readonly setOpen: (open: boolean) => void
}

type CartMutationResult =
  | { readonly kind: "success" }
  | { readonly kind: "error"; readonly message: string }

type ClearCartOptions = {
  readonly errorPresentation?: "notification" | "caller"
}

const CartContext = createContext<CartContextValue | null>(null)
const EMPTY_CART_ITEMS: readonly CartItem[] = []

type UserCartState = {
  readonly userId: string
  readonly items: readonly CartItem[]
}

type UserCartError = {
  readonly userId: string
  readonly message: string
}

function CartProvider({ children }: { children: ReactNode }) {
  const { showNotification } = useNotification()
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const userId = session?.user.id
  const [cartState, setCartState] = useState<UserCartState>()
  const [open, setOpen] = useState(false)
  const [mutationPending, setMutationPending] = useState(false)
  const [cartError, setCartError] = useState<UserCartError>()
  const items =
    userId && cartState?.userId === userId
      ? cartState.items
      : EMPTY_CART_ITEMS
  const error =
    userId && cartError?.userId === userId ? cartError.message : undefined
  const pending =
    sessionPending ||
    mutationPending ||
    Boolean(userId && cartState?.userId !== userId)

  const replaceFromResponse = useCallback(
    async (response: Response, responseUserId: string) => {
      if (!response.ok) {
        return "Keranjang tidak dapat diperbarui. Coba lagi."
      }

      let responseBody: unknown

      try {
        responseBody = await response.json()
      } catch {
        return "Data keranjang dari server tidak valid."
      }

      const result = cartItemsResponseSchema.safeParse(responseBody)

      if (!result.success) {
        return "Data keranjang dari server tidak valid."
      }

      setCartState({ userId: responseUserId, items: result.data.items })
      setCartError(undefined)
      return undefined
    },
    []
  )

  const mutateCart = useCallback(
    async ({
      method,
      body,
      successMessage,
      errorPresentation = "inline",
    }: {
      method: "POST" | "PATCH" | "DELETE"
      body: unknown
      successMessage?: string
      errorPresentation?: "inline" | "notification" | "caller"
    }): Promise<CartMutationResult> => {
      const reportError = (
        message: string,
        mutationUserId?: string
      ): CartMutationResult => {
        if (errorPresentation === "notification") {
          showNotification({ variant: "error", message })
        } else if (errorPresentation === "inline" && mutationUserId) {
          setCartError({ userId: mutationUserId, message })
        }

        return { kind: "error", message }
      }

      if (!userId) {
        return reportError(
          "Sesi Anda sudah berakhir. Masuk kembali untuk memperbarui keranjang."
        )
      }

      setMutationPending(true)
      if (errorPresentation !== "inline") {
        setCartError(undefined)
      }

      try {
        const response = await fetch("/api/cart", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const errorMessage = await replaceFromResponse(response, userId)

        if (errorMessage) {
          return reportError(errorMessage, userId)
        }

        if (successMessage) {
          showNotification({ variant: "success", message: successMessage })
        }
        return { kind: "success" }
      } catch {
        return reportError(
          "Tidak dapat terhubung ke keranjang. Coba lagi.",
          userId
        )
      } finally {
        setMutationPending(false)
      }
    },
    [replaceFromResponse, showNotification, userId]
  )

  useEffect(() => {
    if (sessionPending) {
      return
    }

    if (!userId) {
      return
    }

    const abortController = new AbortController()

    fetch("/api/cart", { signal: abortController.signal })
      .then(async (response) => {
        const errorMessage = await replaceFromResponse(response, userId)

        if (errorMessage) {
          setCartError({ userId, message: errorMessage })
        }
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          return
        }

        setCartError({
          userId,
          message: "Tidak dapat memuat keranjang. Coba lagi.",
        })
      })

    return () => abortController.abort()
  }, [replaceFromResponse, sessionPending, userId])

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount: cartItemCount(items),
      open,
      pending,
      error,
      async addItem(input) {
        await mutateCart({
          method: "POST",
          successMessage: "Produk ditambahkan ke keranjang.",
          errorPresentation: "notification",
          body: {
            productSlug: input.product.slug,
            quantity: input.quantity,
            variants: input.variants,
          },
        })
      },
      async removeItem(itemId) {
        await mutateCart({
          method: "DELETE",
          body: { itemId },
        })
      },
      async clearCart({ errorPresentation = "notification" } = {}) {
        return mutateCart({
          method: "DELETE",
          body: { clear: true },
          errorPresentation,
        })
      },
      async setItemQuantity({ itemId, quantity }) {
        await mutateCart({ method: "PATCH", body: { itemId, quantity } })
      },
      setOpen,
    }),
    [error, items, mutateCart, open, pending]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

function useCart() {
  const cart = useContext(CartContext)

  if (!cart) {
    throw new Error("useCart harus digunakan di dalam CartProvider")
  }

  return cart
}

export { CartProvider, useCart }
