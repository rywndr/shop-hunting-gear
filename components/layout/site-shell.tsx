import { Suspense } from "react"

import { CategoryBar } from "@/components/layout/category-bar"
import { NavBar } from "@/components/layout/nav-bar"
import { SiteFooter } from "@/components/layout/site-footer"
import { TopBar } from "@/components/layout/top-bar"
import { cn } from "@/lib/utils"

type SiteShellProps = {
  children: React.ReactNode
  /**
   * `shop`, header sticks so the search field and cart follow along
   *  and category row behind it.
   *
   * `account`, header stays put and drops both the category row and the search field,
   */
  variant: "shop" | "account"
}

function SiteShell({ children, variant }: SiteShellProps) {
  const browsing = variant === "shop"

  return (
    <div className="flex min-h-svh flex-col">
      <header
        className={cn(
          "bg-navbar text-navbar-foreground",
          browsing && "sticky top-0 z-20"
        )}
      >
        <TopBar />
        <NavBar search={browsing} />
        {browsing && (
          <Suspense>
            <CategoryBar className="absolute inset-x-0 top-full" />
          </Suspense>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <SiteFooter />
    </div>
  )
}

export { SiteShell }
