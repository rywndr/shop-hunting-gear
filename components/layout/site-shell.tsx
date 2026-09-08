import { Suspense } from "react"

import { CategoryBar } from "@/components/layout/category-bar"
import { NavBar } from "@/components/layout/nav-bar"
import { SiteFooter } from "@/components/layout/site-footer"
import { cn } from "@/lib/utils"

type ShellChrome = {
  readonly sticky: boolean
  readonly categories: boolean
  readonly personalized: boolean
}

const SHELL_VARIANTS = {
  browse: { sticky: true, categories: true, personalized: true },
  product: { sticky: true, categories: false, personalized: true },
  account: {
    sticky: false,
    categories: false,
    personalized: true,
  },
  notFound: {
    sticky: true,
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
    <div className="relative flex min-h-svh flex-col">
      <header
        className={cn(
          "bg-navbar text-navbar-foreground",
          chrome.sticky && "sticky top-0 z-20"
        )}
      >
        <NavBar personalized={chrome.personalized} />
      </header>

      {chrome.categories && (
        <Suspense>
          <CategoryBar className="absolute inset-x-0 top-15 z-10" />
        </Suspense>
      )}

      <main className="flex flex-1 flex-col">{children}</main>

      <SiteFooter />
    </div>
  )
}

export { SiteShell }
export type { SiteShellVariant }
