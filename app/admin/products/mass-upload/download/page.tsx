import type { Metadata } from "next"

import { BulkPage } from "@/components/admin/products/bulk-page"
import { bulkMetadata, BULK_MODES, type BulkStepKind } from "@/lib/admin/bulk"

const MODE = BULK_MODES.upload
const STEP = "download" satisfies BulkStepKind

export const metadata: Metadata = bulkMetadata({ mode: MODE, step: STEP })

export default function MassUploadDownloadPage() {
  return <BulkPage mode={MODE} step={STEP} />
}
