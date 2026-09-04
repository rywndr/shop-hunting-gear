"use client"

import { useState } from "react"

import {
  ImageLightboxDialog,
  type LightboxImage,
} from "@/components/products/image-lightbox-dialog"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import type { ReviewMedia } from "@/lib/products/config"

type ReviewMediaGalleryProps = {
  media: readonly ReviewMedia[]
  author: string
}

function ReviewMediaGallery({ media, author }: ReviewMediaGalleryProps) {
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const [firstMedia, ...otherMedia] = media

  if (!firstMedia) return null

  const image = (item: ReviewMedia, imageIndex: number): LightboxImage => ({
    id: item.id,
    src: item.url,
    label: `Gambar ulasan ${imageIndex + 1} dari ${author}`,
  })
  const images = [
    image(firstMedia, 0),
    ...otherMedia.map((item, imageIndex) => image(item, imageIndex + 1)),
  ] satisfies readonly [LightboxImage, ...LightboxImage[]]

  return (
    <>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {media.map((item, imageIndex) => {
          const label = `Gambar ulasan ${imageIndex + 1} dari ${author}`

          return (
            <li key={item.id} className="min-w-0">
              <button
                type="button"
                onClick={() => {
                  setIndex(imageIndex)
                  setOpen(true)
                }}
                aria-label={`Perbesar ${label.toLowerCase()}`}
                className="block w-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <ProductThumbnail
                  src={item.thumbnailUrl}
                  label={label}
                  className="aspect-square w-full border"
                  sizes="(min-width: 640px) 213px, 50vw"
                />
              </button>
            </li>
          )
        })}
      </ul>

      <ImageLightboxDialog
        images={images}
        index={index}
        open={open}
        onIndexChange={setIndex}
        onOpenChange={setOpen}
      />
    </>
  )
}

export { ReviewMediaGallery }
