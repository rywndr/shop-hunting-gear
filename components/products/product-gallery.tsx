"use client"

import { useState } from "react"
import { MagnifyingGlassPlusIcon } from "@phosphor-icons/react"

import {
  ImageLightboxDialog,
  type LightboxImage,
} from "@/components/products/image-lightbox-dialog"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import type { ProductImage } from "@/lib/products/config"
import { cn } from "@/lib/utils"

type ProductGalleryProps = {
  images: readonly [ProductImage, ...ProductImage[]]
  name: string
  className?: string
}

type ProductImageSize = "thumbnail" | "detail"

function imageUrl(image: ProductImage, size: ProductImageSize) {
  if (size === "thumbnail" && "thumbnailUrl" in image) {
    const url = image.thumbnailUrl

    if (typeof url === "string" && url.trim()) {
      return url
    }
  }

  if (size === "detail" && "detailUrl" in image) {
    const url = image.detailUrl

    if (typeof url === "string" && url.trim()) {
      return url
    }
  }

  if (typeof image.url === "string" && image.url.trim()) {
    return image.url
  }

  if (size === "thumbnail" && "detailUrl" in image) {
    const url = image.detailUrl

    if (typeof url === "string" && url.trim()) {
      return url
    }
  }

  if (size === "detail" && "thumbnailUrl" in image) {
    const url = image.thumbnailUrl

    if (typeof url === "string" && url.trim()) {
      return url
    }
  }

  return undefined
}

function ProductGallery({ images, name, className }: ProductGalleryProps) {
  const [index, setIndex] = useState(0)
  const [enlarged, setEnlarged] = useState(false)

  const total = images.length
  const position = Math.min(index, total - 1)
  const active = images[position]
  const [firstImage, ...otherImages] = images
  const lightboxImage = (image: ProductImage): LightboxImage => ({
    id: image.id,
    src: imageUrl(image, "detail"),
    label: image.alt,
  })
  const lightboxImages = [
    lightboxImage(firstImage),
    ...otherImages.map(lightboxImage),
  ] satisfies readonly [LightboxImage, ...LightboxImage[]]

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <button
        type="button"
        onClick={() => setEnlarged(true)}
        aria-label={`Perbesar foto ${position + 1} dari ${total}: ${active.alt}`}
        className="group relative block w-full border border-border outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <ProductThumbnail
          src={imageUrl(active, "detail")}
          label={active.alt}
          className="aspect-square w-full"
          iconClassName="size-12"
          sizes="(min-width: 1024px) 440px, 100vw"
          preload={position === 0}
        />
        <span
          aria-hidden
          className="absolute right-3 bottom-3 flex size-9 items-center justify-center bg-navbar/80 text-navbar-foreground transition-colors group-hover:bg-navbar"
        >
          <MagnifyingGlassPlusIcon className="size-5" />
        </span>
      </button>

      {total > 1 && (
        <ul
          aria-label={`Foto ${name}`}
          className="flex [scrollbar-width:none] gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, imageIndex) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setIndex(imageIndex)}
                aria-current={imageIndex === position}
                aria-label={`Lihat foto ${imageIndex + 1}: ${image.alt}`}
                className="block border border-border outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-[current=true]:border-primary"
              >
                <ProductThumbnail
                  src={imageUrl(image, "thumbnail")}
                  label={image.alt}
                  className="size-16 sm:size-18"
                  iconClassName="size-5"
                  sizes="72px"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ImageLightboxDialog
        images={lightboxImages}
        index={index}
        open={enlarged}
        onIndexChange={setIndex}
        onOpenChange={setEnlarged}
      />
    </div>
  )
}

export { ProductGallery }
