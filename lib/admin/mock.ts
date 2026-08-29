import {
  trailingMetric,
  type DailySales,
  type SalesMetric,
} from "@/lib/admin/config"
import type {
  PaymentMethod,
  Transaction,
  TransactionLifecycle,
} from "@/lib/admin/finance"
import type { OrderItem } from "@/lib/orders/config"

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

const CATALOG = {
  jaket: { name: "Jaket Kamuflase Bottomland Tahan Angin", price: 685_000 },
  sarung: { name: "Sarung Tangan Taktis Anti Slip", price: 145_000 },
  tas: { name: "Tas Punggung Hunting 45L Rangka Internal", price: 520_000 },
  teropong: { name: "Teropong Monokuler 10x42", price: 1_350_000 },
  joran: { name: "Joran Carbon Fiber 210 cm Medium Action", price: 780_000 },
  reel: { name: "Reel Spinning 4000 Series", price: 1_250_000 },
  kotak: { name: "Kotak Umpan 6 Sekat Tahan Bocor", price: 95_000 },
  piston: { name: "Piston Set Kaliber 5.5 mm Kuningan", price: 320_000 },
  per: { name: "Per Gas Tuning Stainless Steel", price: 185_000 },
  tenda: { name: "Tenda Dome 2 Orang Double Layer", price: 1_180_000 },
  lampu: { name: "Lampu Kepala LED 1200 Lumen", price: 165_000 },
  matras: { name: "Matras Lipat Alumunium Foil", price: 89_000 },
} as const satisfies Record<string, { name: string; price: number }>

type CatalogKey = keyof typeof CATALOG

type ItemEntry = readonly [
  product: CatalogKey,
  variant: string,
  quantity: number,
]

type TransactionEntry = readonly [
  daysBack: number,
  lifecycle: TransactionLifecycle,
  method: PaymentMethod,
  shipping: number,
  discount: number,
  items: readonly [ItemEntry, ...ItemEntry[]],
]

const IN_TRANSIT = {
  payout: "pending",
  fulfillment: "inTransit",
} as const satisfies TransactionLifecycle

const AWAITING_COMPLETION = {
  payout: "pending",
  fulfillment: "awaitingCompletion",
} as const satisfies TransactionLifecycle

const RELEASED = {
  payout: "released",
  fulfillment: "completed",
} as const satisfies TransactionLifecycle

const TRANSACTION_ENTRIES = [
  [0, IN_TRANSIT, "manual", 24_000, 0, [["jaket", "Ukuran L", 1]]],
  [0, IN_TRANSIT, "manual", 32_000, 0, [["reel", "Seri 4000", 1]]],
  [
    1,
    IN_TRANSIT,
    "midtrans",
    28_000,
    25_000,
    [
      ["joran", "Medium", 1],
      ["kotak", "6 sekat", 2],
    ],
  ],
  [1, IN_TRANSIT, "midtrans", 22_000, 0, [["lampu", "Hitam", 2]]],
  [2, IN_TRANSIT, "manual", 26_000, 0, [["tas", "Olive", 1]]],
  [3, AWAITING_COMPLETION, "midtrans", 30_000, 50_000, [["teropong", "Standar", 1]]],
  [3, AWAITING_COMPLETION, "midtrans", 24_000, 0, [["sarung", "Hitam / M", 3]]],
  [
    4,
    AWAITING_COMPLETION,
    "midtrans",
    35_000,
    0,
    [
      ["tenda", "Olive", 1],
      ["matras", "180 cm", 2],
    ],
  ],
  [5, AWAITING_COMPLETION, "midtrans", 22_000, 15_000, [["piston", "5.5 mm", 2]]],
  [6, AWAITING_COMPLETION, "midtrans", 28_000, 0, [["joran", "Medium Heavy", 1]]],
  [
    7,
    AWAITING_COMPLETION,
    "midtrans",
    41_000,
    0,
    [
      ["reel", "Seri 5000", 1],
      ["kotak", "12 sekat", 1],
    ],
  ],
  [8, AWAITING_COMPLETION, "midtrans", 24_000, 0, [["per", "Medium", 2]]],
  [9, AWAITING_COMPLETION, "manual", 26_000, 0, [["jaket", "Ukuran XL", 1]]],
  [
    10,
    AWAITING_COMPLETION,
    "midtrans",
    32_000,
    20_000,
    [
      ["tas", "Kamuflase", 1],
      ["lampu", "Hitam", 1],
    ],
  ],
  [12, RELEASED, "midtrans", 24_000, 0, [["matras", "180 cm", 3]]],
  [13, RELEASED, "midtrans", 28_000, 0, [["sarung", "Olive / L", 2]]],
  [15, RELEASED, "midtrans", 22_000, 10_000, [["kotak", "6 sekat", 2]]],
  [17, RELEASED, "midtrans", 38_000, 0, [["teropong", "Plus tripod", 1]]],
  [
    19,
    RELEASED,
    "midtrans",
    30_000,
    0,
    [
      ["joran", "Light", 1],
      ["per", "Medium", 1],
    ],
  ],
  [21, RELEASED, "manual", 24_000, 0, [["piston", "4.5 mm", 1]]],
  [23, RELEASED, "midtrans", 26_000, 0, [["lampu", "Hitam", 2]]],
  [25, RELEASED, "midtrans", 34_000, 45_000, [["tenda", "Olive", 1]]],
  [27, RELEASED, "midtrans", 24_000, 0, [["jaket", "Ukuran M", 1]]],
  [30, RELEASED, "midtrans", 28_000, 0, [["reel", "Seri 3000", 1]]],
  [
    33,
    RELEASED,
    "midtrans",
    22_000,
    0,
    [
      ["matras", "180 cm", 1],
      ["kotak", "6 sekat", 1],
    ],
  ],
  [
    36,
    RELEASED,
    "midtrans",
    40_000,
    30_000,
    [
      ["tas", "Coyote", 1],
      ["sarung", "XL", 1],
    ],
  ],
] as const satisfies readonly TransactionEntry[]

const FIRST_INVOICE = 184
const SETTLED_TIME = "14:05:00+07:00"

function toItem([product, variant, quantity]: ItemEntry): OrderItem {
  const { name, price } = CATALOG[product]

  return { name, variant, quantity, price }
}

export const MOCK_TRANSACTIONS: readonly Transaction[] =
  TRANSACTION_ENTRIES.map(
    ([daysBack, lifecycle, method, shipping, discount, items], index) => {
      const date = dayBefore(daysBack)
      const invoice = String(FIRST_INVOICE - index).padStart(4, "0")
      const [firstItem, ...otherItems] = items

      return {
        orderId: `INV/${date.replaceAll("-", "")}/HG/${invoice}`,
        settledAt: `${date}T${SETTLED_TIME}`,
        ...lifecycle,
        method,
        shipping,
        discount,
        items: [toItem(firstItem), ...otherItems.map(toItem)],
      }
    }
  )
