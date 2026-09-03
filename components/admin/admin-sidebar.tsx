"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  GaugeIcon,
  PackageIcon,
  ReceiptIcon,
  TruckIcon,
  WalletIcon,
  type Icon,
} from "@phosphor-icons/react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  ADMIN_SECTIONS,
  isSectionActive,
  type AdminSection,
} from "@/lib/admin/config"

const SECTION_ICONS = {
  dashboard: GaugeIcon,
  orders: ReceiptIcon,
  tracking: TruckIcon,
  products: PackageIcon,
  finance: WalletIcon,
} satisfies Record<AdminSection, Icon>

function AdminSidebar() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  return (
    <Sidebar
      collapsible="icon"
      className="top-admin-header h-[calc(100svh-var(--spacing-admin-header))] border-sidebar-border"
    >
      <SidebarContent>
        <nav aria-label="Menu admin">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN_SECTIONS.map((section) => {
                  const SectionIcon = SECTION_ICONS[section.slug]

                  return (
                    <SidebarMenuItem key={section.slug}>
                      <SidebarMenuButton
                        render={
                          <Link
                            href={section.href}
                            onNavigate={() => setOpenMobile(false)}
                          />
                        }
                        isActive={isSectionActive({
                          pathname,
                          href: section.href,
                        })}
                        tooltip={section.label}
                        className="h-10"
                      >
                        <SectionIcon aria-hidden />
                        <span>{section.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>
    </Sidebar>
  )
}

export { AdminSidebar }
