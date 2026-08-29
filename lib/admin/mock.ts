import {
  trailingMetric,
  type DailySales,
  type SalesMetric,
} from "@/lib/admin/config"

type DailyEntry = readonly [amount: number, orderCount: number]

const DAILY_ENTRIES = [
  [1_640_000, 3],
  [2_180_000, 5],
  [980_000, 2],
  [3_420_000, 7],
  [4_150_000, 9],
  [2_760_000, 6],
  [1_290_000, 3],
  [0, 0],
  [2_040_000, 4],
  [3_310_000, 6],
  [1_870_000, 4],
  [2_620_000, 5],
  [4_480_000, 10],
  [3_950_000, 8],
  [1_450_000, 3],
  [2_310_000, 5],
  [1_120_000, 2],
  [2_890_000, 6],
  [3_640_000, 7],
  [4_720_000, 11],
  [3_180_000, 7],
  [1_760_000, 4],
  [2_450_000, 5],
  [2_070_000, 4],
  [890_000, 2],
  [3_530_000, 8],
  [4_260_000, 9],
  [2_940_000, 6],
  [1_680_000, 4],
  [2_220_000, 5],
  [1_390_000, 3],
  [2_810_000, 6],
  [3_770_000, 8],
  [5_140_000, 12],
  [3_460_000, 7],
  [1_920_000, 4],
  [2_580_000, 5],
  [0, 0],
  [1_240_000, 3],
  [3_090_000, 6],
  [4_610_000, 10],
  [2_730_000, 6],
  [1_560_000, 3],
  [2_360_000, 5],
  [3_240_000, 7],
  [4_890_000, 11],
  [2_150_000, 4],
  [1_830_000, 4],
  [2_670_000, 5],
  [3_580_000, 8],
  [4_340_000, 9],
  [2_490_000, 5],
  [1_710_000, 4],
  [2_980_000, 6],
  [3_860_000, 8],
  [5_270_000, 12],
  [4_020_000, 9],
  [2_640_000, 6],
  [3_410_000, 7],
  [4_580_000, 10],
] as const satisfies readonly DailyEntry[]

const ANCHOR_DATE = "2026-08-29"
const DAY_MS = 24 * 60 * 60 * 1000
const ANCHOR_MS = Date.parse(ANCHOR_DATE)

function dayBefore(daysBack: number) {
  return new Date(ANCHOR_MS - daysBack * DAY_MS)
    .toISOString()
    .slice(0, ANCHOR_DATE.length)
}

export const MOCK_DAILY_SALES: readonly DailySales[] = DAILY_ENTRIES.map(
  ([amount, orderCount], index) => ({
    date: dayBefore(DAILY_ENTRIES.length - 1 - index),
    amount,
    orderCount,
  })
)

export const MOCK_SALES_METRICS: readonly SalesMetric[] = [
  { label: "Hari Ini", days: 1 },
  { label: "7 Hari Terakhir", days: 7 },
].map(({ label, days }) =>
  trailingMetric({ series: MOCK_DAILY_SALES, label, days })
)
