import { redirect } from "next/navigation"

import { AdminShell } from "@/components/admin/admin-shell"
import { canAccessAdmin, getCurrentSession } from "@/lib/auth/session"
import { AUTH_ROUTES } from "@/lib/site/config"

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await getCurrentSession()

  if (!session) {
    redirect(`${AUTH_ROUTES.signIn}?callbackURL=/admin`)
  }

  if (!canAccessAdmin(session)) {
    redirect("/")
  }

  return <AdminShell>{children}</AdminShell>
}
