import { DownloadSimpleIcon } from "@phosphor-icons/react/ssr"

import { AdminCard } from "@/components/admin/admin-card"
import { AdminPage } from "@/components/admin/admin-page"
import { BulkColumnTable } from "@/components/admin/produk/bulk-column-table"
import { BulkFileDrop } from "@/components/admin/produk/bulk-file-drop"
import { BulkStepToggle } from "@/components/admin/produk/bulk-step-toggle"
import { Button } from "@/components/ui/button"
import { BULK_STEPS, type BulkMode, type BulkStepKind } from "@/lib/admin/bulk"

function BulkStepCard({
  mode,
  step,
  children,
}: {
  mode: BulkMode
  step: BulkStepKind
  children: React.ReactNode
}) {
  return (
    <AdminCard>
      <div className="flex flex-col gap-(--card-spacing)">
        <BulkStepToggle mode={mode} step={step} />
        {children}
      </div>
    </AdminCard>
  )
}

function BulkStepCards({ mode, step }: { mode: BulkMode; step: BulkStepKind }) {
  switch (step) {
    case "download":
      return (
        <BulkStepCard mode={mode} step={step}>
          <Button size="lg" className="w-full sm:w-auto">
            {BULK_STEPS.download.label}
          </Button>
        </BulkStepCard>
      )
    case "upload":
      return (
        <>
          <BulkStepCard mode={mode} step={step}>
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {mode.stepNotes.upload}
              </p>
              <BulkFileDrop />
            </div>
          </BulkStepCard>

          <AdminCard contentClassName="px-0">
            <BulkColumnTable columns={mode.columns} />
          </AdminCard>
        </>
      )
    default: {
      const _exhaustive: never = step
      return _exhaustive
    }
  }
}

function BulkPage({ mode, step }: { mode: BulkMode; step: BulkStepKind }) {
  return (
    <AdminPage title={mode.label} description={mode.description}>
      <BulkStepCards mode={mode} step={step} />
    </AdminPage>
  )
}

export { BulkPage }
