import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { BrandLogo } from "@/components/layout/brand-logo"
import { AUTH_SHOWCASE, INFO_LINKS, SITE } from "@/lib/site/config"
import { PRIVATE_ROBOTS } from "@/lib/site/metadata"

export const metadata: Metadata = { robots: PRIVATE_ROBOTS }

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-navbar text-navbar-foreground">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-center px-4 sm:justify-start">
          <BrandLogo layout="inline" />
        </div>
      </header>

      <main className="flex flex-1 lg:grid lg:grid-cols-2">
        <div className="flex flex-1 items-center justify-center px-4 py-10 md:py-14">
          {children}
        </div>

        <aside className="relative hidden overflow-hidden bg-navbar lg:block">
          <Image
            src={AUTH_SHOWCASE.image}
            alt={AUTH_SHOWCASE.alt}
            fill
            sizes="50vw"
            className="object-cover"
            style={{ objectPosition: AUTH_SHOWCASE.focus }}
          />
          <div className="absolute inset-0 bg-linear-to-t from-navbar/95 via-navbar/30 via-60% to-navbar/10" />
          <div className="absolute inset-x-0 bottom-0 p-10 text-navbar-foreground">
            <p className="font-heading text-2xl leading-tight font-bold tracking-tight uppercase">
              {AUTH_SHOWCASE.title}
            </p>
            <p className="mt-2 max-w-sm text-sm text-navbar-foreground/80">
              {AUTH_SHOWCASE.body}
            </p>
          </div>
        </aside>
      </main>

      <footer className="border-t border-navbar-border bg-navbar text-navbar-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-3 text-center text-[11px] tracking-wide sm:flex-row sm:justify-between sm:text-left">
          <p className="text-navbar-foreground/70">
            &copy; {new Date().getFullYear()} {SITE.alternateName}
          </p>
          <nav aria-label="Informasi toko">
            <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {INFO_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-navbar-foreground/70 transition-colors hover:text-navbar-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  )
}
