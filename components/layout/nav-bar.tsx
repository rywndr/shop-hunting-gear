import { Suspense } from "react"

import { AccountMenu } from "@/components/layout/account-menu"
import { BrandLogo } from "@/components/layout/brand-logo"
import { CartSheet } from "@/components/layout/cart-sheet"
import { GuestAccountMenu } from "@/components/layout/guest-account-menu"
import { MobileNav } from "@/components/layout/mobile-nav"
import { accountMenuLinks } from "@/lib/admin/config"
import { canAccessAdmin, getCurrentSession } from "@/lib/auth/session"

async function PersonalizedMobileNav() {
  const session = await getCurrentSession()
  const accountState = session
    ? canAccessAdmin(session)
      ? "admin"
      : "authenticated"
    : "guest"

  return <MobileNav accountState={accountState} className="md:hidden" />
}

async function PersonalizedDesktopAccountMenu() {
  const session = await getCurrentSession()

  if (!session) {
    return <GuestAccountMenu className="hidden md:block" />
  }

  return (
    <AccountMenu
      links={accountMenuLinks(canAccessAdmin(session))}
      align="end"
      className="hidden md:inline-flex"
    />
  )
}

function NavBar({
  className,
  personalized = true,
}: {
  className?: string
  personalized?: boolean
}) {
  return (
    <div className={className}>
      <div className="relative flex h-navbar items-center gap-2 px-4 py-3 md:gap-4 md:px-8">
        {personalized ? (
          <Suspense
            fallback={<div aria-hidden className="size-10 md:hidden" />}
          >
            <PersonalizedMobileNav />
          </Suspense>
        ) : (
          <MobileNav accountState="hidden" className="md:hidden" />
        )}
        <BrandLogo
          layout="inline"
          className="absolute left-1/2 -translate-x-1/2 md:static md:mr-auto md:translate-x-0"
        />
        {personalized && (
          <Suspense
            fallback={<div aria-hidden className="hidden size-10 md:block" />}
          >
            <PersonalizedDesktopAccountMenu />
          </Suspense>
        )}
        <CartSheet className="ml-auto md:ml-0" />
      </div>
    </div>
  )
}

export { NavBar }
