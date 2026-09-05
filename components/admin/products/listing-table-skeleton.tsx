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

function ListingTableSkeleton() {
  return (
    <AdminCard contentClassName="px-0">
      <div className="flex flex-col gap-4 px-(--card-spacing) pb-4">
        <Skeleton className="h-9 w-full sm:w-96" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={cn(TABLE_EDGE, "w-10")} />
            <TableHead className={TABLE_EDGE}>Produk</TableHead>
            <TableHead className={cn(TABLE_EDGE, "hidden lg:table-cell")}>
              Status
            </TableHead>
            <TableHead className={cn(TABLE_EDGE, "hidden md:table-cell")}>
              Harga
            </TableHead>
            <TableHead className={TABLE_EDGE}>Stok</TableHead>
            <TableHead className={TABLE_EDGE}>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((row) => (
            <TableRow key={row}>
              <TableCell className={TABLE_EDGE}>
                <Skeleton className="size-4" />
              </TableCell>
              <TableCell className={TABLE_EDGE}>
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 shrink-0" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              </TableCell>
              <TableCell className={cn(TABLE_EDGE, "hidden lg:table-cell")}>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className={cn(TABLE_EDGE, "hidden md:table-cell")}>
                <Skeleton className="ml-auto h-4 w-24" />
              </TableCell>
              <TableCell className={TABLE_EDGE}>
                <Skeleton className="ml-auto h-4 w-12" />
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

export { ListingTableSkeleton }
