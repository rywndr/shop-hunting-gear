import { AccountMenu } from "@/components/layout/account-menu"
import { BrandLogo } from "@/components/layout/brand-logo"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ADMIN_MENU_LINKS } from "@/lib/admin/config"

function AdminHeader() {
  return (
    <header className="sticky top-0 z-30 h-admin-header shrink-0 border-b border-navbar-border bg-navbar text-navbar-foreground">
      <div className="flex h-full items-center gap-1 px-2 sm:gap-2 sm:px-4">
        <BrandLogo layout="inline" />
        <SidebarTrigger
          size="icon-lg"
          className="mr-auto text-navbar-foreground hover:bg-navbar-foreground/10 hover:text-navbar-foreground"
        />
        <AccountMenu links={ADMIN_MENU_LINKS} />
      </div>
    </header>
  )
}

export { AdminHeader }
