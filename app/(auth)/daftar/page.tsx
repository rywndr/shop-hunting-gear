import type { Metadata } from "next"

import { AuthCard } from "@/components/auth/auth-card"
import { RegisterForm } from "@/components/auth/register-form"
import { AUTH_ROUTES, SITE } from "@/lib/site/config"

export const metadata: Metadata = {
  title: `Daftar | ${SITE.alternateName}`,
  description: "Buat akun untuk belanja perlengkapan outdoor lebih cepat.",
}

export default function Page() {
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
      <RegisterForm />
    </AuthCard>
  )
}
