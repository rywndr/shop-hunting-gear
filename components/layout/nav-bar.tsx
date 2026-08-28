import { BrandLogo } from "@/components/layout/brand-logo"
import { CartSheet } from "@/components/layout/cart-sheet"
import { MobileNav } from "@/components/layout/mobile-nav"
import { SearchForm } from "@/components/layout/search-form"

function NavBar({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 md:gap-x-4 md:pt-0 md:pb-3">
        <MobileNav className="md:hidden" />
        <BrandLogo className="mr-auto md:-mt-6" />
        <SearchForm className="order-last w-full md:order-none md:w-64 lg:w-72" />
        <CartSheet />
      </div>
    </div>
  )
}

export { NavBar }
