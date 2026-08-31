import Image from "next/image"
import { ImageIcon } from "@phosphor-icons/react/ssr"

import { cn } from "@/lib/utils"

type ProductThumbnailProps = {
  label?: string
  src?: string
  className?: string
  iconClassName?: string
}

function ProductThumbnail({
  label,
  src,
  className,
  iconClassName,
}: ProductThumbnailProps) {
  return (
    <div
      role={!src && label ? "img" : undefined}
      aria-label={!src ? label : undefined}
      aria-hidden={!src && !label ? true : undefined}
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-muted text-muted-foreground",
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={label ?? ""}
          fill
          unoptimized={src.startsWith("/images/products/")}
          sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover"
        />
      ) : (
        <ImageIcon className={cn("size-6", iconClassName)} />
      )}
    </div>
  )
}

export { ProductThumbnail }
