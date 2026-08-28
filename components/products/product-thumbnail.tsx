import { ImageIcon } from "@phosphor-icons/react/ssr"

import { cn } from "@/lib/utils"

type ProductThumbnailProps = {
  label?: string
  className?: string
  iconClassName?: string
}

function ProductThumbnail({
  label,
  className,
  iconClassName,
}: ProductThumbnailProps) {
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "flex items-center justify-center bg-muted text-muted-foreground",
        className
      )}
    >
      <ImageIcon className={cn("size-6", iconClassName)} />
    </div>
  )
}

export { ProductThumbnail }
