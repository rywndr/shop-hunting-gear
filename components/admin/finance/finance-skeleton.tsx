import { AdminCard, TABLE_EDGE } from "@/components/admin/admin-card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const ROWS = Array.from({ length: 8 }, (_, index) => index)

function FinanceSkeleton() {
  return (
    <>
      <AdminCard
        title="Dana"
        description="Penghasilan dari pesanan yang sudah dibayar pembeli."
      >
        <Skeleton className="h-9 w-48" />
      </AdminCard>
      <AdminCard
        title="Riwayat Transaksi"
        description="Penghasilan per transaksi. Buka baris untuk melihat rinciannya."
        contentClassName="px-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={TABLE_EDGE}>Pesanan</TableHead>
              <TableHead className={cn(TABLE_EDGE, "hidden md:table-cell")}>
                Status
              </TableHead>
              <TableHead className={cn(TABLE_EDGE, "hidden md:table-cell")}>
                Metode
              </TableHead>
              <TableHead className={cn(TABLE_EDGE, "text-right")}>
                Penghasilan
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((row) => (
              <TableRow key={row}>
                <TableCell className={TABLE_EDGE}>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell className={cn(TABLE_EDGE, "hidden md:table-cell")}>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className={cn(TABLE_EDGE, "hidden md:table-cell")}>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className={TABLE_EDGE}>
                  <Skeleton className="ml-auto h-4 w-28" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminCard>
    </>
  )
}

export { FinanceSkeleton }
