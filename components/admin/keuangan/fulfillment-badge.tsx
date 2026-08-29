"use client"

import {
  CheckCircleIcon,
  ClockCountdownIcon,
  TruckIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import {
  FULFILLMENT_STAGES,
  type FulfillmentStage,
} from "@/lib/admin/finance"
import { cn } from "@/lib/utils"

const FULFILLMENT_ICONS = {
  inTransit: TruckIcon,
  awaitingCompletion: ClockCountdownIcon,
  completed: CheckCircleIcon,
} satisfies Record<FulfillmentStage, Icon>

function FulfillmentBadge({
  fulfillment,
  className,
}: {
  fulfillment: FulfillmentStage
  className?: string
}) {
  const { label, badge } = FULFILLMENT_STAGES[fulfillment]
  const FulfillmentIcon = FULFILLMENT_ICONS[fulfillment]

  return (
    <Badge variant={badge} className={cn("gap-1", className)}>
      <FulfillmentIcon aria-hidden />
      {label}
    </Badge>
  )
}

export { FulfillmentBadge }
