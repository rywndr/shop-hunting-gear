import { TABLE_EDGE } from "@/components/admin/admin-card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  bulkColumnRequirement,
  bulkColumns,
  type BulkColumnMode,
} from "@/lib/admin/product-bulk/columns"
import { cn } from "@/lib/utils"

function BulkColumnTable({ mode }: { mode: BulkColumnMode }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={TABLE_EDGE}>Kolom</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className={TABLE_EDGE}>Keterangan</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {bulkColumns(mode).map((column) => (
          <TableRow key={column.key} className="hover:bg-transparent">
            <TableCell className={cn(TABLE_EDGE, "font-medium")}>
              {column.label}
            </TableCell>
            <TableCell>
              <Badge variant={column.required ? "default" : "outline"}>
                {bulkColumnRequirement(column.required)}
              </Badge>
            </TableCell>
            <TableCell
              className={cn(TABLE_EDGE, "min-w-64 text-muted-foreground")}
            >
              {column.help}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export { BulkColumnTable }
