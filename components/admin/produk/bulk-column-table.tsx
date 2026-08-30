import { TABLE_EDGE } from "@/components/admin/admin-card"
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
  BULK_COLUMNS,
  type BulkColumn,
  type BulkColumnKey,
} from "@/lib/admin/bulk"
import { cn } from "@/lib/utils"

const EMPTY_CELL = "-"

function columnClass(key: BulkColumnKey) {
  return cn(TABLE_EDGE, BULK_COLUMNS[key].align === "end" && "text-right")
}

function BulkColumnTable({ columns }: { columns: readonly BulkColumn[] }) {
  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(({ key, required }) => (
              <TableHead
                key={key}
                className={cn(columnClass(key), "h-auto py-2 align-bottom")}
              >
                <span className="block">{BULK_COLUMNS[key].label}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {bulkColumnRequirement(required)}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow className="hover:bg-transparent">
            {columns.map(({ key }) => (
              <TableCell
                key={key}
                className={cn(columnClass(key), "text-muted-foreground")}
              >
                {EMPTY_CELL}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>

      <p className="px-(--card-spacing) text-xs text-muted-foreground">
        Belum ada file. Isi template sesuai kolom di atas, lalu unggah untuk
        melihat pratinjau barisnya di sini.
      </p>
    </div>
  )
}

export { BulkColumnTable }
