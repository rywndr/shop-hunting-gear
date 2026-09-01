import { redirect } from "next/navigation"
import type { Metadata } from "next"

import { AuthCard } from "@/components/auth/auth-card"
import { RegisterForm } from "@/components/auth/register-form"
import { safeAuthRedirect } from "@/lib/auth/redirect"
import { getCurrentSession } from "@/lib/auth/session"
import { AUTH_ROUTES } from "@/lib/site/config"

export const metadata: Metadata = {
  title: "Daftar",
  description: "Buat akun untuk belanja perlengkapan outdoor lebih cepat.",
}

export default async function Page({ searchParams }: PageProps<"/daftar">) {
  const { callbackURL } = await searchParams
  const redirectTo = safeAuthRedirect(
    typeof callbackURL === "string" ? callbackURL : undefined
  )
  const session = await getCurrentSession()

  if (session) {
    redirect(redirectTo)
  }

  return (
    <AuthCard
      title="Daftar"
      description="Buat akun sekali, lalu pesanan berikutnya jadi lebih cepat."
      alternate={{
        prompt: "Sudah punya akun?",
        label: "Masuk di sini",
        href: AUTH_ROUTES.signIn,
      }}
    >
      <RegisterForm callbackURL={redirectTo} />
    </AuthCard>
  )
}
