import type { Metadata } from "next"

import { AdminPage } from "@/components/admin/admin-page"
import { adminSection } from "@/lib/admin/config"

const SECTION = adminSection("products")

export const metadata: Metadata = {
  title: SECTION.label,
  description: SECTION.description,
}

export default function AdminProductsPage() {
  return (
    <AdminPage title={SECTION.label} description={SECTION.description}>
      <p className="text-sm text-muted-foreground">
        {SECTION.label} placeholder
      </p>
    </AdminPage>
  )
}
