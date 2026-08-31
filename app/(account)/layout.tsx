import { redirect } from "next/navigation"

import { SiteShell } from "@/components/layout/site-shell"
import { getCurrentSession } from "@/lib/auth/session"
import { AUTH_ROUTES } from "@/lib/site/config"

export default async function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getCurrentSession()

  if (!session) {
    redirect(`${AUTH_ROUTES.signIn}?callbackURL=/akun`)
  }

  return <SiteShell variant="account">{children}</SiteShell>
}
