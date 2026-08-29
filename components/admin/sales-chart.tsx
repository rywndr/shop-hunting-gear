"use client"

import { useState } from "react"
import { CartesianGrid, Line, LineChart, XAxis } from "recharts"

import { AdminCard } from "@/components/admin/admin-card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  DEFAULT_SALES_RANGE,
  isSalesRangeKey,
  salesInRange,
  salesTotal,
  SALES_RANGES,
  type DailySales,
  type SalesRangeKey,
} from "@/lib/admin/config"
import {
  formatDayMonth,
  formatRupiah,
  formatShortDate,
} from "@/utils/format/intl"

const CHART_CONFIG = {
  amount: { label: "Penjualan", color: "var(--chart-3)" },
} satisfies ChartConfig

const RANGE_KEYS = Object.keys(SALES_RANGES).filter(isSalesRangeKey)

function SalesChart({ series }: { series: readonly DailySales[] }) {
  const [range, setRange] = useState<SalesRangeKey>(DEFAULT_SALES_RANGE)
  const data = salesInRange(series, range)

  return (
    <AdminCard title="Penjualan Harian" description="Nilai penjualan per hari.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Total{" "}
          <span className="font-heading font-bold text-foreground tabular-nums">
            {formatRupiah(salesTotal(data))}
          </span>
        </p>

        <ToggleGroup
          aria-label="Rentang waktu grafik"
          variant="outline"
          spacing={0}
          value={[range]}
          onValueChange={(next) => {
            const [selected] = next

            // Base UI allows unpressing the active item, a chart needs a range.
            if (selected && isSalesRangeKey(selected)) {
              setRange(selected)
            }
          }}
        >
          {RANGE_KEYS.map((key) => (
            <ToggleGroupItem key={key} value={key}>
              {SALES_RANGES[key].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <ChartContainer
        config={CHART_CONFIG}
        className="mt-4 aspect-auto h-52 w-full sm:h-64"
      >
        <LineChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(value: string) => formatDayMonth(value)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(label) => formatShortDate(String(label))}
                formatter={(value) => (
                  <span className="font-mono font-medium tabular-nums">
                    {formatRupiah(Number(value))}
                  </span>
                )}
              />
            }
          />
          <Line
            dataKey="amount"
            type="monotone"
            stroke="var(--color-amount)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ChartContainer>
    </AdminCard>
  )
}

export { SalesChart }
