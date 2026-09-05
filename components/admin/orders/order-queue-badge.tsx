import { Badge } from "@/components/ui/badge"
import { ORDER_QUEUES, type OrderQueue } from "@/lib/admin/orders"
import { cn } from "@/lib/utils"

function OrderQueueBadge({
  queue,
  className,
}: {
  queue: OrderQueue
  className?: string
}) {
  const { label, badge } = ORDER_QUEUES[queue]

  return (
    <Badge
      variant={badge}
      className={cn(
        queue === "returns" && "text-muted-foreground",
        className
      )}
    >
      {label}
    </Badge>
  )
}

export { OrderQueueBadge }
