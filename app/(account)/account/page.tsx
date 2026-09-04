import { Suspense } from "react"
import type { Metadata } from "next"
import { eq } from "drizzle-orm"

import { AccountCard } from "@/components/account/account-card"
import { AccountShell } from "@/components/account/account-shell"
import { AddressTab } from "@/components/account/address-tab"
import { ProfileForm } from "@/components/account/profile-form"
import { SecurityTab } from "@/components/account/security-tab"
import { SectionTabs, type SectionTab } from "@/components/account/section-tabs"
import { Skeleton } from "@/components/ui/skeleton"
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

function FormCardSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <AccountCard
      title="Memuat data"
      description="Data akun Anda sedang disiapkan."
      footer={<Skeleton className="h-10 w-36 rounded-none" />}
    >
      <div className="flex flex-col gap-4" aria-label="Memuat data akun">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3.5 w-28 rounded-none" />
            <Skeleton className="h-10 w-full rounded-none" />
          </div>
        ))}
      </div>
    </AccountCard>
  )
}

function AddressTabSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-label="Memuat alamat tersimpan">
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="border border-border p-4">
          <Skeleton className="h-4 w-24 rounded-none" />
          <Skeleton className="mt-3 h-3.5 w-40 rounded-none" />
          <Skeleton className="mt-2 h-3.5 w-full max-w-lg rounded-none" />
          <Skeleton className="mt-4 h-8 w-28 rounded-none" />
        </div>
      ))}
      <Skeleton className="h-10 w-36 rounded-none" />
    </div>
  )
}

function AccountTabsSkeleton() {
  const panels: Record<
    (typeof ACCOUNT_TABS)[number]["value"],
    React.ReactNode
  > = {
    profil: <FormCardSkeleton />,
    alamat: <AddressTabSkeleton />,
    keamanan: (
      <div className="flex flex-col gap-4">
        <FormCardSkeleton fields={3} />
        <FormCardSkeleton fields={1} />
      </div>
    ),
  }

  return (
    <SectionTabs
      label="Bagian akun"
      tabs={ACCOUNT_TABS.map((tab) => ({ ...tab, panel: panels[tab.value] }))}
    />
  )
}

async function AccountTabs() {
  const session = await getCurrentSession()

  if (!session) return null

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

  return <SectionTabs label="Bagian akun" tabs={tabs} />
}

export default function AccountPage() {
  return (
    <AccountShell
      title="Akun Saya"
      description="Kelola info dasar, alamat pengiriman, dan keamanan akun Anda."
    >
      <Suspense fallback={<AccountTabsSkeleton />}>
        <AccountTabs />
      </Suspense>
    </AccountShell>
  )
}
