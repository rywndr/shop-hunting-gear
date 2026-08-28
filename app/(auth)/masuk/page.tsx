import type { Metadata } from "next"

import { AuthCard } from "@/components/auth/auth-card"
import { SignInForm } from "@/components/auth/sign-in-form"
import { AUTH_ROUTES, SITE } from "@/lib/site/config"

export const metadata: Metadata = {
  title: `Masuk | ${SITE.alternateName}`,
  description: "Masuk ke akun Anda untuk melanjutkan belanja.",
}

export default function Page() {
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
      <SignInForm />
    </AuthCard>
  )
}
