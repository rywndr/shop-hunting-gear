import Link from "next/link"
import { EnvelopeSimpleIcon, PhoneIcon } from "@phosphor-icons/react/ssr"

import { BrandLogo } from "@/components/layout/brand-logo"
import { CATEGORIES, INFO_LINKS, SITE } from "@/lib/site/config"
import { cn } from "@/lib/utils"

function ColumnHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2
      id={id}
      className="font-heading text-sm font-bold tracking-wide text-navbar-foreground uppercase"
    >
      {children}
    </h2>
  )
}

const linkClassName =
  "text-navbar-foreground/70 transition-colors hover:text-navbar-foreground"

function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("bg-navbar text-navbar-foreground", className)}>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:gap-6">
        <div className="flex flex-col items-start gap-4">
          <BrandLogo />

          <div className="flex flex-col gap-2 text-sm">
            <a
              href={SITE.phone.href}
              className={cn("inline-flex items-center gap-2", linkClassName)}
            >
              <PhoneIcon className="size-4 shrink-0" aria-hidden />
              {SITE.phone.display}
            </a>
            <a
              href={SITE.email.href}
              className={cn("inline-flex items-center gap-2", linkClassName)}
            >
              <EnvelopeSimpleIcon className="size-4 shrink-0" aria-hidden />
              {SITE.email.display}
            </a>
          </div>
        </div>

        <nav aria-labelledby="footer-kategori" className="flex flex-col gap-3">
          <ColumnHeading id="footer-kategori">Kategori</ColumnHeading>
          <ul className="flex flex-col gap-2 text-sm">
            {CATEGORIES.map((category) => (
              <li key={category.href}>
                <Link href={category.href} className={linkClassName}>
                  {category.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-informasi" className="flex flex-col gap-3">
          <ColumnHeading id="footer-informasi">Informasi</ColumnHeading>
          <ul className="flex flex-col gap-2 text-sm">
            {INFO_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClassName}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div>
        <p className="mx-auto flex max-w-7xl items-center justify-center px-4 py-2 text-center text-[11px] tracking-wide text-navbar-foreground/70">
          &copy; {new Date().getFullYear()} {SITE.alternateName} Seluruh hak
          cipta dilindungi.
        </p>
      </div>
    </footer>
  )
}

export { SiteFooter }
