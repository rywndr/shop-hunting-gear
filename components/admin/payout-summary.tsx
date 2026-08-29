import { AdminCard, AdminMetricGrid } from "@/components/admin/admin-card"
import { PAYOUT_STATES, type PayoutTotal } from "@/lib/admin/finance"
import { formatNumber, formatRupiah } from "@/utils/format/intl"

function PayoutSummary({ totals }: { totals: readonly PayoutTotal[] }) {
  return (
    <AdminCard
      title="Saldo Penghasilan"
      description="Penghasilan dari pesanan yang sudah dikirim."
      contentClassName="px-0"
    >
      <AdminMetricGrid
        metrics={totals.map(({ payout, amount, count }) => {
          const state = PAYOUT_STATES[payout]

          return {
            label: state.label,
            meta: (
              <span className="tabular-nums">
                {formatNumber(count)} transaksi
              </span>
            ),
            value: formatRupiah(amount),
            footnote: (
              <span className="mt-1 block text-xs text-muted-foreground">
                {state.note}
              </span>
            ),
          }
        })}
      />
    </AdminCard>
  )
}

export { PayoutSummary }
