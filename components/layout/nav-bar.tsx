import Link from "next/link"
import { UserCircleIcon } from "@phosphor-icons/react/ssr"

import { BrandLogo } from "@/components/layout/brand-logo"
import { CartSheet } from "@/components/layout/cart-sheet"
import { MobileNav } from "@/components/layout/mobile-nav"
import { SearchForm } from "@/components/layout/search-form"
import { ThemeToggleMenuItem } from "@/components/layout/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IS_LOGGED_IN, USER_LINKS } from "@/lib/site-config"

function NavBar({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 md:gap-x-4 md:pt-0 md:pb-3">
        <MobileNav isLoggedIn={IS_LOGGED_IN} className="md:hidden" />
        <BrandLogo className="mr-auto md:-mt-6" />
        <SearchForm className="order-last w-full md:order-none md:w-64 lg:w-72" />
        <CartSheet />
        {/* Not modal: a modal menu locks page scroll and hides the scrollbar. */}
        {IS_LOGGED_IN && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Menu akun"
                  className="text-navbar-foreground hover:bg-navbar-foreground/10 hover:text-navbar-foreground"
                />
              }
            >
              <UserCircleIcon className="size-6" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-auto border border-navbar-border bg-navbar-accent text-navbar-accent-foreground"
            >
              {Object.values(USER_LINKS).map((link) => (
                <DropdownMenuItem
                  key={link.href}
                  render={<Link href={link.href} />}
                  className="focus:bg-navbar-foreground/10 focus:text-navbar-foreground"
                >
                  {link.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-navbar-border" />
              <ThemeToggleMenuItem className="focus:bg-navbar-foreground/10 focus:text-navbar-foreground focus:**:text-navbar-foreground!" />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

export { NavBar }
