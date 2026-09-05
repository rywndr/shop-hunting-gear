import type { Metadata } from "next"

import { BulkPage } from "@/components/admin/products/bulk-page"
import { bulkMetadata, BULK_MODES, type BulkStepKind } from "@/lib/admin/bulk"

const MODE = BULK_MODES.update
const STEP = "download" satisfies BulkStepKind

export const metadata: Metadata = bulkMetadata({ mode: MODE, step: STEP })

export default function MassUpdateDownloadPage() {
  return <BulkPage mode={MODE} step={STEP} />
}
