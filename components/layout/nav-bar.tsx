import { Suspense } from "react"

import { AccountMenu } from "@/components/layout/account-menu"
import { BrandLogo } from "@/components/layout/brand-logo"
import { CartSheet } from "@/components/layout/cart-sheet"
import { MobileNav } from "@/components/layout/mobile-nav"
import { SearchForm } from "@/components/layout/search-form"
import { accountMenuLinks } from "@/lib/admin/config"
import { canAccessAdmin, getCurrentSession } from "@/lib/auth/session"

const SEARCH_CLASS = "order-last w-full md:order-none md:w-64 lg:w-72"

async function NavBar({
  className,
  search = true,
  personalized = true,
}: {
  className?: string
  search?: boolean
  personalized?: boolean
}) {
  const session = personalized ? await getCurrentSession() : null
  const isAdmin = canAccessAdmin(session)

  return (
    <div className={className}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 md:gap-x-4 md:pt-0 md:pb-3">
        <Suspense fallback={<div aria-hidden className="size-10 md:hidden" />}>
          <MobileNav className="md:hidden" />
        </Suspense>
        <BrandLogo className="mr-auto md:-mt-6" />
        {search && (
          <Suspense
            fallback={<div aria-hidden className={`h-10 ${SEARCH_CLASS}`} />}
          >
            <SearchForm className={SEARCH_CLASS} />
          </Suspense>
        )}
        <CartSheet />
        {session && <AccountMenu links={accountMenuLinks(isAdmin)} />}
      </div>
    </div>
  )
}

export { NavBar }
