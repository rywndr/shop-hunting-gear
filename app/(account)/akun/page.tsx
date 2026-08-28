import type { Metadata } from "next"

import { AccountShell } from "@/components/account/account-shell"
import { AddressTab } from "@/components/account/address-tab"
import { ProfileForm } from "@/components/account/profile-form"
import { SecurityTab } from "@/components/account/security-tab"
import { SectionTabs, type SectionTab } from "@/components/account/section-tabs"
import { ACCOUNT_TABS } from "@/lib/account/config"
import { MOCK_ACCOUNT, MOCK_ADDRESSES } from "@/lib/account/mock"

export const metadata: Metadata = {
  title: "Akun",
  description: "Kelola info dasar, alamat pengiriman, dan keamanan akun Anda.",
}

export default function AccountPage() {
  const panels: Record<
    (typeof ACCOUNT_TABS)[number]["value"],
    React.ReactNode
  > = {
    profil: <ProfileForm account={MOCK_ACCOUNT} />,
    alamat: <AddressTab addresses={MOCK_ADDRESSES} />,
    keamanan: <SecurityTab account={MOCK_ACCOUNT} />,
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
