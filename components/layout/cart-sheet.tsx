"use client"

import Link from "next/link"
import {
  MinusIcon,
  PlusIcon,
  ShoppingCartIcon,
  TrashIcon,
} from "@phosphor-icons/react"

import { useCart } from "@/components/cart/cart-provider"
import { ProductPrice } from "@/components/products/product-price"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cartSubtotal } from "@/lib/cart/config"
import { productHref } from "@/lib/products/config"
import { cn } from "@/lib/utils"
import { formatNumber, formatRupiah } from "@/utils/format/intl"

type CartSheetProps = {
  className?: string
}

function CartSheet({ className }: CartSheetProps) {
  const {
    items,
    itemCount,
    error,
    open,
    pending,
    removeItem,
    setItemQuantity,
    setOpen,
  } = useCart()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={`Keranjang, ${itemCount} barang`}
            className={cn(
              "relative text-navbar-foreground hover:bg-navbar-foreground/10 hover:text-navbar-foreground",
              className
            )}
          />
        }
      >
        <ShoppingCartIcon className="size-6" />
        {itemCount > 0 && (
          <Badge
            aria-hidden
            className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground"
          >
            {itemCount}
          </Badge>
        )}
      </SheetTrigger>

      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Keranjang</SheetTitle>
          <SheetDescription>
            Barang yang kamu pilih akan muncul di sini.
          </SheetDescription>
        </SheetHeader>

        {error && (
          <p role="alert" className="px-6 text-sm text-destructive">
            {error}
          </p>
        )}

        {pending && items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6 text-sm text-muted-foreground">
            Memuat keranjang...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingCartIcon
              className="size-10 text-muted-foreground"
              aria-hidden
            />
            <p className="text-sm text-muted-foreground">
              Keranjang kamu masih kosong.
            </p>
          </div>
        ) : (
          <>
            <ul className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 border-b border-border pb-4"
                >
                  <Link
                    href={productHref(item.product)}
                    aria-label={`Lihat ${item.product.name}`}
                    className="shrink-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                    onClick={() => setOpen(false)}
                  >
                    <ProductThumbnail
                      src={
                        item.product.images[0].thumbnailUrl ??
                        item.product.images[0].url
                      }
                      label={`Gambar ${item.product.name}`}
                      className="size-16"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={productHref(item.product)}
                      className="font-medium underline-offset-4 hover:text-primary hover:underline"
                      onClick={() => setOpen(false)}
                    >
                      {item.product.name}
                    </Link>
                    {item.variants.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.variants
                          .map(({ label, value }) => `${label}: ${value}`)
                          .join(", ")}
                      </p>
                    )}
                    <ProductPrice product={item.product} className="mt-2" />
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center border border-border">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Kurangi jumlah ${item.product.name}`}
                          disabled={pending || item.quantity <= 1}
                          onClick={() =>
                            void setItemQuantity({
                              itemId: item.id,
                              quantity: item.quantity - 1,
                            })
                          }
                        >
                          <MinusIcon />
                        </Button>
                        <span
                          aria-label={`${formatNumber(item.quantity)} barang`}
                          className="min-w-8 text-center text-sm tabular-nums"
                        >
                          {formatNumber(item.quantity)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Tambah jumlah ${item.product.name}`}
                          disabled={
                            pending || item.quantity >= item.product.stock
                          }
                          onClick={() =>
                            void setItemQuantity({
                              itemId: item.id,
                              quantity: item.quantity + 1,
                            })
                          }
                        >
                          <PlusIcon />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Hapus ${item.product.name} dari keranjang`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={pending}
                        onClick={() => void removeItem(item.id)}
                      >
                        <TrashIcon />
                      </Button>
                    </div>
                    <div className="mt-3 flex justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">
                        Total barang
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatRupiah(item.product.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <SheetFooter className="border-t border-border">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-heading text-lg font-bold tabular-nums">
                  {formatRupiah(cartSubtotal(items))}
                </span>
              </div>
              <Button
                render={<Link href="/checkout" />}
                nativeButton={false}
                onClick={() => setOpen(false)}
                className="h-10 font-bold tracking-wide uppercase"
              >
                Checkout
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

export { CartSheet }
