import { Suspense } from "react"
import type { Metadata } from "next"

import { AdminPage } from "@/components/admin/admin-page"
import { FinanceSkeleton } from "@/components/admin/keuangan/finance-skeleton"
import { FundsSummary } from "@/components/admin/keuangan/funds-summary"
import { TransactionHistory } from "@/components/admin/keuangan/transaction-history"
import { adminSection } from "@/lib/admin/config"
import { financeSummary, paidTransactionPage } from "@/lib/orders/service"

const SECTION = adminSection("finance")
type AdminPageSize = 10 | 25 | 50

export const metadata: Metadata = {
  title: SECTION.label,
  description: SECTION.description,
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function isPageSize(value: number): value is AdminPageSize {
  return value === 10 || value === 25 || value === 50
}

async function FinanceContent({
  page,
  pageSize,
}: {
  readonly page: number
  readonly pageSize: AdminPageSize
}) {
  const [summary, transactionPage] = await Promise.all([
    financeSummary(),
    paidTransactionPage({ page, pageSize }),
  ])

  return (
    <>
      <FundsSummary amount={summary} />
      <TransactionHistory
        transactions={transactionPage.transactions}
        total={transactionPage.total}
        page={page}
        pageSize={pageSize}
      />
    </>
  )
}

export default async function AdminFinancePage(
  props: PageProps<"/admin/keuangan">
) {
  const params = await props.searchParams
  const page = positiveInteger(
    typeof params.page === "string" ? params.page : undefined,
    1
  )
  const requestedSize = positiveInteger(
    typeof params.size === "string" ? params.size : undefined,
    10
  )
  const pageSize = isPageSize(requestedSize) ? requestedSize : 10

  return (
    <AdminPage title={SECTION.label} description={SECTION.description}>
      <Suspense fallback={<FinanceSkeleton />}>
        <FinanceContent page={page} pageSize={pageSize} />
      </Suspense>
    </AdminPage>
  )
}
