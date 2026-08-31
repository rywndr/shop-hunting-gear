import { defineRelations } from "drizzle-orm"

import { address } from "./schema/account"
import { user } from "./schema/auth"
import { cartItem } from "./schema/cart"
import { product, productListing } from "./schema/product"

export const applicationRelations = defineRelations(
  { user, address, cartItem, product, productListing },
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
    product: {
      listing: relations.one.productListing({
        from: relations.product.id,
        to: relations.productListing.productId,
      }),
    },
    productListing: {
      product: relations.one.product({
        from: relations.productListing.productId,
        to: relations.product.id,
      }),
    },
  })
)
