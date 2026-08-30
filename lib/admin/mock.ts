import type { Listing, ListingState } from "@/lib/admin/catalog"
import {
  trailingMetric,
  type DailySales,
  type SalesMetric,
} from "@/lib/admin/config"
import type {
  FulfillmentStage,
  PaymentMethod,
  Transaction,
} from "@/lib/admin/finance"
import type { SalesOrder } from "@/lib/admin/orders"
import type { OrderItem, OrderStatus } from "@/lib/orders/config"
import type { Product } from "@/lib/products/config"
import { MOCK_PRODUCTS } from "@/lib/products/mock"

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
  fulfillment: FulfillmentStage,
  method: PaymentMethod,
  shipping: number,
  discount: number,
  items: readonly [ItemEntry, ...ItemEntry[]],
]

const TRANSACTION_ENTRIES = [
  [0, "inTransit", "manual", 24_000, 0, [["jaket", "Ukuran L", 1]]],
  [0, "inTransit", "manual", 32_000, 0, [["reel", "Seri 4000", 1]]],
  [
    1,
    "inTransit",
    "midtrans",
    28_000,
    25_000,
    [
      ["joran", "Medium", 1],
      ["kotak", "6 sekat", 2],
    ],
  ],
  [1, "inTransit", "midtrans", 22_000, 0, [["lampu", "Hitam", 2]]],
  [2, "inTransit", "manual", 26_000, 0, [["tas", "Olive", 1]]],
  [
    3,
    "awaitingCompletion",
    "midtrans",
    30_000,
    50_000,
    [["teropong", "Standar", 1]],
  ],
  [
    3,
    "awaitingCompletion",
    "midtrans",
    24_000,
    0,
    [["sarung", "Hitam / M", 3]],
  ],
  [
    4,
    "awaitingCompletion",
    "midtrans",
    35_000,
    0,
    [
      ["tenda", "Olive", 1],
      ["matras", "180 cm", 2],
    ],
  ],
  [
    5,
    "awaitingCompletion",
    "midtrans",
    22_000,
    15_000,
    [["piston", "5.5 mm", 2]],
  ],
  [
    6,
    "awaitingCompletion",
    "midtrans",
    28_000,
    0,
    [["joran", "Medium Heavy", 1]],
  ],
  [
    7,
    "awaitingCompletion",
    "midtrans",
    41_000,
    0,
    [
      ["reel", "Seri 5000", 1],
      ["kotak", "12 sekat", 1],
    ],
  ],
  [8, "awaitingCompletion", "midtrans", 24_000, 0, [["per", "Medium", 2]]],
  [9, "awaitingCompletion", "manual", 26_000, 0, [["jaket", "Ukuran XL", 1]]],
  [
    10,
    "awaitingCompletion",
    "midtrans",
    32_000,
    20_000,
    [
      ["tas", "Kamuflase", 1],
      ["lampu", "Hitam", 1],
    ],
  ],
  [12, "completed", "midtrans", 24_000, 0, [["matras", "180 cm", 3]]],
  [13, "completed", "midtrans", 28_000, 0, [["sarung", "Olive / L", 2]]],
  [15, "completed", "midtrans", 22_000, 10_000, [["kotak", "6 sekat", 2]]],
  [17, "completed", "midtrans", 38_000, 0, [["teropong", "Plus tripod", 1]]],
  [
    19,
    "completed",
    "midtrans",
    30_000,
    0,
    [
      ["joran", "Light", 1],
      ["per", "Medium", 1],
    ],
  ],
  [21, "completed", "manual", 24_000, 0, [["piston", "4.5 mm", 1]]],
  [23, "completed", "midtrans", 26_000, 0, [["lampu", "Hitam", 2]]],
  [25, "completed", "midtrans", 34_000, 45_000, [["tenda", "Olive", 1]]],
  [27, "completed", "midtrans", 24_000, 0, [["jaket", "Ukuran M", 1]]],
  [30, "completed", "midtrans", 28_000, 0, [["reel", "Seri 3000", 1]]],
  [
    33,
    "completed",
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
    "completed",
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
    ([daysBack, fulfillment, method, shipping, discount, items], index) => {
      const date = dayBefore(daysBack)
      const invoice = String(FIRST_INVOICE - index).padStart(4, "0")
      const [firstItem, ...otherItems] = items

      return {
        orderId: `INV/${date.replaceAll("-", "")}/HG/${invoice}`,
        settledAt: `${date}T${SETTLED_TIME}`,
        fulfillment,
        method,
        shipping,
        discount,
        items: [toItem(firstItem), ...otherItems.map(toItem)],
      }
    }
  )

type SalesOrderEntry = {
  readonly daysBack: number
  readonly status: OrderStatus
  readonly buyer: string
  readonly courier: string
  readonly shipping: number
  readonly items: readonly [ItemEntry, ...ItemEntry[]]
}

const SALES_ORDER_ENTRIES = [
  {
    daysBack: 0,
    status: "unpaid",
    buyer: "Rizky Pratama",
    courier: "JNE Reguler",
    shipping: 24_000,
    items: [["jaket", "L / Bottomland", 1]],
  },
  {
    daysBack: 0,
    status: "unpaid",
    buyer: "Dwi Lestari",
    courier: "SiCepat BEST",
    shipping: 32_000,
    items: [
      ["reel", "4000", 1],
      ["kotak", "6 sekat", 1],
    ],
  },
  {
    daysBack: 1,
    status: "unpaid",
    buyer: "Bagas Nugroho",
    courier: "J&T Express",
    shipping: 22_000,
    items: [["lampu", "Hitam", 2]],
  },
  {
    daysBack: 1,
    status: "processing",
    buyer: "Siti Rahayu",
    courier: "JNE YES",
    shipping: 41_000,
    items: [["tenda", "2 orang / Olive", 1]],
  },
  {
    daysBack: 1,
    status: "processing",
    buyer: "Andi Saputra",
    courier: "AnterAja Reguler",
    shipping: 26_000,
    items: [["tas", "Kamuflase", 1]],
  },
  {
    daysBack: 2,
    status: "unpaid",
    buyer: "Yoga Firmansyah",
    courier: "JNE Reguler",
    shipping: 24_000,
    items: [["per", "Medium", 2]],
  },
  {
    daysBack: 2,
    status: "processing",
    buyer: "Nurul Hidayah",
    courier: "SiCepat REG",
    shipping: 28_000,
    items: [
      ["joran", "210 cm / Medium", 1],
      ["kotak", "12 sekat", 1],
    ],
  },
  {
    daysBack: 2,
    status: "processing",
    buyer: "Fajar Ramadhan",
    courier: "J&T Express",
    shipping: 30_000,
    items: [["teropong", "Standar", 1]],
  },
  {
    daysBack: 3,
    status: "processing",
    buyer: "Intan Maharani",
    courier: "JNE Reguler",
    shipping: 24_000,
    items: [["sarung", "M / Hitam", 3]],
  },
  {
    daysBack: 3,
    status: "shipped",
    buyer: "Hendra Wijaya",
    courier: "JNE YES",
    shipping: 35_000,
    items: [
      ["piston", "5.5 mm", 2],
      ["per", "Medium", 1],
    ],
  },
  {
    daysBack: 4,
    status: "shipped",
    buyer: "Putri Anggraini",
    courier: "AnterAja Reguler",
    shipping: 22_000,
    items: [["matras", "190 x 60 cm", 2]],
  },
  {
    daysBack: 5,
    status: "shipped",
    buyer: "Rangga Saputra",
    courier: "SiCepat BEST",
    shipping: 26_000,
    items: [["jaket", "XL / Timber", 1]],
  },
  {
    daysBack: 6,
    status: "cancelled",
    buyer: "Wahyu Kurniawan",
    courier: "J&T Express",
    shipping: 24_000,
    items: [["kotak", "6 sekat", 1]],
  },
  {
    daysBack: 8,
    status: "completed",
    buyer: "Melati Sari",
    courier: "JNE Reguler",
    shipping: 28_000,
    items: [
      ["lampu", "Hitam", 1],
      ["matras", "190 x 60 cm", 1],
    ],
  },
  {
    daysBack: 11,
    status: "completed",
    buyer: "Bayu Setiawan",
    courier: "SiCepat BEST",
    shipping: 34_000,
    items: [["tenda", "2 orang / Olive", 1]],
  },
  {
    daysBack: 14,
    status: "cancelled",
    buyer: "Dimas Aditya",
    courier: "JNE Reguler",
    shipping: 22_000,
    items: [["piston", "4.5 mm", 1]],
  },
  {
    daysBack: 18,
    status: "completed",
    buyer: "Ayu Puspita",
    courier: "J&T Express",
    shipping: 30_000,
    items: [["joran", "180 cm / Light", 1]],
  },
  {
    daysBack: 23,
    status: "completed",
    buyer: "Galih Prakoso",
    courier: "JNE YES",
    shipping: 38_000,
    items: [
      ["teropong", "Plus tripod mini", 1],
      ["tas", "Coyote", 1],
    ],
  },
] as const satisfies readonly SalesOrderEntry[]

const FIRST_ORDER_INVOICE = 212
const PLACED_TIME = "10:12:00+07:00"
const FIRST_TRACKING = 8_204_915_037

function trackingNumber(
  courier: string,
  status: OrderStatus,
  index: number
): string | null {
  if (status !== "shipped" && status !== "completed") {
    return null
  }

  const prefix = courier
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 3)

  return `${prefix}${FIRST_TRACKING + index * 613}`
}

export const MOCK_SALES_ORDERS: readonly SalesOrder[] = SALES_ORDER_ENTRIES.map(
  ({ daysBack, status, buyer, courier, shipping, items }, index) => {
    const date = dayBefore(daysBack)
    const invoice = String(FIRST_ORDER_INVOICE - index).padStart(4, "0")

    return {
      buyer,
      order: {
        id: `INV/${date.replaceAll("-", "")}/HG/${invoice}`,
        status,
        placedAt: `${date}T${PLACED_TIME}`,
        courier,
        shipping,
        tracking: trackingNumber(courier, status, index),
        items: items.map(toItem),
      },
    }
  }
)

type ProductSlug = (typeof MOCK_PRODUCTS)[number]["slug"]
const FIRST_PRODUCT_ID = BigInt("1737264385472693352")

const LISTING_STATE_BY_SLUG = {
  "jaket-kamuflase-bottomland": "active",
  "sarung-tangan-taktis-anti-slip": "active",
  "tas-punggung-hunting-45l": "active",
  "teropong-monokuler-10x42": "inactive",
  "joran-carbon-fiber-210": "active",
  "reel-spinning-4000-series": "active",
  "kotak-umpan-6-sekat": "draft",
  "piston-set-kaliber-55": "active",
  "per-gas-tuning-stainless": "inactive",
  "tenda-dome-2-orang": "active",
  "lampu-kepala-led-1200-lumen": "draft",
  "matras-lipat-alumunium-foil": "deleted",
} as const satisfies Record<ProductSlug, ListingState>

export const MOCK_LISTINGS: readonly Listing<Product>[] = MOCK_PRODUCTS.map(
  (product, index) => ({
    id: (FIRST_PRODUCT_ID + BigInt(index)).toString(),
    uploadedAt: `${dayBefore(90 - index * 3)}T09:00:00+07:00`,
    updatedAt: `${dayBefore(index * 2)}T15:30:00+07:00`,
    product,
    state: LISTING_STATE_BY_SLUG[product.slug],
  })
)
