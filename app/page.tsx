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
      <header className="bg-navbar text-navbar-foreground">
        <TopBar />
        <NavBar />
      </header>

      <main className="flex-1">
        <SectionPlaceholder label="hero-carousel" />
        <SectionPlaceholder label="product-list" />
      </main>

      <SiteFooter />
    </div>
  )
}
