"use client"

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  addCartItem,
  cartItemCount,
  removeCartItem,
  setCartItemQuantity,
  type AddToCartInput,
  type CartItem,
} from "@/lib/cart/config"

type CartContextValue = {
  readonly items: readonly CartItem[]
  readonly itemCount: number
  readonly open: boolean
  readonly addItem: (input: AddToCartInput) => void
  readonly removeItem: (itemId: string) => void
  readonly setItemQuantity: (input: {
    readonly itemId: string
    readonly quantity: number
  }) => void
  readonly setOpen: (open: boolean) => void
}

const CartContext = createContext<CartContextValue | null>(null)

function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<readonly CartItem[]>([])
  const [open, setOpen] = useState(false)

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount: cartItemCount(items),
      open,
      addItem(input) {
        setItems((current) => addCartItem(current, input))
        setOpen(true)
      },
      removeItem(itemId) {
        setItems((current) => removeCartItem({ items: current, itemId }))
      },
      setItemQuantity({ itemId, quantity }) {
        setItems((current) =>
          setCartItemQuantity({ items: current, itemId, quantity })
        )
      },
      setOpen,
    }),
    [items, open]
  )

  return <CartContext value={value}>{children}</CartContext>
}

function useCart() {
  const cart = useContext(CartContext)

  if (!cart) {
    throw new Error("useCart harus digunakan di dalam CartProvider")
  }

  return cart
}

export { CartProvider, useCart }
