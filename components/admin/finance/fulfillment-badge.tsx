import { Badge } from "@/components/ui/badge"
import { FULFILLMENT_STAGES, type FulfillmentStage } from "@/lib/admin/finance"

function FulfillmentBadge({
  fulfillment,
  className,
}: {
  fulfillment: FulfillmentStage
  className?: string
}) {
  const { label, badge } = FULFILLMENT_STAGES[fulfillment]

  return (
    <Badge variant={badge} className={className}>
      {label}
    </Badge>
  )
}

export { FulfillmentBadge }
