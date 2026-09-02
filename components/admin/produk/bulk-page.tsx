import { AdminCard } from "@/components/admin/admin-card"
import { AdminPage } from "@/components/admin/admin-page"
import { BulkColumnTable } from "@/components/admin/produk/bulk-column-table"
import { BulkDownloadButton } from "@/components/admin/produk/bulk-download-button"
import { BulkFileDrop } from "@/components/admin/produk/bulk-file-drop"
import { BulkGuideCard } from "@/components/admin/produk/bulk-guide-card"
import { BulkStepToggle } from "@/components/admin/produk/bulk-step-toggle"
import type { BulkMode, BulkStepKind } from "@/lib/admin/bulk"

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
        <>
          <BulkStepCard mode={mode} step={step}>
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {mode.stepNotes.download}
              </p>
              <BulkDownloadButton mode={mode} />
            </div>
          </BulkStepCard>

          <BulkGuideCard mode={mode.kind} />

          <AdminCard title="Kolom File" contentClassName="px-0">
            <BulkColumnTable mode={mode.kind} />
          </AdminCard>
        </>
      )
    case "upload":
      return (
        <>
          <BulkStepCard mode={mode} step={step}>
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {mode.stepNotes.upload}
              </p>
              <BulkFileDrop mode={mode} />
            </div>
          </BulkStepCard>

          <BulkGuideCard mode={mode.kind} />

          <AdminCard title="Kolom File" contentClassName="px-0">
            <BulkColumnTable mode={mode.kind} />
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
