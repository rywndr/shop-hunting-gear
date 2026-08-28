/**
 * Mock orders data
 */

import type { Order } from "@/lib/orders/config"

export const MOCK_ORDERS = [
  {
    id: "INV/20260826/HG/0184",
    status: "unpaid",
    placedAt: "2026-08-26T09:14:00+07:00",
    courier: "JNE Reguler",
    shipping: 24000,
    tracking: null,
    items: [
      {
        name: "Jaket Kamuflase Bottomland",
        variant: "Ukuran L",
        quantity: 1,
        price: 685000,
      },
      {
        name: "Sarung Tangan Taktis",
        variant: "Hitam / M",
        quantity: 2,
        price: 145000,
      },
    ],
  },
  {
    id: "INV/20260821/HG/0177",
    status: "processing",
    placedAt: "2026-08-21T16:02:00+07:00",
    courier: "SiCepat BEST",
    shipping: 32000,
    tracking: null,
    items: [
      {
        name: "Reel Spinning 4000 Series",
        variant: "Gear ratio 5.2:1",
        quantity: 1,
        price: 1250000,
      },
    ],
  },
  {
    id: "INV/20260814/HG/0162",
    status: "shipped",
    placedAt: "2026-08-14T11:38:00+07:00",
    courier: "J&T Express",
    shipping: 28000,
    tracking: "JT4820193857",
    items: [
      {
        name: "Joran Carbon Fiber 210 cm",
        variant: "Medium action",
        quantity: 1,
        price: 780000,
      },
      {
        name: "Kotak Umpan 6 Sekat",
        variant: "Bening",
        quantity: 1,
        price: 95000,
      },
    ],
  },
  {
    id: "INV/20260802/HG/0139",
    status: "completed",
    placedAt: "2026-08-02T08:20:00+07:00",
    courier: "JNE YES",
    shipping: 41000,
    tracking: "JNE0099213847",
    items: [
      {
        name: "Tenda Dome 2 Orang",
        variant: "Olive",
        quantity: 1,
        price: 1180000,
      },
    ],
  },
  {
    id: "INV/20260729/HG/0128",
    status: "cancelled",
    placedAt: "2026-07-29T19:45:00+07:00",
    courier: "AnterAja Reguler",
    shipping: 22000,
    tracking: null,
    items: [
      {
        name: "Sparepart Piston Set",
        variant: "Kaliber 5.5 mm",
        quantity: 1,
        price: 320000,
      },
    ],
  },
] as const satisfies readonly Order[]
