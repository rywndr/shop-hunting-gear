"use client"

import { useState } from "react"
import Link from "next/link"
import {
  CaretDownIcon,
  ClockCounterClockwiseIcon,
  CrosshairIcon,
  FishIcon,
  GameControllerIcon,
  HouseIcon,
  ListIcon,
  SquaresFourIcon,
  WrenchIcon,
  type Icon,
} from "@phosphor-icons/react"

import { BrandLogo } from "@/components/layout/brand-logo"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  ACCOUNT_LINKS,
  CATEGORIES,
  USER_LINKS,
  type NavLink,
} from "@/lib/site-config"
import { cn } from "@/lib/utils"

const CATEGORY_ICONS = {
  "/c/hunting": CrosshairIcon,
  "/c/fishing": FishIcon,
  "/c/spareparts": WrenchIcon,
  "/c/hobbies": GameControllerIcon,
} satisfies Record<(typeof CATEGORIES)[number]["href"], Icon>

/** Shared rhythm for every tappable row in the drawer. */
const ROW =
  "flex w-full items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-navbar-foreground/10"

function MobileNavLink({
  label,
  href,
  icon: LinkIcon,
  onNavigate,
  className,
}: NavLink & { icon?: Icon; onNavigate: () => void; className?: string }) {
  return (
    <li>
      <Link href={href} onNavigate={onNavigate} className={cn(ROW, className)}>
        {LinkIcon && <LinkIcon className="size-4 shrink-0" aria-hidden />}
        {label}
      </Link>
    </li>
  )
}

function MobileNav({
  className,
  isLoggedIn,
}: {
  className?: string
  isLoggedIn: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Buka menu"
            className={cn(
              "-ml-2 text-navbar-foreground hover:bg-navbar-foreground/10 hover:text-navbar-foreground",
              className
            )}
          />
        }
      >
        <ListIcon className="size-6" />
      </SheetTrigger>

      <SheetContent
        side="left"
        className="border-navbar-border bg-navbar text-navbar-foreground [&_[data-slot=sheet-close]]:bg-navbar-accent [&_[data-slot=sheet-close]]:text-navbar-accent-foreground [&_[data-slot=sheet-close]]:hover:bg-navbar-foreground/10"
      >
        <SheetHeader className="p-4">
          <SheetTitle className="text-navbar-foreground">
            <BrandLogo />
          </SheetTitle>
        </SheetHeader>

        <nav aria-label="Menu toko" className="flex-1 overflow-y-auto py-2">
          <ul>
            <MobileNavLink
              label="Beranda"
              href="/"
              icon={HouseIcon}
              onNavigate={() => setOpen(false)}
            />
          </ul>

          <Collapsible>
            <CollapsibleTrigger className={cn(ROW, "group")}>
              <SquaresFourIcon className="size-4 shrink-0" aria-hidden />
              <span>Kategori</span>
              <CaretDownIcon
                className="ml-auto size-4 text-navbar-foreground/70 transition-transform group-data-panel-open:rotate-180"
                aria-hidden
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="bg-navbar-accent/75 py-1">
                {CATEGORIES.map((category) => (
                  <MobileNavLink
                    key={category.href}
                    {...category}
                    icon={CATEGORY_ICONS[category.href]}
                    className="pl-8"
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>

          {isLoggedIn && (
            <ul>
              <MobileNavLink
                {...USER_LINKS.history}
                icon={ClockCounterClockwiseIcon}
                onNavigate={() => setOpen(false)}
              />
            </ul>
          )}
        </nav>

        <SheetFooter className="p-0">
          <nav aria-label="Akun">
            <ul className="flex [&_a]:justify-center [&>li]:flex-1">
              {(isLoggedIn
                ? [USER_LINKS.account, USER_LINKS.logout]
                : ACCOUNT_LINKS
              ).map((link) => (
                <MobileNavLink
                  key={link.href}
                  {...link}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </ul>
          </nav>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export { MobileNav }
