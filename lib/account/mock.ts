/**
 * Mock account data
 */

import type { AddressValues } from "@/lib/account/schema"

export type AccountProvider = "credential" | "google"

export type Account = {
  readonly name: string
  readonly email: string
  readonly provider: AccountProvider
  readonly joinedAt: string
}

export const MOCK_ACCOUNT = {
  name: "Bagas Prakoso",
  email: "bagas.prakoso@email.com",
  provider: "credential",
  joinedAt: "2025-03-18",
} as const satisfies Account

export type Address = AddressValues & { readonly id: string }

export const MOCK_ADDRESSES = [
  {
    id: "alamat-rumah",
    label: "Rumah",
    recipient: "Bagas Prakoso",
    phone: "081234567890",
    street: "Jl. Kaliurang Km 5 No. 12, RT 03 RW 07",
    province: "DI Yogyakarta",
    city: "Kabupaten Sleman",
    district: "Depok",
    subdistrict: "Caturtunggal",
    postalCode: "55281",
    isPrimary: true,
  },
  {
    id: "alamat-kantor",
    label: "Kantor",
    recipient: "Bagas Prakoso",
    phone: "081298765432",
    street: "Jl. Magelang Km 7, Ruko Nusa Blok B2",
    province: "DI Yogyakarta",
    city: "Kabupaten Sleman",
    district: "Mlati",
    subdistrict: "Sinduadi",
    postalCode: "55284",
    isPrimary: false,
  },
] as const satisfies readonly Address[]

export const EMPTY_ADDRESS: AddressValues = {
  label: "",
  recipient: "",
  phone: "",
  street: "",
  province: "",
  city: "",
  district: "",
  subdistrict: "",
  postalCode: "",
  isPrimary: false,
}
