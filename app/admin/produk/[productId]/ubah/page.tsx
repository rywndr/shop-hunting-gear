import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AdminPage } from "@/components/admin/admin-page"
import { ProductEditForm } from "@/components/admin/produk/product-edit-form"
import { adminProductForEdit } from "@/lib/products/service"

export const metadata: Metadata = { title: "Ubah Produk" }

export default async function AdminEditProductPage(props: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await props.params
  const product = await adminProductForEdit(productId)
  if (!product) notFound()

  return (
    <AdminPage
      title="Ubah Produk"
      description={`Perbarui informasi ${product.name}.`}
    >
      <ProductEditForm product={product} />
    </AdminPage>
  )
}
