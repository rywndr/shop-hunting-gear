import {
  earningsBreakdown,
  earningsLineAmount,
  type EarningsGroup,
  type Transaction,
} from "@/lib/admin/finance"
import { cn } from "@/lib/utils"
import { formatRupiah, formatSignedRupiah } from "@/utils/format/intl"

function EarningsLines({
  group,
  strong = false,
}: {
  group: EarningsGroup
  strong?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {group.label}
      </p>

      <dl className="flex flex-col gap-1 text-xs sm:text-sm">
        {group.lines.map((line) => (
          <div
            key={line.label}
            className="flex items-baseline justify-between gap-4"
          >
            <dt className="text-muted-foreground">{line.label}</dt>
            <dd className="tabular-nums">
              {formatSignedRupiah(earningsLineAmount(line))}
            </dd>
          </div>
        ))}

        <div
          className={cn(
            "mt-0.5 flex items-baseline justify-between gap-4 border-t border-border pt-1.5 font-medium",
            strong && "font-heading font-bold"
          )}
        >
          <dt>{group.total.label}</dt>
          <dd className="tabular-nums">{formatRupiah(group.total.amount)}</dd>
        </div>
      </dl>
    </div>
  )
}

function TransactionBreakdown({ transaction }: { transaction: Transaction }) {
  const [payment, deductions] = earningsBreakdown(transaction)

  return (
    <div className="grid max-w-3xl gap-4 md:grid-cols-2 md:gap-10">
      <EarningsLines group={payment} />
      <EarningsLines group={deductions} strong />
    </div>
  )
}

export { TransactionBreakdown }
