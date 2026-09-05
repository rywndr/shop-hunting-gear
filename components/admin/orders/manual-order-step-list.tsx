import { CheckIcon } from "@phosphor-icons/react/ssr"

import {
  MANUAL_ORDER_STEP_ORDER,
  MANUAL_ORDER_STEPS,
  type ManualOrderStep,
} from "@/lib/admin/manual-order"
import { cn } from "@/lib/utils"

function ManualOrderStepList({ current }: { current: ManualOrderStep }) {
  const currentIndex = MANUAL_ORDER_STEP_ORDER.indexOf(current)

  return (
    <ol
      aria-label="Tahapan pembuatan pesanan"
      className="grid grid-cols-3 gap-2"
    >
      {MANUAL_ORDER_STEPS.map((step, index) => {
        const complete = index < currentIndex
        const active = step.key === current

        return (
          <li
            key={step.key}
            aria-current={active ? "step" : undefined}
            className="flex min-w-0 flex-col gap-2"
          >
            <span
              className={cn(
                "h-1 bg-muted",
                (complete || active) && "bg-primary"
              )}
            />
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <span className="flex size-5 shrink-0 items-center justify-center border border-border text-[11px]">
                {complete ? <CheckIcon aria-hidden="true" /> : index + 1}
              </span>
              <span className="truncate">{step.label}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export { ManualOrderStepList }
