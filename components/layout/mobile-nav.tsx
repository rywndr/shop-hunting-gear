"use client"

import { useEffect, useState, type MouseEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CaretDownIcon,
  ListIcon,
  UserCircleIcon,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { authClient } from "@/lib/auth/client"
import { ADMIN_LINK } from "@/lib/admin/config"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  AUTH_ROUTES,
  MARKETPLACE_LINKS,
  SITE,
  USER_LINKS,
  type NavLink,
} from "@/lib/site/config"
import { MOBILE_QUERY } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

const ROW =
  "mx-8 flex w-auto items-center border-b border-navbar-border py-3 text-sm font-medium transition-colors hover:bg-navbar-foreground/10"

function MobileNavLink({
  label,
  href,
  onNavigate,
}: NavLink & { onNavigate: () => void }) {
  return (
    <li>
      <Link href={href} onNavigate={onNavigate} className={ROW}>
        {label}
      </Link>
    </li>
  )
}

function MobileNav({
  accountState = "hidden",
  className,
}: {
  accountState?: "hidden" | "guest" | "authenticated" | "admin"
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()
  const close = () => setOpen(false)

  function navigateToProducts(event: MouseEvent<HTMLAnchorElement>) {
    if (window.location.pathname !== "/") {
      close()
      return
    }

    event.preventDefault()
    close()
    window.history.replaceState(null, "", "/#produk")
    window.requestAnimationFrame(() => {
      document.getElementById("produk")?.scrollIntoView({ block: "start" })
    })
  }

  async function signOut() {
    setSigningOut(true)
    const { error } = await authClient.signOut()

    if (error) {
      setSigningOut(false)
      return
    }

    close()
    router.push("/")
    router.refresh()
  }

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        setOpen(false)
      }
    }

    query.addEventListener("change", closeOnDesktop)
    return () => query.removeEventListener("change", closeOnDesktop)
  }, [])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Buka menu"
            className={cn(
              "-ml-2 text-navbar-foreground hover:bg-navbar-foreground/10 hover:text-navbar-foreground",
              className
            )}
          />
        }
      >
        <ListIcon className="size-6" />
      </SheetTrigger>

      <SheetContent
        side="left"
        overlayClassName="md:transition-none"
        className="border-navbar-border bg-navbar text-navbar-foreground md:transition-none [&_[data-slot=sheet-close]]:top-0 [&_[data-slot=sheet-close]]:right-auto [&_[data-slot=sheet-close]]:left-4 [&_[data-slot=sheet-close]]:h-14 [&_[data-slot=sheet-close]]:bg-transparent [&_[data-slot=sheet-close]]:text-navbar-foreground [&_[data-slot=sheet-close]]:hover:bg-transparent"
      >
        <SheetHeader className="h-14 p-0">
          <SheetTitle className="sr-only">Menu toko</SheetTitle>
        </SheetHeader>

        <nav aria-label="Menu toko" className="flex-1 overflow-y-auto py-2">
          <ul className="[&>li:first-child>a]:border-t">
            {accountState === "admin" && (
              <MobileNavLink {...ADMIN_LINK} onNavigate={close} />
            )}
            <li>
              <Link
                href="/#produk"
                onClick={navigateToProducts}
                className={ROW}
              >
                Belanja
              </Link>
            </li>
            {(accountState === "authenticated" ||
              accountState === "admin") && (
              <MobileNavLink {...USER_LINKS.history} onNavigate={close} />
            )}
            <MobileNavLink
              label="Tentang Kami"
              href="/tentang-kami"
              onNavigate={close}
            />
            <li>
              <Collapsible>
                <CollapsibleTrigger
                  className={cn(ROW, "group w-[calc(100%-4rem)]")}
                >
                  Platform Lain
                  <CaretDownIcon
                    className="ml-auto size-4 transition-transform group-data-[panel-open]:rotate-180"
                    aria-hidden
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="w-full">
                  <ul className="py-1">
                    {MARKETPLACE_LINKS.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          onClick={close}
                          className="mx-8 flex items-center gap-2 py-3 pl-4 text-sm font-normal transition-colors hover:text-navbar-foreground/70"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center bg-navbar-foreground p-1">
                            <Image
                              src={link.image}
                              width={24}
                              height={24}
                              alt=""
                              unoptimized
                              className="size-6 object-contain"
                            />
                          </span>
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            </li>
            <li>
              <a href={SITE.whatsapp.href} className={ROW}>
                Hubungi Kami
              </a>
            </li>
          </ul>
        </nav>

        {accountState === "guest" && (
          <footer className="mt-auto flex flex-col items-start gap-2 p-4 text-sm">
            <Button
              nativeButton={false}
              variant="secondary"
              render={
                <Link href={AUTH_ROUTES.signIn} onNavigate={close} />
              }
            >
              Masuk
            </Button>
            <p className="text-navbar-foreground/70">atau</p>
            <Link
              href={AUTH_ROUTES.register}
              onNavigate={close}
              className="font-bold text-navbar-foreground hover:underline"
            >
              Daftar
            </Link>
          </footer>
        )}

        {(accountState === "authenticated" || accountState === "admin") && (
          <footer className="mt-auto flex flex-col items-start gap-4 p-4 text-sm">
            <Link
              href={USER_LINKS.account.href}
              onNavigate={close}
              className="inline-flex items-center gap-3 font-medium underline underline-offset-4"
            >
              <UserCircleIcon className="size-4" aria-hidden />
              Akun Saya
            </Link>
            <button
              type="button"
              disabled={signingOut}
              onClick={signOut}
              className="font-medium underline underline-offset-4 disabled:opacity-50"
            >
              {signingOut ? "Keluar..." : "Keluar"}
            </button>
          </footer>
        )}
      </SheetContent>
    </Sheet>
  )
}

export { MobileNav }
