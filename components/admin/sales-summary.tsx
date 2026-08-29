import {
  MinusIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@phosphor-icons/react/ssr"
import type { Icon } from "@phosphor-icons/react"

import { AdminCard } from "@/components/admin/admin-card"
import {
  metricTrend,
  type MetricTrend,
  type SalesMetric,
} from "@/lib/admin/config"
import {
  formatNumber,
  formatRupiah,
  formatSignedPercent,
} from "@/utils/format/intl"
import { cn } from "@/lib/utils"

const TRENDS = {
  up: { icon: TrendUpIcon, className: "text-foreground" },
  down: { icon: TrendDownIcon, className: "text-destructive" },
  flat: { icon: MinusIcon, className: "text-muted-foreground" },
} satisfies Record<MetricTrend, { icon: Icon; className: string }>

function comparisonLabel(periodDays: number) {
  return periodDays === 1
    ? "dari hari sebelumnya"
    : `dari ${formatNumber(periodDays)} hari sebelumnya`
}

function MetricChange({ metric }: { metric: SalesMetric }) {
  const { icon: TrendIcon, className } = TRENDS[metricTrend(metric.change)]

  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-1 font-medium tabular-nums",
          className
        )}
      >
        <TrendIcon className="size-3.5" aria-hidden />
        {formatSignedPercent(metric.change)}
      </span>
      <span className="text-muted-foreground">
        {comparisonLabel(metric.periodDays)}
      </span>
    </span>
  )
}

function SalesSummary({ metrics }: { metrics: readonly SalesMetric[] }) {
  return (
    <AdminCard title="Ringkasan Penjualan" contentClassName="px-0">
      <dl className="grid divide-y divide-border sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="px-(--card-spacing) py-3 first:pt-0 last:pb-0 sm:py-0"
          >
            <dt className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
              <span className="font-medium tracking-wide uppercase">
                {metric.label}
              </span>
              <span className="tabular-nums">
                {formatNumber(metric.orderCount)} pesanan
              </span>
            </dt>
            <dd className="mt-1.5">
              <span className="block font-heading text-xl font-bold tabular-nums sm:text-2xl">
                {formatRupiah(metric.amount)}
              </span>
              <MetricChange metric={metric} />
            </dd>
          </div>
        ))}
      </dl>
    </AdminCard>
  )
}

export { SalesSummary }
