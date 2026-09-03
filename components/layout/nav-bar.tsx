import { Suspense } from "react"

import { AccountMenu } from "@/components/layout/account-menu"
import { BrandLogo } from "@/components/layout/brand-logo"
import { CartSheet } from "@/components/layout/cart-sheet"
import { GuestAccountMenu } from "@/components/layout/guest-account-menu"
import { MobileNav } from "@/components/layout/mobile-nav"
import { accountMenuLinks } from "@/lib/admin/config"
import { canAccessAdmin, getCurrentSession } from "@/lib/auth/session"

async function NavBar({
  className,
  personalized = true,
}: {
  className?: string
  personalized?: boolean
}) {
  const session = personalized ? await getCurrentSession() : null
  const isAdmin = canAccessAdmin(session)

  return (
    <div className={className}>
      <div className="relative flex items-center gap-2 px-4 py-3 md:gap-4 md:px-8">
        <Suspense fallback={<div aria-hidden className="size-10 md:hidden" />}>
          <MobileNav
            accountState={
              personalized
                ? session
                  ? isAdmin
                    ? "admin"
                    : "authenticated"
                  : "guest"
                : "hidden"
            }
            className="md:hidden"
          />
        </Suspense>
        <BrandLogo
          layout="inline"
          className="absolute left-1/2 -translate-x-1/2 md:static md:mr-auto md:translate-x-0"
        />
        {session ? (
          <AccountMenu
            links={accountMenuLinks(isAdmin)}
            className="hidden md:inline-flex"
          />
        ) : (
          personalized && <GuestAccountMenu className="hidden md:block" />
        )}
        <CartSheet className="ml-auto md:ml-0" />
      </div>
    </div>
  )
}

export { NavBar }
