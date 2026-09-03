import Link from "next/link"
import { UserCircleIcon } from "@phosphor-icons/react/ssr"

import { Button } from "@/components/ui/button"
import { AUTH_ROUTES } from "@/lib/site/config"
import { cn } from "@/lib/utils"

function GuestAccountMenu({ className }: { className?: string }) {
  return (
    <div className={cn("group relative", className)}>
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label="Menu akun"
        className="text-navbar-foreground hover:bg-navbar-foreground/10 hover:text-navbar-foreground"
      >
        <UserCircleIcon className="size-6" />
      </Button>

      <div className="invisible absolute top-full left-1/2 z-30 w-64 -translate-x-1/2 pt-2 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="border border-border bg-popover p-5 text-center text-popover-foreground shadow-lg">
          <Button
            nativeButton={false}
            render={<Link href={AUTH_ROUTES.signIn} />}
            variant="secondary"
          >
            Masuk
          </Button>
          <p className="mt-3 text-sm text-muted-foreground">
            Belum punya akun?
          </p>
          <Link
            href={AUTH_ROUTES.register}
            className="text-sm font-bold underline underline-offset-4"
          >
            Daftar
          </Link>
        </div>
      </div>
    </div>
  )
}

export { GuestAccountMenu }
