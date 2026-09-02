import { AdminCard } from "@/components/admin/admin-card"
import {
  BULK_GUIDE_NOTES,
  bulkGuideSteps,
} from "@/lib/admin/product-bulk/guide"
import type { BulkColumnMode } from "@/lib/admin/product-bulk/columns"

function BulkGuideCard({ mode }: { mode: BulkColumnMode }) {
  return (
    <AdminCard title="Panduan Singkat">
      <div className="flex flex-col gap-3">
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
          {bulkGuideSteps(mode).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {BULK_GUIDE_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </AdminCard>
  )
}

export { BulkGuideCard }
