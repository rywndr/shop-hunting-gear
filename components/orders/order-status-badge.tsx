import { Badge } from "@/components/ui/badge"
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/config"
import { cn } from "@/lib/utils"

function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus
  className?: string
}) {
  const { label, badge } = ORDER_STATUSES[status]

  return (
    <Badge
      variant={badge}
      className={cn(
        status === "cancelled" && "text-muted-foreground",
        className
      )}
    >
      {label}
    </Badge>
  )
}

export { OrderStatusBadge }
