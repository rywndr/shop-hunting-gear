"use client"

import { useState } from "react"
import {
  CaretLeftIcon,
  CaretRightIcon,
  MagnifyingGlassPlusIcon,
} from "@phosphor-icons/react"

import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import type { ProductImage } from "@/lib/products/config"
import { cn } from "@/lib/utils"

type ProductGalleryProps = {
  images: readonly [ProductImage, ...ProductImage[]]
  name: string
  className?: string
}

const ARROW_STEPS = {
  ArrowLeft: -1,
  ArrowRight: 1,
} as const

function isArrowKey(key: string): key is keyof typeof ARROW_STEPS {
  return key in ARROW_STEPS
}

function ProductGallery({ images, name, className }: ProductGalleryProps) {
  const [index, setIndex] = useState(0)
  const [enlarged, setEnlarged] = useState(false)

  const total = images.length
  const position = Math.min(index, total - 1)
  const active = images[position]
  const step = (offset: number) =>
    setIndex((current) => (current + offset + total) % total)

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <button
        type="button"
        onClick={() => setEnlarged(true)}
        aria-label={`Perbesar foto ${position + 1} dari ${total}: ${active.alt}`}
        className="group relative block w-full border border-border outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <ProductThumbnail
          className="aspect-square w-full"
          iconClassName="size-12"
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
                  className="size-16 sm:size-18"
                  iconClassName="size-5"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={enlarged} onOpenChange={(open) => setEnlarged(open)}>
        <DialogContent
          aria-label={active.alt}
          onKeyDown={(event) => {
            if (total > 1 && isArrowKey(event.key)) {
              event.preventDefault()
              step(ARROW_STEPS[event.key])
            }
          }}
          className="w-full gap-0 p-0 sm:max-w-2xl"
        >
          <ProductThumbnail
            label={active.alt}
            className="aspect-square w-full"
            iconClassName="size-16"
          />

          {total > 1 && (
            <>
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="Foto sebelumnya"
                onClick={() => step(-1)}
                className="absolute inset-y-0 left-3 my-auto"
              >
                <CaretLeftIcon />
              </Button>
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="Foto berikutnya"
                onClick={() => step(1)}
                className="absolute inset-y-0 right-3 my-auto"
              >
                <CaretRightIcon />
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { ProductGallery }
