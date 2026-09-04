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
import { productReview, productReviewMedia } from "./schema/review"

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
    productReview,
    productReviewMedia,
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
      productReviews: relations.many.productReview({
        from: relations.user.id,
        to: relations.productReview.userId,
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
      review: relations.one.productReview({
        from: relations.customerOrderItem.id,
        to: relations.productReview.orderItemId,
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
      customerReviews: relations.many.productReview({
        from: relations.product.id,
        to: relations.productReview.productId,
      }),
    },
    productReview: {
      product: relations.one.product({
        from: relations.productReview.productId,
        to: relations.product.id,
      }),
      orderItem: relations.one.customerOrderItem({
        from: relations.productReview.orderItemId,
        to: relations.customerOrderItem.id,
      }),
      user: relations.one.user({
        from: relations.productReview.userId,
        to: relations.user.id,
      }),
      images: relations.many.productReviewMedia({
        from: relations.productReview.id,
        to: relations.productReviewMedia.reviewId,
      }),
    },
    productReviewMedia: {
      review: relations.one.productReview({
        from: relations.productReviewMedia.reviewId,
        to: relations.productReview.id,
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
