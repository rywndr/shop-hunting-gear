"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ImageIcon } from "@phosphor-icons/react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type ProductThumbnailProps = {
  label?: string
  src?: string
  className?: string
  iconClassName?: string
  sizes?: string
}

function ProductThumbnail({
  label,
  src,
  className,
  iconClassName,
  sizes,
}: ProductThumbnailProps) {
  const imageSrc = src?.trim() || undefined
  const imageRef = useRef<HTMLImageElement>(null)
  const [loadedSrc, setLoadedSrc] = useState<string>()
  const [failedSrc, setFailedSrc] = useState<string>()

  useEffect(() => {
    if (imageSrc === undefined) {
      return
    }

    const image = imageRef.current

    if (!image?.complete) {
      return
    }

    if (image.naturalWidth > 0) {
      setLoadedSrc(imageSrc)
    } else {
      setFailedSrc(imageSrc)
    }
  }, [imageSrc])

  const status =
    imageSrc === undefined
      ? "empty"
      : failedSrc === imageSrc
        ? "error"
        : loadedSrc === imageSrc
          ? "loaded"
          : "loading"
  const isFallback = imageSrc === undefined || status === "error"

  return (
    <div
      role={isFallback && label ? "img" : undefined}
      aria-label={isFallback ? label : undefined}
      aria-hidden={isFallback && !label ? true : undefined}
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-muted text-muted-foreground",
        className
      )}
    >
      {!isFallback && imageSrc && (
        <Image
          key={imageSrc}
          src={imageSrc}
          alt={label ?? ""}
          fill
          ref={imageRef}
          unoptimized
          sizes={
            sizes ?? "(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw"
          }
          onLoad={() => {
            setLoadedSrc(imageSrc)
            setFailedSrc(undefined)
          }}
          onError={() => {
            setFailedSrc(imageSrc)
          }}
          className={cn(
            "object-cover transition-opacity duration-300",
            status === "loaded" ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {status === "loading" && (
        <Skeleton aria-hidden className="absolute inset-0 rounded-none" />
      )}

      {isFallback && <ImageIcon className={cn("size-6", iconClassName)} />}
    </div>
  )
}

export { ProductThumbnail }
