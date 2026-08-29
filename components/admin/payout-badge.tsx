"use client"

import { CheckCircleIcon, HourglassMediumIcon } from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { PAYOUT_STATES, type PayoutState } from "@/lib/admin/finance"
import { cn } from "@/lib/utils"

const PAYOUT_ICONS = {
  pending: HourglassMediumIcon,
  released: CheckCircleIcon,
} satisfies Record<PayoutState, Icon>

function PayoutBadge({
  payout,
  className,
}: {
  payout: PayoutState
  className?: string
}) {
  const { statusLabel, badge } = PAYOUT_STATES[payout]
  const PayoutIcon = PAYOUT_ICONS[payout]

  return (
    <Badge variant={badge} className={cn("gap-1", className)}>
      <PayoutIcon aria-hidden />
      {statusLabel}
    </Badge>
  )
}

export { PayoutBadge }
