import { redirect } from "next/navigation"

import { bulkHref, BULK_MODES, DEFAULT_BULK_STEP } from "@/lib/admin/bulk"

const MODE = BULK_MODES.update

export default function MassUpdateRootPage() {
  redirect(bulkHref({ mode: MODE, step: DEFAULT_BULK_STEP }))
}
