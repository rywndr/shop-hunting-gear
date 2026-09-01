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

type CartContextValue = {
  readonly items: readonly CartItem[]
  readonly itemCount: number
  readonly open: boolean
  readonly pending: boolean
  readonly error: string | undefined
  readonly addItem: (input: AddToCartInput) => Promise<void>
  readonly removeItem: (itemId: string) => Promise<void>
  readonly clearCart: () => Promise<void>
  readonly setItemQuantity: (input: {
    readonly itemId: string
    readonly quantity: number
  }) => Promise<void>
  readonly setOpen: (open: boolean) => void
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
        setCartError({
          userId: responseUserId,
          message: "Keranjang tidak dapat diperbarui. Coba lagi.",
        })
        return
      }

      const result = cartItemsResponseSchema.safeParse(await response.json())

      if (!result.success) {
        setCartError({
          userId: responseUserId,
          message: "Data keranjang dari server tidak valid.",
        })
        return
      }

      setCartState({ userId: responseUserId, items: result.data.items })
      setCartError(undefined)
    },
    []
  )

  const mutateCart = useCallback(
    async ({
      method,
      body,
    }: {
      method: "POST" | "PATCH" | "DELETE"
      body: unknown
    }) => {
      if (!userId) {
        return
      }

      setMutationPending(true)

      try {
        const response = await fetch("/api/cart", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        await replaceFromResponse(response, userId)
      } catch {
        setCartError({
          userId,
          message: "Tidak dapat terhubung ke keranjang. Coba lagi.",
        })
      } finally {
        setMutationPending(false)
      }
    },
    [replaceFromResponse, userId]
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
      .then((response) => replaceFromResponse(response, userId))
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
        setOpen(true)
        await mutateCart({
          method: "POST",
          body: {
            productSlug: input.product.slug,
            quantity: input.quantity,
            variants: input.variants,
          },
        })
      },
      async removeItem(itemId) {
        await mutateCart({ method: "DELETE", body: { itemId } })
      },
      async clearCart() {
        await mutateCart({ method: "DELETE", body: { clear: true } })
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
