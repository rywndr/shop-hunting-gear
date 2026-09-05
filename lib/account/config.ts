/**
 * Single source of truth for account settings
 */

import type { AddressValues } from "@/lib/account/schema"

export type AccountTab = {
  readonly value: string
  readonly label: string
}

export const ACCOUNT_TABS = [
  { value: "profile", label: "Info Dasar" },
  { value: "addresses", label: "Alamat" },
  { value: "security", label: "Keamanan" },
] as const satisfies readonly AccountTab[]

export type RegionField = {
  readonly name: keyof Pick<
    AddressValues,
    "province" | "city" | "district" | "subdistrict"
  >
  readonly label: string
  readonly placeholder: string
  readonly options: readonly string[]
}

// Options are just placeholders for now
export const REGION_FIELDS = [
  {
    name: "province",
    label: "Provinsi",
    placeholder: "Pilih provinsi",
    options: [
      "DKI Jakarta",
      "Jawa Barat",
      "Jawa Tengah",
      "DI Yogyakarta",
      "Jawa Timur",
      "Banten",
    ],
  },
  {
    name: "city",
    label: "Kota / Kabupaten",
    placeholder: "Pilih kota atau kabupaten",
    options: [
      "Kabupaten Sleman",
      "Kota Yogyakarta",
      "Kota Bandung",
      "Kota Surabaya",
      "Kota Semarang",
    ],
  },
  {
    name: "district",
    label: "Kecamatan",
    placeholder: "Pilih kecamatan",
    options: ["Depok", "Ngaglik", "Mlati", "Godean", "Kalasan"],
  },
  {
    name: "subdistrict",
    label: "Kelurahan / Desa",
    placeholder: "Pilih kelurahan atau desa",
    options: [
      "Caturtunggal",
      "Condongcatur",
      "Maguwoharjo",
      "Sinduadi",
      "Sariharjo",
    ],
  },
] as const satisfies readonly RegionField[]
