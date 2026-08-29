import Link from "next/link"
import { UserCircleIcon } from "@phosphor-icons/react/ssr"

import { ThemeToggleMenuItem } from "@/components/layout/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { NavLink } from "@/lib/site/config"
import { cn } from "@/lib/utils"

function AccountMenu({
  links,
  className,
}: {
  links: readonly NavLink[]
  className?: string
}) {
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
        {links.map((link) => (
          <DropdownMenuItem
            key={link.href}
            render={<Link href={link.href} />}
            className="focus:bg-navbar-foreground/10 focus:text-navbar-foreground"
          >
            {link.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-navbar-border" />
        <ThemeToggleMenuItem className="focus:bg-navbar-foreground/10 focus:text-navbar-foreground focus:**:text-navbar-foreground!" />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { AccountMenu }
