import type { Metadata } from "next"

import { AdminPage } from "@/components/admin/admin-page"
import { ProductForm } from "@/components/admin/products/product-form"
import { NEW_PRODUCT_PAGE } from "@/lib/admin/product-form"

export const metadata: Metadata = {
  title: NEW_PRODUCT_PAGE.label,
  description: NEW_PRODUCT_PAGE.description,
}

export default function AdminNewProductPage() {
  return (
    <AdminPage
      title={NEW_PRODUCT_PAGE.label}
      description={NEW_PRODUCT_PAGE.description}
    >
      <ProductForm />
    </AdminPage>
  )
}
