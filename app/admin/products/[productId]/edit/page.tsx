import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AdminPage } from "@/components/admin/admin-page"
import { ProductEditForm } from "@/components/admin/produk/product-edit-form"
import { EDIT_PRODUCT_PAGE } from "@/lib/admin/product-form"
import { adminProductForEdit } from "@/lib/products/service"

export const metadata: Metadata = {
  title: EDIT_PRODUCT_PAGE.label,
  description: EDIT_PRODUCT_PAGE.description,
}

export default async function AdminEditProductPage(props: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await props.params
  const product = await adminProductForEdit(productId)
  if (!product) notFound()

  return (
    <AdminPage
      title={EDIT_PRODUCT_PAGE.label}
      description={`Perbarui informasi ${product.name}.`}
    >
      <ProductEditForm product={product} />
    </AdminPage>
  )
}
