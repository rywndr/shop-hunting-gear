import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { canAccessAdmin, getCurrentSession } from "@/lib/auth/session"
import { AUTH_ROUTES } from "@/lib/site/config"
import { PRIVATE_ROBOTS } from "@/lib/site/metadata"

export const metadata: Metadata = { robots: PRIVATE_ROBOTS }

export default async function ShippingLabelLayout({
  children,
}: LayoutProps<"/admin/orders/[orderId]/label">) {
  const session = await getCurrentSession()

  if (!session) {
    redirect(`${AUTH_ROUTES.signIn}?callbackURL=/admin`)
  }

  if (!canAccessAdmin(session)) {
    redirect("/")
  }

  return children
}
