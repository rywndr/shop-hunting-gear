"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { UserCircleIcon } from "@phosphor-icons/react"

import { ThemeToggleMenuItem } from "@/components/layout/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth/client"
import { USER_LINKS, type NavLink } from "@/lib/site/config"
import { cn } from "@/lib/utils"

function AccountMenu({
  links,
  className,
}: {
  links: readonly NavLink[]
  className?: string
}) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    const { error } = await authClient.signOut()

    if (error) {
      setSigningOut(false)
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Menu akun"
            className={cn(
              "text-navbar-foreground hover:bg-navbar-foreground/10 hover:text-navbar-foreground",
              className
            )}
          />
        }
      >
        <UserCircleIcon className="size-6" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-auto border border-navbar-border bg-navbar-accent text-navbar-accent-foreground"
      >
        {links.map((link) =>
          link.href === USER_LINKS.logout.href ? (
            <DropdownMenuItem
              key={link.href}
              disabled={signingOut}
              onClick={signOut}
              className="focus:bg-navbar-foreground/10 focus:text-navbar-foreground"
            >
              {signingOut ? "Keluar..." : link.label}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              key={link.href}
              render={<Link href={link.href} />}
              className="focus:bg-navbar-foreground/10 focus:text-navbar-foreground"
            >
              {link.label}
            </DropdownMenuItem>
          )
        )}
        <DropdownMenuSeparator className="bg-navbar-border" />
        <ThemeToggleMenuItem className="focus:bg-navbar-foreground/10 focus:text-navbar-foreground focus:**:text-navbar-foreground!" />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { AccountMenu }
