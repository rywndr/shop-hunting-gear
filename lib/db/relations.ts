import { defineRelations } from "drizzle-orm"

import { address } from "./schema/account"
import { user } from "./schema/auth"
import { cartItem } from "./schema/cart"
import {
  customerOrder,
  customerOrderItem,
  orderInventoryReservation,
} from "./schema/order"
import { product, productListing } from "./schema/product"

export const applicationRelations = defineRelations(
  {
    user,
    address,
    cartItem,
    customerOrder,
    customerOrderItem,
    orderInventoryReservation,
    product,
    productListing,
  },
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
      orders: relations.many.customerOrder({
        from: relations.user.id,
        to: relations.customerOrder.userId,
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
    customerOrder: {
      user: relations.one.user({
        from: relations.customerOrder.userId,
        to: relations.user.id,
      }),
      items: relations.many.customerOrderItem({
        from: relations.customerOrder.id,
        to: relations.customerOrderItem.orderId,
      }),
      inventoryReservations: relations.many.orderInventoryReservation({
        from: relations.customerOrder.id,
        to: relations.orderInventoryReservation.orderId,
      }),
    },
    customerOrderItem: {
      order: relations.one.customerOrder({
        from: relations.customerOrderItem.orderId,
        to: relations.customerOrder.id,
      }),
    },
    orderInventoryReservation: {
      order: relations.one.customerOrder({
        from: relations.orderInventoryReservation.orderId,
        to: relations.customerOrder.id,
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
