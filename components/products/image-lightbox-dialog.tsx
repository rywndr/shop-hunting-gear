"use client"

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"

import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"

type LightboxImage = {
  readonly id: string
  readonly src?: string
  readonly label: string
}

type ImageLightboxDialogProps = {
  images: readonly [LightboxImage, ...LightboxImage[]]
  index: number
  open: boolean
  onIndexChange: (index: number) => void
  onOpenChange: (open: boolean) => void
}

const ARROW_STEPS = {
  ArrowLeft: -1,
  ArrowRight: 1,
} as const

function isArrowKey(key: string): key is keyof typeof ARROW_STEPS {
  return key in ARROW_STEPS
}

function ImageLightboxDialog({
  images,
  index,
  open,
  onIndexChange,
  onOpenChange,
}: ImageLightboxDialogProps) {
  const total = images.length
  const position = Math.min(index, total - 1)
  const active = images[position]
  const step = (offset: number) =>
    onIndexChange((position + offset + total) % total)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-label={active.label}
        onKeyDown={(event) => {
          if (total > 1 && isArrowKey(event.key)) {
            event.preventDefault()
            step(ARROW_STEPS[event.key])
          }
        }}
        className="w-full gap-0 p-0 sm:max-w-2xl"
      >
        <ProductThumbnail
          src={active.src}
          label={active.label}
          className="aspect-square w-full"
          iconClassName="size-16"
          sizes="(min-width: 640px) 672px, 100vw"
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
  )
}

export { ImageLightboxDialog }
export type { LightboxImage }
