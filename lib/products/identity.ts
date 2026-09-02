import { randomInt } from "node:crypto"

export function newProductId() {
  const randomSuffix = randomInt(1_000_000).toString().padStart(6, "0")
  return `${Date.now()}${randomSuffix}`
}

export function productSlug({ name, id }: { name: string; id: string }) {
  const stem = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  return `${stem || "produk"}-${id.slice(-8)}`
}

export function descriptionParagraphs(
  description: string
): readonly [string, ...string[]] {
  const paragraphs = description
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  const [first = description.trim(), ...others] = paragraphs

  return [first, ...others]
}

export function productImageAlt({
  name,
  index,
}: {
  name: string
  index: number
}) {
  return `${name}, foto ${index + 1}`
}
