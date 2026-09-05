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

function SalesOrderTableSkeleton() {
  return (
    <AdminCard contentClassName="px-0">
      <div className="flex flex-col gap-4 px-(--card-spacing) pb-4">
        <Skeleton className="h-9 w-full sm:w-96" />
        <Skeleton className="h-9 w-full sm:w-72" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={TABLE_EDGE}>Pesanan</TableHead>
            <TableHead className={cn(TABLE_EDGE, "hidden lg:table-cell")}>
              Pembeli
            </TableHead>
            <TableHead className={cn(TABLE_EDGE, "hidden lg:table-cell")}>
              Status
            </TableHead>
            <TableHead className={cn(TABLE_EDGE, "hidden lg:table-cell")}>
              Jasa Kirim
            </TableHead>
            <TableHead className={cn(TABLE_EDGE, "text-right")}>
              Total
            </TableHead>
            <TableHead className={cn(TABLE_EDGE, "text-right")}>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((row) => (
            <TableRow key={row}>
              <TableCell className={TABLE_EDGE}>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell className={cn(TABLE_EDGE, "hidden lg:table-cell")}>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell className={cn(TABLE_EDGE, "hidden lg:table-cell")}>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className={cn(TABLE_EDGE, "hidden lg:table-cell")}>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className={TABLE_EDGE}>
                <Skeleton className="ml-auto h-4 w-24" />
              </TableCell>
              <TableCell className={TABLE_EDGE}>
                <Skeleton className="ml-auto size-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminCard>
  )
}

export { SalesOrderTableSkeleton }
