"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ImagesIcon, XIcon } from "@phosphor-icons/react"
import { useFieldArray } from "react-hook-form"

import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import {
  IMAGE_ACCEPT,
  IMAGE_FORMAT_HINT,
  MAX_PRODUCT_IMAGES,
  type ProductFormControl,
  type ProductImageDraft,
} from "@/lib/admin/product-form"
import { cn } from "@/lib/utils"

const OVERLAY_BUTTON =
  "bg-navbar/80 text-navbar-foreground hover:bg-navbar hover:text-navbar-foreground disabled:opacity-30"

function toImageDraft(file: File): ProductImageDraft {
  return { name: file.name, previewUrl: URL.createObjectURL(file) }
}

function ProductImageUploader({
  control,
  error,
}: {
  control: ProductFormControl
  error?: string
}) {
  const { fields, append, move, remove } = useFieldArray({
    control,
    name: "images",
  })
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const previews = useRef(new Set<string>())

  useEffect(() => {
    const created = previews.current

    return () => {
      for (const url of created) {
        URL.revokeObjectURL(url)
      }

      created.clear()
    }
  }, [])

  const remaining = MAX_PRODUCT_IMAGES - fields.length
  function addFiles(picked: FileList | null) {
    if (!picked || remaining <= 0) {
      return
    }

    const drafts = Array.from(picked).slice(0, remaining).map(toImageDraft)

    for (const draft of drafts) {
      previews.current.add(draft.previewUrl)
    }

    append(drafts)
  }

  function removeAt(index: number) {
    const { previewUrl } = fields[index]

    URL.revokeObjectURL(previewUrl)
    previews.current.delete(previewUrl)
    remove(index)
  }

  function endDrag() {
    setDragIndex(null)
    setDropIndex(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <ul
        aria-label="Foto produk"
        className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3"
      >
        {fields.map((field, index) => (
          <li
            key={field.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnter={() => setDropIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDragEnd={endDrag}
            onDrop={(event) => {
              event.preventDefault()

              if (dragIndex !== null && dragIndex !== index) {
                move(dragIndex, index)
              }

              endDrag()
            }}
            data-dragging={index === dragIndex || undefined}
            data-drop={
              (index === dropIndex && index !== dragIndex) || undefined
            }
            className="relative aspect-square border border-border bg-muted data-dragging:opacity-40 data-drop:border-ring data-drop:ring-3 data-drop:ring-ring/40 sm:cursor-grab sm:active:cursor-grabbing"
          >
            <Image
              src={field.previewUrl}
              alt={field.name}
              fill
              unoptimized
              sizes="(min-width: 640px) 9rem, 33vw"
              className="object-cover"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Hapus ${field.name}`}
              onClick={() => removeAt(index)}
              className={cn("absolute top-1 right-1", OVERLAY_BUTTON)}
            >
              <XIcon />
            </Button>

          </li>
        ))}

        {remaining > 0 && (
          <li>
            <label className="relative flex aspect-square flex-col items-center justify-center gap-1 border border-dashed border-input p-1 text-center transition-colors hover:bg-muted/50 has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/30">
              <ImagesIcon
                className="size-5 text-muted-foreground"
                aria-hidden
              />
              <span className="text-xs font-medium">Tambah</span>
              <span className="text-[0.625rem] text-muted-foreground tabular-nums">
                {fields.length}/{MAX_PRODUCT_IMAGES}
              </span>

              <input
                type="file"
                multiple
                accept={IMAGE_ACCEPT}
                aria-label="Tambah foto produk"
                onChange={(event) => {
                  addFiles(event.target.files)
                  event.target.value = ""
                }}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
          </li>
        )}

        {Array.from({ length: Math.max(remaining - 1, 0) }, (_, slot) => (
          <li key={slot} aria-hidden>
            <ProductThumbnail
              className="aspect-square border border-dashed border-input"
              iconClassName="size-5"
            />
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        Format {IMAGE_FORMAT_HINT}. Geser foto untuk mengubah urutan.
      </p>

      <FieldError>{error}</FieldError>
    </div>
  )
}

export { ProductImageUploader }
