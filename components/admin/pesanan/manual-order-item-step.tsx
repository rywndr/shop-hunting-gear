"use client"

import { Controller } from "react-hook-form"

import {
  fieldError,
  type ManualOrderForm,
} from "@/components/admin/pesanan/manual-order-form"
import {
  ComboboxField,
  NumberField,
  SelectField,
} from "@/components/form/fields"
import {
  manualOrderCustomerLabel,
  manualOrderVariantOptions,
  type ManualOrderCustomer,
  type ManualOrderProduct,
} from "@/lib/admin/manual-order"

type ManualOrderItemStepProps = {
  customers: readonly ManualOrderCustomer[]
  products: readonly ManualOrderProduct[]
  form: ManualOrderForm
  product: ManualOrderProduct | undefined
}

function ManualOrderItemStep({
  customers,
  products,
  form,
  product,
}: ManualOrderItemStepProps) {
  const {
    control,
    clearErrors,
    register,
    setValue,
    formState: { errors },
  } = form
  const variants = manualOrderVariantOptions(product)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Controller
        control={control}
        name="customerId"
        render={({ field }) => (
          <ComboboxField
            id="manual-order-customer"
            label="Pelanggan"
            placeholder="Cari pelanggan"
            emptyText="Pelanggan tidak ditemukan."
            options={customers.map((customer) => ({
              value: customer.id,
              label: manualOrderCustomerLabel(customer),
            }))}
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            inputRef={field.ref}
            error={fieldError(errors.customerId)}
          />
        )}
      />
      <Controller
        control={control}
        name="productSlug"
        render={({ field }) => (
          <ComboboxField
            id="manual-order-product"
            label="Produk"
            placeholder="Cari produk"
            emptyText="Produk tidak ditemukan."
            options={products.map(({ slug, name, stock }) => ({
              value: slug,
              label: `${name} (${stock} tersedia)`,
            }))}
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value)
              setValue("variant", "", { shouldDirty: true })
              clearErrors("variant")
            }}
            onBlur={field.onBlur}
            name={field.name}
            inputRef={field.ref}
            error={fieldError(errors.productSlug)}
          />
        )}
      />
      <Controller
        control={control}
        name="variant"
        render={({ field }) => (
          <SelectField
            id="manual-order-variant"
            label="Varian"
            placeholder={product ? "Pilih varian" : "Pilih produk dahulu"}
            options={variants}
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            inputRef={field.ref}
            disabled={!product}
            error={fieldError(errors.variant)}
          />
        )}
      />
      <NumberField
        id="manual-order-quantity"
        label="Jumlah"
        min={1}
        max={product?.stock}
        {...register("quantity")}
        error={fieldError(errors.quantity)}
        description={product ? `Stok tersedia: ${product.stock}` : undefined}
      />
    </div>
  )
}

export { ManualOrderItemStep }
