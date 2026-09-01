import { redirect } from "next/navigation"
import type { Metadata } from "next"

import { AuthCard } from "@/components/auth/auth-card"
import { SignInForm } from "@/components/auth/sign-in-form"
import { safeAuthRedirect } from "@/lib/auth/redirect"
import { getCurrentSession } from "@/lib/auth/session"
import { AUTH_ROUTES } from "@/lib/site/config"

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke akun Anda untuk melanjutkan belanja.",
}

export default async function Page({ searchParams }: PageProps<"/masuk">) {
  const { callbackURL } = await searchParams
  const redirectTo = safeAuthRedirect(
    typeof callbackURL === "string" ? callbackURL : "/"
  )
  const session = await getCurrentSession()

  if (session) {
    redirect(redirectTo)
  }

  return (
    <AuthCard
      title="Masuk"
      description="Masuk untuk melanjutkan belanja."
      alternate={{
        prompt: "Belum punya akun?",
        label: "Daftar sekarang",
        href: AUTH_ROUTES.register,
      }}
    >
      <SignInForm callbackURL={redirectTo} />
    </AuthCard>
  )
}
