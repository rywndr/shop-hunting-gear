import { HeroCarousel } from "@/components/layout/hero-carousel"

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
    <>
      <HeroCarousel />
      <SectionPlaceholder label="product-list" />
    </>
  )
}
