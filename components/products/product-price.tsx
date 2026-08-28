import { Badge } from "@/components/ui/badge"
import { productDiscount, type Product } from "@/lib/products/config"
import { formatRupiah } from "@/utils/format/intl"
import { cn } from "@/lib/utils"

const PRICE_SIZES = {
  sm: "text-base",
  lg: "text-2xl sm:text-3xl",
} as const

type ProductPriceProps = {
  product: Product
  size?: keyof typeof PRICE_SIZES
  className?: string
}

function ProductPrice({ product, size = "sm", className }: ProductPriceProps) {
  const discount = productDiscount(product)

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p
        className={cn(
          "font-heading font-bold tracking-tight tabular-nums",
          PRICE_SIZES[size]
        )}
      >
        {formatRupiah(product.price)}
      </p>

      {discount && (
        <p className="flex items-center gap-1.5">
          <Badge variant="destructive" className="font-bold tabular-nums">
            {discount.percent}%
          </Badge>
          <s className="text-xs text-muted-foreground tabular-nums">
            {formatRupiah(discount.compareAtPrice)}
          </s>
        </p>
      )}
    </div>
  )
}

export { ProductPrice }
