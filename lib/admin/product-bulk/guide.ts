import {
  IMAGE_FORMAT_HINT,
  MAX_DESCRIPTION_LENGTH,
  MIN_DESCRIPTION_LENGTH,
} from "@/lib/admin/product-form"
import type { StoredProductVariant } from "@/lib/products/schema"

import {
  CATEGORY_CHOICES,
  CLEAR_VALUE,
  STATE_CHOICES,
  type BulkColumnMode,
} from "./columns"
import { MAX_IMAGES, MAX_ROWS } from "./limits"
import { serializeVariants, VARIANT_FORMAT_HINT } from "./variant"

const EXAMPLE_VARIANTS = [
  {
    label: "Ukuran",
    options: [
      { value: "M", price: 150000, weight: 500, imageId: null },
      { value: "L", price: 165000, weight: 600, imageId: null },
    ],
  },
] as const satisfies readonly StoredProductVariant[]

export const VARIANT_EXAMPLE =
  serializeVariants(EXAMPLE_VARIANTS) ?? VARIANT_FORMAT_HINT

function choiceList(choices: readonly { value: string; label: string }[]) {
  return choices.map(({ value, label }) => `${value} (${label})`).join(", ")
}

export const CATEGORY_HINT = choiceList(CATEGORY_CHOICES)
export const STATE_HINT = choiceList(STATE_CHOICES)

export type BulkGuideSection = {
  readonly title: string
  readonly lines: readonly string[]
}

const SHARED_SECTIONS = [
  {
    title: "Aturan Umum",
    lines: [
      "Jangan mengubah, menghapus, atau menukar urutan baris header.",
      "Satu baris mewakili satu produk. Baris kosong akan dilewati.",
      "Kolom bertanda WAJIB harus diisi, kolom OPSIONAL boleh dibiarkan kosong.",
      `Maksimal ${MAX_ROWS} baris produk per file.`,
      "Sel rumus (=SUM, dan sebagainya) ditolak. Tempel nilai sebagai teks atau angka.",
    ],
  },
  {
    title: "Angka",
    lines: [
      "Harga, stok, dan berat harus bilangan bulat tanpa Rp, titik, atau koma.",
      "Berat memakai satuan gram, minimal 1 gram.",
      "Stok minimal 0. Harga Coret harus lebih besar dari Harga.",
    ],
  },
  {
    title: "Kategori dan Status",
    lines: [
      `Kategori yang diterima: ${CATEGORY_HINT}.`,
      `Status tayang yang diterima: ${STATE_HINT}.`,
    ],
  },
  {
    title: "Foto Produk",
    lines: [
      `Maksimal ${MAX_IMAGES} URL foto per produk, harus HTTPS dan dapat diakses publik.`,
      `Format foto yang didukung: ${IMAGE_FORMAT_HINT}.`,
      "Isi URL Gambar berurutan mulai dari slot 1, jangan melewati slot.",
      "URL Gambar 1 menjadi foto utama produk.",
      "Foto diunduh lalu disimpan ulang ke penyimpanan toko, jadi URL asal boleh dihapus setelah import.",
    ],
  },
] as const satisfies readonly BulkGuideSection[]

const UPLOAD_SECTIONS = [
  {
    title: "Tujuan Workbook",
    lines: [
      "Workbook ini untuk menambahkan produk baru sekaligus.",
      "Produk baru masuk sebagai Draf, lalu terbitkan dari halaman Produk.",
      "ID, slug, terjual, rating, dan ulasan dibuat otomatis oleh sistem.",
    ],
  },
  ...SHARED_SECTIONS,
  {
    title: "Deskripsi dan Varian",
    lines: [
      `Deskripsi minimal ${MIN_DESCRIPTION_LENGTH} dan maksimal ${MAX_DESCRIPTION_LENGTH} karakter. Pisahkan paragraf dengan satu baris kosong.`,
      `Format varian: ${VARIANT_FORMAT_HINT}`,
      `Contoh varian: ${VARIANT_EXAMPLE}`,
      "Harga tiap pilihan wajib, berat pilihan opsional. Foto khusus varian belum didukung lewat workbook.",
      "Jika varian diisi, Harga produk mengikuti harga pilihan termurah.",
    ],
  },
] as const satisfies readonly BulkGuideSection[]

const UPDATE_SECTIONS = [
  {
    title: "Tujuan Workbook",
    lines: [
      "Workbook ini berisi produk yang sudah ada beserta nilai terkini.",
      "ID Produk tidak boleh diubah karena hanya dipakai untuk menemukan produk.",
      "ID Produk ganda dalam satu file akan ditolak.",
    ],
  },
  {
    title: "Sel Kosong",
    lines: [
      "Sel kosong berarti nilai lama dipertahankan, bukan nol dan bukan teks kosong.",
      `Isi ${CLEAR_VALUE} pada Harga Coret / Diskon untuk menghapus harga coret.`,
      "Baris tanpa perubahan dilaporkan sebagai dilewati.",
      "Produk berstatus Dihapus tidak dapat diperbarui. Pulihkan dulu dari halaman Produk.",
    ],
  },
  ...SHARED_SECTIONS,
  {
    title: "Mengganti Foto",
    lines: [
      "Biarkan semua kolom URL Gambar kosong jika tidak ingin mengganti foto produk.",
      `Isi URL Gambar 1-${MAX_IMAGES} hanya jika ingin mengganti seluruh galeri foto produk.`,
      "Penggantian galeri menghapus semua foto lama setelah foto baru tersimpan.",
      "Foto lama yang dipakai sebagai foto pilihan varian akan dilepas dari varian tersebut.",
    ],
  },
  {
    title: "Varian",
    lines: [
      "Varian tidak dapat diubah lewat workbook karena pemetaan foto varian tidak dapat diwakili satu sel.",
      "Ubah varian dari halaman Ubah Produk.",
    ],
  },
] as const satisfies readonly BulkGuideSection[]

const GUIDE_TITLES = {
  upload: "Panduan Mass Upload Produk",
  update: "Panduan Mass Update Produk",
} as const satisfies Record<BulkColumnMode, string>

export function bulkGuideTitle(mode: BulkColumnMode) {
  return GUIDE_TITLES[mode]
}

export function bulkGuideSections(
  mode: BulkColumnMode
): readonly BulkGuideSection[] {
  switch (mode) {
    case "upload":
      return UPLOAD_SECTIONS
    case "update":
      return UPDATE_SECTIONS
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

const UPLOAD_STEPS = [
  "Download template .xlsx di tahap Download.",
  "Jangan mengubah atau menghapus baris header.",
  "Satu baris mewakili satu produk baru.",
  "Isi semua kolom bertanda Wajib.",
  "URL Gambar 1 wajib diisi.",
  `Maksimal ${MAX_IMAGES} URL foto HTTPS publik per produk.`,
  "Simpan file sebagai .xlsx.",
  "Unggah file, lalu periksa hasil tiap baris.",
] as const satisfies readonly string[]

const UPDATE_STEPS = [
  "Download workbook terbaru berisi produk saat ini.",
  "Jangan mengubah kolom ID Produk.",
  "Ubah hanya nilai yang perlu diperbarui.",
  "Sel opsional yang dibiarkan kosong tetap memakai nilai lama.",
  "Biarkan semua kolom URL Gambar kosong untuk mempertahankan foto.",
  "Mengisi URL Gambar akan mengganti seluruh galeri foto produk.",
  "Unggah file, lalu periksa hasil tiap baris.",
] as const satisfies readonly string[]

export function bulkGuideSteps(mode: BulkColumnMode): readonly string[] {
  switch (mode) {
    case "upload":
      return UPLOAD_STEPS
    case "update":
      return UPDATE_STEPS
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

export const BULK_GUIDE_NOTES = [
  `Kategori: ${CATEGORY_HINT}.`,
  `Status tayang: ${STATE_HINT}.`,
  "Berat dalam gram, angka bulat tanpa Rp atau titik.",
  `Format foto: ${IMAGE_FORMAT_HINT}.`,
] as const satisfies readonly string[]
