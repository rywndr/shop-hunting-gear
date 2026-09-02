import { Suspense } from "react"

import { CategoryBar } from "@/components/layout/category-bar"
import { NavBar } from "@/components/layout/nav-bar"
import { SiteFooter } from "@/components/layout/site-footer"
import { TopBar } from "@/components/layout/top-bar"
import { cn } from "@/lib/utils"

type ShellChrome = {
  readonly sticky: boolean
  readonly search: boolean
  readonly categories: boolean
  readonly personalized: boolean
}

const SHELL_VARIANTS = {
  browse: { sticky: true, search: true, categories: true, personalized: true },
  product: { sticky: true, search: true, categories: false, personalized: true },
  account: {
    sticky: false,
    search: false,
    categories: false,
    personalized: true,
  },
  notFound: {
    sticky: true,
    search: true,
    categories: false,
    personalized: false,
  },
} as const satisfies Record<string, ShellChrome>

type SiteShellVariant = keyof typeof SHELL_VARIANTS

type SiteShellProps = {
  children: React.ReactNode
  variant: SiteShellVariant
}

function SiteShell({ children, variant }: SiteShellProps) {
  const chrome = SHELL_VARIANTS[variant]

  return (
    <div className="flex min-h-svh flex-col">
      <header
        className={cn(
          "bg-navbar text-navbar-foreground",
          chrome.sticky && "sticky top-0 z-20"
        )}
      >
        <TopBar personalized={chrome.personalized} />
        <NavBar search={chrome.search} personalized={chrome.personalized} />
        {chrome.categories && (
          <Suspense>
            <CategoryBar className="absolute inset-x-0 top-full" />
          </Suspense>
        )}
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <SiteFooter />
    </div>
  )
}

export { SiteShell }
export type { SiteShellVariant }
