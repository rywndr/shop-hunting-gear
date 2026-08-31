import type { Metadata } from "next"
import { eq } from "drizzle-orm"

import { AccountShell } from "@/components/account/account-shell"
import { AddressTab } from "@/components/account/address-tab"
import { ProfileForm } from "@/components/account/profile-form"
import { SecurityTab } from "@/components/account/security-tab"
import { SectionTabs, type SectionTab } from "@/components/account/section-tabs"
import { ACCOUNT_TABS } from "@/lib/account/config"
import { addressesForUser } from "@/lib/account/service"
import { accountProvider } from "@/lib/account/types"
import { getCurrentSession } from "@/lib/auth/session"
import { db } from "@/lib/db/client"
import { account as authAccount } from "@/lib/db/schema/auth"

export const metadata: Metadata = {
  title: "Akun",
  description: "Kelola info dasar, alamat pengiriman, dan keamanan akun Anda.",
}

export default async function AccountPage() {
  const session = await getCurrentSession()

  if (!session) {
    return null
  }

  const [providerRows, addresses] = await Promise.all([
    db
      .select({ providerId: authAccount.providerId })
      .from(authAccount)
      .where(eq(authAccount.userId, session.user.id)),
    addressesForUser(session.user.id),
  ])
  const account = {
    name: session.user.name,
    email: session.user.email,
    provider: accountProvider(providerRows.map((row) => row.providerId)),
    joinedAt: session.user.createdAt.toISOString(),
  }
  const panels: Record<
    (typeof ACCOUNT_TABS)[number]["value"],
    React.ReactNode
  > = {
    profil: <ProfileForm account={account} />,
    alamat: <AddressTab addresses={addresses} />,
    keamanan: <SecurityTab account={account} />,
  }

  const tabs: readonly SectionTab[] = ACCOUNT_TABS.map((tab) => ({
    ...tab,
    panel: panels[tab.value],
  }))

  return (
    <AccountShell
      title="Akun Saya"
      description="Kelola info dasar, alamat pengiriman, dan keamanan akun Anda."
    >
      <SectionTabs label="Bagian akun" tabs={tabs} />
    </AccountShell>
  )
}
