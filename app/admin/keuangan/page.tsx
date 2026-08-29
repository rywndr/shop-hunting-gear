import type { Metadata } from "next"

import { AdminPage } from "@/components/admin/admin-page"
import { PayoutSummary } from "@/components/admin/keuangan/payout-summary"
import { TransactionHistory } from "@/components/admin/keuangan/transaction-history"
import { adminSection } from "@/lib/admin/config"
import { payoutTotals } from "@/lib/admin/finance"
import { MOCK_TRANSACTIONS } from "@/lib/admin/mock"

const SECTION = adminSection("finance")

export const metadata: Metadata = {
  title: SECTION.label,
  description: SECTION.description,
}

export default function AdminFinancePage() {
  return (
    <AdminPage title={SECTION.label} description={SECTION.description}>
      <PayoutSummary totals={payoutTotals(MOCK_TRANSACTIONS)} />
      <TransactionHistory transactions={MOCK_TRANSACTIONS} />
    </AdminPage>
  )
}
