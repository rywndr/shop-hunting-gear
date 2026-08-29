import {
  MinusIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@phosphor-icons/react/ssr"
import type { Icon } from "@phosphor-icons/react"

import { AdminCard, AdminMetricGrid } from "@/components/admin/admin-card"
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
      <AdminMetricGrid
        metrics={metrics.map((metric) => ({
          label: metric.label,
          meta: (
            <span className="tabular-nums">
              {formatNumber(metric.orderCount)} pesanan
            </span>
          ),
          value: formatRupiah(metric.amount),
          footnote: <MetricChange metric={metric} />,
        }))}
      />
    </AdminCard>
  )
}

export { SalesSummary }
