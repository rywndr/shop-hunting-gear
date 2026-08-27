"use client"

import { ShoppingCartIcon } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type CartSheetProps = {
  className?: string
  itemCount?: number
}

// Hardcode count [placeholder]
function CartSheet({ className, itemCount = 0 }: CartSheetProps) {
  return (
    <Sheet>
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
        <Badge
          aria-hidden
          className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground"
        >
          {itemCount}
        </Badge>
      </SheetTrigger>

      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Keranjang</SheetTitle>
          <SheetDescription>
            Barang yang kamu pilih akan muncul di sini.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <ShoppingCartIcon
            className="size-10 text-muted-foreground"
            aria-hidden
          />
          <p className="text-sm text-muted-foreground">
            Keranjang kamu masih kosong.
          </p>
        </div>

      </SheetContent>
    </Sheet>
  )
}

export { CartSheet }
