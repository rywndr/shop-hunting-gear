import { CategoryBar } from "@/components/layout/category-bar"
import { HeroCarousel } from "@/components/layout/hero-carousel"
import { NavBar } from "@/components/layout/nav-bar"
import { SiteFooter } from "@/components/layout/site-footer"
import { TopBar } from "@/components/layout/top-bar"

function SectionPlaceholder({ label }: { label: string }) {
  return (
    <section
      aria-label={label}
      className="flex min-h-28 items-center justify-center border-b border-border px-4 py-8 text-sm text-muted-foreground"
    >
      [placeholder] {label}
    </section>
  )
}

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="relative z-20 bg-navbar text-navbar-foreground">
        <TopBar />
        <NavBar />
        <CategoryBar className="absolute inset-x-0 top-full" />
      </header>

      <main className="flex-1">
        <HeroCarousel />
        <SectionPlaceholder label="product-list" />
      </main>

      <SiteFooter />
    </div>
  )
}
