import type { Metadata } from "next"

import { AdminPage } from "@/components/admin/admin-page"
import { TrackingLookupForm } from "@/components/admin/lacak-pengiriman/tracking-lookup-form"
import { adminSection } from "@/lib/admin/config"

const SECTION = adminSection("tracking")

export const metadata: Metadata = {
  title: SECTION.label,
  description: SECTION.description,
}

export default function AdminTrackingPage() {
  return (
    <AdminPage title={SECTION.label} description={SECTION.description}>
      <TrackingLookupForm />
    </AdminPage>
  )
}
