import Link from "next/link"
import { PhoneIcon } from "@phosphor-icons/react/ssr"

import { ThemeToggle } from "@/components/layout/theme-toggle"
import { getCurrentSession } from "@/lib/auth/session"
import { ACCOUNT_LINKS, SITE } from "@/lib/site/config"
import { cn } from "@/lib/utils"

async function TopBar({
  className,
  personalized = true,
}: {
  className?: string
  personalized?: boolean
}) {
  const session = personalized ? await getCurrentSession() : null

  return (
    <div className={cn("text-navbar-foreground/70", className)}>
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-end gap-4 px-4 text-[11px] tracking-wide uppercase sm:text-xs md:h-8">
        {!session && (
          <ThemeToggle className="text-navbar-foreground/70 hover:bg-navbar-foreground/10 hover:text-navbar-foreground" />
        )}

        <a
          href={SITE.phone.href}
          className="inline-flex items-center gap-1.5 transition-colors hover:text-navbar-foreground"
        >
          <PhoneIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Hubungi kami</span>
          <span>{SITE.phone.display}</span>
        </a>

        {personalized && !session && (
          <nav
            aria-label="Akun"
            className="flex items-center gap-2 text-navbar-foreground"
          >
            {ACCOUNT_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap transition-colors before:mr-2 before:text-navbar-foreground/40 before:content-['/'] first:before:hidden hover:text-navbar-foreground/70"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}

export { TopBar }
