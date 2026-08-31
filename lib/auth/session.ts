import { cache } from "react"
import { headers } from "next/headers"

import { auth, type AuthSession } from "@/lib/auth"

export const getCurrentSession = cache(async () =>
  auth.api.getSession({ headers: await headers() })
)

export function canAccessAdmin(session: AuthSession | null): boolean {
  return session?.user.role === "admin"
}
