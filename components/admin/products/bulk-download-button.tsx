import { DownloadSimpleIcon } from "@phosphor-icons/react/ssr"

import { Button } from "@/components/ui/button"
import { bulkTemplateHref, type BulkMode } from "@/lib/admin/bulk"

function BulkDownloadButton({ mode }: { mode: BulkMode }) {
  return (
    <Button
      size="lg"
      nativeButton={false}
      className="w-full sm:w-auto"
      render={<a href={bulkTemplateHref(mode)} download />}
    >
      <DownloadSimpleIcon aria-hidden />
      {mode.downloadLabel}
    </Button>
  )
}

export { BulkDownloadButton }
