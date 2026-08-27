import Link from "next/link"

import { BrandLogo } from "@/components/layout/brand-logo"
import { CartSheet } from "@/components/layout/cart-sheet"
import { MobileNav } from "@/components/layout/mobile-nav"
import { SearchForm } from "@/components/layout/search-form"
import { CATEGORIES } from "@/lib/site-config"

function NavBar({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 md:gap-x-4 md:pt-0 md:pb-3">
        <MobileNav className="md:hidden" />
        <BrandLogo className="mr-auto md:-mt-6" />
        <SearchForm className="order-last w-full md:order-none md:w-64 lg:w-72" />
        <CartSheet />
      </div>

      {/* Slightly opaque, hero carousel will sit behind this row. */}
      <nav
        aria-label="Kategori produk"
        className="hidden border-t border-navbar-border bg-navbar-accent/75 md:block"
      >
        <ul className="mx-auto flex max-w-7xl items-center justify-center px-4">
          {CATEGORIES.map((category) => (
            <li key={category.href}>
              <Link
                href={category.href}
                className="block px-6 py-3 text-sm font-medium tracking-wide text-navbar-accent-foreground uppercase transition-colors hover:bg-navbar-foreground/10"
              >
                {category.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export { NavBar }
