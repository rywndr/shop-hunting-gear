"use client"

import { FilterToggle } from "@/components/admin/filter-toggle"
import { ALL_FILTER } from "@/lib/admin/config"
import {
  isOrderQueueFilter,
  orderQueueFilterLabel,
  ORDER_QUEUES,
  ORDER_QUEUE_FILTER_ORDER,
  type OrderQueue,
  type OrderQueueFilter,
} from "@/lib/admin/orders"

function queueCount(
  filter: OrderQueueFilter,
  counts: Readonly<Record<OrderQueue, number>>
) {
  return filter !== ALL_FILTER && ORDER_QUEUES[filter].counted
    ? counts[filter]
    : undefined
}

function OrderQueueToggle({
  queue,
  counts,
  onQueueChange,
}: {
  queue: OrderQueueFilter
  counts: Readonly<Record<OrderQueue, number>>
  onQueueChange: (queue: OrderQueueFilter) => void
}) {
  return (
    <FilterToggle
      label="Status pesanan"
      value={queue}
      isValue={isOrderQueueFilter}
      onValueChange={onQueueChange}
      options={ORDER_QUEUE_FILTER_ORDER.map((filter) => ({
        value: filter,
        label: orderQueueFilterLabel(filter),
        count: queueCount(filter, counts),
      }))}
    />
  )
}

export { OrderQueueToggle }
