"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  CrosshairIcon,
  FishIcon,
  GameControllerIcon,
  HouseIcon,
  ListIcon,
  WrenchIcon,
  type Icon,
} from "@phosphor-icons/react"

import { BrandLogo } from "@/components/layout/brand-logo"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  CATEGORIES,
  CATEGORY_QUERY,
  SEARCH_QUERY,
  findCategories,
  shopHref,
  type CategorySlug,
  type NavLink,
} from "@/lib/site/config"
import { cn } from "@/lib/utils"

const CATEGORY_ICONS = {
  hunting: CrosshairIcon,
  fishing: FishIcon,
  spareparts: WrenchIcon,
  hobbies: GameControllerIcon,
} satisfies Record<CategorySlug, Icon>

const ROW =
  "flex w-full items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-navbar-foreground/10"

function MobileNavLink({
  label,
  href,
  icon: LinkIcon,
  current,
  onNavigate,
}: NavLink & {
  icon: Icon
  current?: boolean
  onNavigate: () => void
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={current}
        onNavigate={onNavigate}
        className={cn(ROW, "aria-[current=true]:bg-navbar-foreground/10")}
      >
        <LinkIcon className="size-4 shrink-0" aria-hidden />
        {label}
      </Link>
    </li>
  )
}

function MobileNav({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const searchParams = useSearchParams()
  const selected = findCategories(searchParams.getAll(CATEGORY_QUERY))
  const selectedSlugs = selected.map((category) => category.slug)
  const search = searchParams.get(SEARCH_QUERY) ?? undefined
  const close = () => setOpen(false)

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
              onNavigate={close}
            />

            {CATEGORIES.map((category) => (
              <MobileNavLink
                key={category.slug}
                {...category}
                href={shopHref({
                  categories: selectedSlugs.includes(category.slug)
                    ? selectedSlugs.filter((slug) => slug !== category.slug)
                    : [...selectedSlugs, category.slug],
                  search,
                })}
                icon={CATEGORY_ICONS[category.slug]}
                current={selectedSlugs.includes(category.slug)}
                onNavigate={close}
              />
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  )
}

export { MobileNav }
