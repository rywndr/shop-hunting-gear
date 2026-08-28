"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { MinusIcon, PlusIcon } from "@phosphor-icons/react"

import { FLAT_CARD } from "@/components/account/account-card"
import { useCart } from "@/components/cart/cart-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { isInStock, type Product } from "@/lib/products/config"
import { AUTH_ROUTES, IS_LOGGED_IN } from "@/lib/site/config"
import { formatNumber, formatRupiah } from "@/utils/format/intl"
import { cn } from "@/lib/utils"

const CHIP =
  "inline-flex h-9 cursor-pointer items-center border border-border bg-background px-3 text-sm whitespace-nowrap select-none transition-colors outline-none hover:border-primary/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground"

function VariantPicker({
  label,
  options,
  value,
  onValueChange,
}: {
  label: string
  options: readonly string[]
  value: string
  onValueChange: (value: string) => void
}) {
  const labelId = useId()

  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="text-sm font-medium">
        {label}
      </p>

      <RadioGroup
        aria-labelledby={labelId}
        value={value}
        onValueChange={(next) => onValueChange(String(next))}
        className="flex flex-wrap gap-2"
      >
        {options.map((option) => (
          <Radio.Root key={option} value={option} className={CHIP}>
            {option}
          </Radio.Root>
        ))}
      </RadioGroup>
    </div>
  )
}

function QuantityStepper({
  value,
  max,
  onValueChange,
}: {
  value: number
  max: number
  onValueChange: (value: number) => void
}) {
  const inputId = useId()
  const clamp = (next: number) => Math.min(Math.max(next, 1), max)

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        Jumlah
      </label>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Kurangi jumlah"
          disabled={value <= 1}
          onClick={() => onValueChange(clamp(value - 1))}
        >
          <MinusIcon />
        </Button>

        <Input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          value={value}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10)

            if (!Number.isNaN(next)) {
              onValueChange(clamp(next))
            }
          }}
          className="h-9 w-16 border-border text-center tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Tambah jumlah"
          disabled={value >= max}
          onClick={() => onValueChange(clamp(value + 1))}
        >
          <PlusIcon />
        </Button>

        <p className="text-sm text-muted-foreground">
          Stok <span className="tabular-nums">{formatNumber(max)}</span>
        </p>
      </div>
    </div>
  )
}

function ProductPurchase({
  product,
  className,
}: {
  product: Product
  className?: string
}) {
  const router = useRouter()
  const { addItem } = useCart()
  const [selection, setSelection] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      product.variants.map((variant) => [variant.label, variant.options[0]])
    )
  )
  const [quantity, setQuantity] = useState(1)

  const available = isInStock(product)

  function requireAccount() {
    if (IS_LOGGED_IN) {
      return true
    }

    router.push(AUTH_ROUTES.signIn)
    return false
  }

  function handleAddToCart() {
    if (!requireAccount()) {
      return
    }

    addItem({
      product,
      quantity,
      variants: product.variants.map((variant) => ({
        label: variant.label,
        value: selection[variant.label] ?? variant.options[0],
      })),
    })
  }

  function handleBuyNow() {
    requireAccount()
  }

  return (
    <Card size="sm" className={cn(FLAT_CARD, className)}>
      <CardContent className="flex flex-col gap-4">
        {product.variants.map((variant) => (
          <VariantPicker
            key={variant.label}
            label={variant.label}
            options={variant.options}
            value={selection[variant.label] ?? variant.options[0]}
            onValueChange={(value) =>
              setSelection((current) => ({
                ...current,
                [variant.label]: value,
              }))
            }
          />
        ))}

        {available ? (
          <QuantityStepper
            value={quantity}
            max={product.stock}
            onValueChange={setQuantity}
          />
        ) : (
          <p className="text-sm text-destructive">
            Stok habis. Hubungi kami untuk ketersediaan berikutnya.
          </p>
        )}

        <div className="flex items-baseline justify-between border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">Subtotal</p>
          <p className="font-heading text-lg font-bold tabular-nums">
            {formatRupiah(product.price * quantity)}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={!available}
            onClick={handleAddToCart}
            className="h-11 flex-1 font-bold tracking-wide uppercase"
          >
            Masukkan Keranjang
          </Button>
          <Button
            type="button"
            disabled={!available}
            onClick={handleBuyNow}
            className="h-11 flex-1 font-bold tracking-wide uppercase"
          >
            Beli Langsung
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export { ProductPurchase }
