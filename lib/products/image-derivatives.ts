import "server-only"

import sharp from "sharp"

export async function webpDerivativeBuffers({
  bytes,
  thumbnailSize,
  detailSize,
}: {
  readonly bytes: Uint8Array
  readonly thumbnailSize: number
  readonly detailSize: number
}) {
  const source = sharp(bytes).rotate()
  const [thumbnail, detail] = await Promise.all([
    source
      .clone()
      .resize({
        width: thumbnailSize,
        height: thumbnailSize,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer(),
    source
      .clone()
      .resize({
        width: detailSize,
        height: detailSize,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer(),
  ])

  return { thumbnail, detail }
}
