import {
  MAX_PRICE,
  MAX_VARIANT_OPTIONS,
  MAX_VARIANT_TEXT_LENGTH,
  MAX_VARIANTS,
  MAX_WEIGHT,
  MIN_PRICE,
} from "@/lib/admin/product-form"
import type { StoredProductVariant } from "@/lib/products/schema"

const VARIANT_SEPARATOR = "|"
const LABEL_SEPARATOR = ":"
const OPTION_SEPARATOR = ","
const PRICE_SEPARATOR = "="
const WEIGHT_SEPARATOR = "/"

const RESERVED = new Set([
  VARIANT_SEPARATOR,
  LABEL_SEPARATOR,
  OPTION_SEPARATOR,
  PRICE_SEPARATOR,
  WEIGHT_SEPARATOR,
])

export const VARIANT_FORMAT_HINT =
  "Label: pilihan=harga/berat, pilihan=harga | Label lain: pilihan=harga"

export type VariantParseResult =
  | {
      readonly kind: "variants"
      readonly variants: readonly StoredProductVariant[]
    }
  | { readonly kind: "invalid"; readonly message: string }

function invalid(message: string): VariantParseResult {
  return { kind: "invalid", message }
}

function isSafeText(value: string) {
  return (
    value.length > 0 &&
    value.length <= MAX_VARIANT_TEXT_LENGTH &&
    ![...value].some((character) => RESERVED.has(character))
  )
}

function parseAmount(raw: string) {
  const normalized = raw.replace(/[.\s]/g, "")
  const parsed = Number(normalized)

  return normalized !== "" && Number.isSafeInteger(parsed) ? parsed : null
}

/** Parses the text fields supported by the workbook. Photos are not supported. */
export function parseVariantCell(value: string): VariantParseResult {
  const trimmed = value.trim()

  if (trimmed === "") {
    return { kind: "variants", variants: [] }
  }

  const groups = trimmed
    .split(VARIANT_SEPARATOR)
    .map((group) => group.trim())
    .filter(Boolean)

  if (groups.length === 0) {
    return invalid(
      `Format varian tidak dikenal. Gunakan ${VARIANT_FORMAT_HINT}`
    )
  }

  if (groups.length > MAX_VARIANTS) {
    return invalid(`Maksimal ${MAX_VARIANTS} varian.`)
  }

  const variants: StoredProductVariant[] = []

  for (const group of groups) {
    const separatorIndex = group.indexOf(LABEL_SEPARATOR)

    if (separatorIndex < 0) {
      return invalid(`Varian "${group}" butuh nama varian dan tanda titik dua.`)
    }

    const label = group.slice(0, separatorIndex).trim()

    if (!isSafeText(label)) {
      return invalid(
        `Nama varian "${label}" tidak valid, maksimal ${MAX_VARIANT_TEXT_LENGTH} karakter.`
      )
    }

    if (variants.some((variant) => variant.label === label)) {
      return invalid(`Nama varian "${label}" ganda.`)
    }

    const entries = group
      .slice(separatorIndex + 1)
      .split(OPTION_SEPARATOR)
      .map((entry) => entry.trim())
      .filter(Boolean)

    if (entries.length === 0) {
      return invalid(`Varian "${label}" butuh minimal 1 pilihan.`)
    }

    if (entries.length > MAX_VARIANT_OPTIONS) {
      return invalid(
        `Maksimal ${MAX_VARIANT_OPTIONS} pilihan untuk "${label}".`
      )
    }

    const options: StoredProductVariant["options"][number][] = []

    for (const entry of entries) {
      const [rawValue, rawAmounts, ...extra] = entry.split(PRICE_SEPARATOR)

      if (rawAmounts === undefined || extra.length > 0) {
        return invalid(`Pilihan "${entry}" butuh harga. Gunakan pilihan=harga.`)
      }

      const optionValue = rawValue.trim()

      if (!isSafeText(optionValue)) {
        return invalid(
          `Pilihan varian "${optionValue}" tidak valid, maksimal ${MAX_VARIANT_TEXT_LENGTH} karakter.`
        )
      }

      if (options.some((option) => option.value === optionValue)) {
        return invalid(`Pilihan varian "${optionValue}" ganda pada "${label}".`)
      }

      const [rawPrice, rawWeight, ...extraWeights] =
        rawAmounts.split(WEIGHT_SEPARATOR)

      if (extraWeights.length > 0) {
        return invalid(`Pilihan "${optionValue}" hanya boleh punya satu berat.`)
      }

      const price = parseAmount(rawPrice)

      if (price === null || price < MIN_PRICE || price > MAX_PRICE) {
        return invalid(
          `Harga pilihan "${optionValue}" harus bilangan bulat antara ${MIN_PRICE} dan ${MAX_PRICE}.`
        )
      }

      const weight =
        rawWeight === undefined || rawWeight.trim() === ""
          ? null
          : parseAmount(rawWeight)

      if (
        rawWeight !== undefined &&
        rawWeight.trim() !== "" &&
        (weight === null || weight < 1 || weight > MAX_WEIGHT)
      ) {
        return invalid(
          `Berat pilihan "${optionValue}" harus bilangan bulat antara 1 dan ${MAX_WEIGHT} gram.`
        )
      }

      options.push({ value: optionValue, price, weight, imageId: null })
    }

    const [firstOption, ...otherOptions] = options

    if (!firstOption) {
      return invalid(`Varian "${label}" butuh minimal 1 pilihan.`)
    }

    variants.push({ label, options: [firstOption, ...otherOptions] })
  }

  return { kind: "variants", variants }
}

/** Returns null when the workbook format cannot preserve an option photo. */
export function serializeVariants(
  variants: readonly StoredProductVariant[]
): string | null {
  if (variants.some(({ options }) => options.some(({ imageId }) => imageId))) {
    return null
  }

  return variants
    .map(({ label, options }) => {
      const entries = options
        .map(
          ({ value, price, weight }) =>
            `${value}${PRICE_SEPARATOR}${price}${
              weight === null ? "" : `${WEIGHT_SEPARATOR}${weight}`
            }`
        )
        .join(`${OPTION_SEPARATOR} `)

      return `${label}${LABEL_SEPARATOR} ${entries}`
    })
    .join(` ${VARIANT_SEPARATOR} `)
}
