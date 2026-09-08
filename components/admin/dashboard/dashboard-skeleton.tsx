import { AdminCard } from "@/components/admin/admin-card"
import { LowStockListSkeleton } from "@/components/admin/dashboard/low-stock-list"
import { Skeleton } from "@/components/ui/skeleton"

const SUMMARY_ITEMS = [0, 1]
const ORDER_ROWS = [0, 1, 2, 3, 4]

function DashboardSkeleton({
  lowStockThreshold,
}: {
  lowStockThreshold: number
}) {
  return (
    <div role="status" aria-label="Memuat data dashboard" className="contents">
      <AdminCard title="Ringkasan Penjualan" contentClassName="px-0">
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {SUMMARY_ITEMS.map((item) => (
            <div
              key={item}
              className="space-y-3 px-(--card-spacing) py-3 first:pt-0 last:pb-0 sm:py-0"
            >
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-40 max-w-full" />
              <Skeleton className="h-3 w-36 max-w-full" />
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminCard
        title="Penjualan Harian"
        description="Nilai penjualan per hari."
      >
        <Skeleton className="h-64 w-full" />
      </AdminCard>

      <AdminCard
        title="Pesanan Terbaru"
        description="Pesanan yang paling baru masuk."
      >
        <div className="space-y-4">
          {ORDER_ROWS.map((row) => (
            <Skeleton key={row} className="h-5 w-full" />
          ))}
        </div>
      </AdminCard>

      <LowStockListSkeleton threshold={lowStockThreshold} />
    </div>
  )
}

export { DashboardSkeleton }
