import { AdminCard } from "@/components/admin/admin-card"
import { formatRupiah } from "@/utils/format/intl"

function FundsSummary({ amount }: { amount: number }) {
  return (
    <AdminCard
      title="Dana"
      description="Penghasilan dari pesanan yang sudah dibayar pembeli."
    >
      <p className="font-heading text-2xl font-bold break-words tabular-nums sm:text-3xl">
        {formatRupiah(amount)}
      </p>
    </AdminCard>
  )
}

export { FundsSummary }
