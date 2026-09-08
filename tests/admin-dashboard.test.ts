import assert from "node:assert/strict"
import test from "node:test"

import {
  dashboardSalesMetrics,
  fillDailySalesDays,
  type DailySales,
} from "../lib/admin/config"

test("fillDailySalesDays inserts zero-value calendar days", () => {
  const source = [
    { date: "2026-03-05", amount: 125_000, orderCount: 1 },
    { date: "2026-03-07", amount: 450_000, orderCount: 2 },
  ] satisfies readonly DailySales[]

  assert.deepEqual(
    fillDailySalesDays({ series: source, endDate: "2026-03-07", days: 4 }),
    [
      { date: "2026-03-04", amount: 0, orderCount: 0 },
      { date: "2026-03-05", amount: 125_000, orderCount: 1 },
      { date: "2026-03-06", amount: 0, orderCount: 0 },
      { date: "2026-03-07", amount: 450_000, orderCount: 2 },
    ]
  )
})

test("dashboardSalesMetrics compares each period with the preceding period", () => {
  const series = fillDailySalesDays({
    series: [
      { date: "2026-03-01", amount: 100_000, orderCount: 1 },
      { date: "2026-03-08", amount: 200_000, orderCount: 2 },
    ],
    endDate: "2026-03-08",
    days: 14,
  })

  assert.deepEqual(dashboardSalesMetrics(series), [
    {
      label: "Hari Ini",
      amount: 200_000,
      orderCount: 2,
      periodDays: 1,
      change: 0,
    },
    {
      label: "7 Hari Terakhir",
      amount: 200_000,
      orderCount: 2,
      periodDays: 7,
      change: 1,
    },
  ])
})
