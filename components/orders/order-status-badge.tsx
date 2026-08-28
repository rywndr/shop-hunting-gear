import {
  CheckCircleIcon,
  ClockIcon,
  PackageIcon,
  TruckIcon,
  XCircleIcon,
} from "@phosphor-icons/react/ssr"
import type { Icon } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/config"
import { cn } from "@/lib/utils"

const STATUS_ICONS = {
  unpaid: ClockIcon,
  processing: PackageIcon,
  shipped: TruckIcon,
  completed: CheckCircleIcon,
  cancelled: XCircleIcon,
} satisfies Record<OrderStatus, Icon>

function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus
  className?: string
}) {
  const { label, badge } = ORDER_STATUSES[status]
  const StatusIcon = STATUS_ICONS[status]

  return (
    <Badge
      variant={badge}
      className={cn(
        "gap-1",
        status === "cancelled" && "text-muted-foreground",
        className
      )}
    >
      <StatusIcon aria-hidden />
      {label}
    </Badge>
  )
}

export { OrderStatusBadge }
