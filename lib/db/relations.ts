import { defineRelations } from "drizzle-orm"

import { address } from "./schema/account"
import { user } from "./schema/auth"
import { cartItem } from "./schema/cart"

export const applicationRelations = defineRelations(
  { user, address, cartItem },
  (relations) => ({
    user: {
      addresses: relations.many.address({
        from: relations.user.id,
        to: relations.address.userId,
      }),
      cartItems: relations.many.cartItem({
        from: relations.user.id,
        to: relations.cartItem.userId,
      }),
    },
    address: {
      user: relations.one.user({
        from: relations.address.userId,
        to: relations.user.id,
      }),
    },
    cartItem: {
      user: relations.one.user({
        from: relations.cartItem.userId,
        to: relations.user.id,
      }),
    },
  })
)
