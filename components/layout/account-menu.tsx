"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { UserCircleIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { useNotification } from "@/components/notification/notification-provider"
import { authClient } from "@/lib/auth/client"
import { USER_LINKS, type NavLink } from "@/lib/site/config"
import { cn } from "@/lib/utils"

function AccountMenu({
  links,
  className,
  align = "center",
}: {
  links: readonly NavLink[]
  className?: string
  align?: "center" | "end"
}) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const { showNotification } = useNotification()

  async function signOut() {
    setSigningOut(true)

    try {
      const { error } = await authClient.signOut()

      if (error) {
        showNotification({
          variant: "error",
          message: "Tidak dapat keluar dari akun. Coba lagi.",
        })
        setSigningOut(false)
        return
      }

      showNotification({ variant: "success", message: "Berhasil keluar dari akun." })
      router.push("/")
      router.refresh()
    } catch {
      showNotification({
        variant: "error",
        message: "Tidak dapat keluar dari akun. Coba lagi.",
      })
      setSigningOut(false)
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div className="group relative">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Menu akun"
          className="text-navbar-foreground hover:bg-navbar-foreground/10 hover:text-navbar-foreground"
        >
          <UserCircleIcon className="size-6" />
        </Button>

        <div
          className={cn(
            "invisible absolute top-full z-30 w-48 pt-2 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
            align === "center" ? "left-1/2 -translate-x-1/2" : "right-0"
          )}
        >
          <div className="border border-border bg-secondary p-5 text-secondary-foreground shadow-lg">
            <nav aria-label="Tautan akun">
              <ul className="space-y-1">
                {links
                  .filter((link) => link.href !== USER_LINKS.logout.href)
                  .map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="block px-2 py-2 text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </nav>

            <button
              type="button"
              disabled={signingOut}
              onClick={signOut}
              className="mt-8 px-2 text-sm font-medium underline underline-offset-4 disabled:opacity-50"
            >
              {signingOut ? "Keluar..." : "Keluar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export { AccountMenu }
