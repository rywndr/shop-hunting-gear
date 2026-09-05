"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { ProductImageUploader } from "@/components/admin/products/product-image-uploader"
import { ProductVariantFields } from "@/components/admin/products/product-variant-fields"
import { AdminCard } from "@/components/admin/admin-card"
import {
  NumberField,
  SelectField,
  TextareaField,
  TextField,
} from "@/components/form/fields"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import {
  CATEGORY_OPTIONS,
  EMPTY_PRODUCT_FORM,
  MAX_PRODUCT_IMAGES,
  MAX_VARIANTS,
  MAX_STOCK,
  MAX_WEIGHT,
  isProductSaveMode,
  parseNumberInput,
  parseOptionalNumberInput,
  productFormSchema,
  PRODUCT_SAVE_MODES,
  PRODUCT_SAVE_MODE_ORDER,
  SAVE_MODE_FIELD,
  type ProductFormControl,
  type ProductFormInput,
  type ProductFormValues,
} from "@/lib/admin/product-form"
import { productDiscount } from "@/lib/products/config"
import { formatNumber, formatRupiah } from "@/utils/format/intl"
import { createProductAction } from "@/app/admin/products/new/actions"
import { productSubmissionFormData } from "@/lib/admin/product-submission"

function DiscountNote({ control }: { control: ProductFormControl }) {
  const price = useWatch({ control, name: "price" })
  const compareAtPrice = useWatch({ control, name: "compareAtPrice" })

  const discount =
    typeof price === "number" && typeof compareAtPrice === "number"
      ? productDiscount({ price, compareAtPrice })
      : null

  if (!discount) {
    return null
  }

  return (
    <p className="text-sm text-muted-foreground">
      Pembeli melihat potongan {formatNumber(discount.percent)}% dari{" "}
      {formatRupiah(discount.compareAtPrice)}.
    </p>
  )
}

function ProductForm() {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: EMPTY_PRODUCT_FORM,
  })
  const variants = useWatch({ control, name: "variants" })
  const hasVariants = variants.length > 0

  async function saveProduct(
    values: ProductFormValues,
    mode: (typeof PRODUCT_SAVE_MODE_ORDER)[number]
  ) {
    setPending(true)
    setSubmitError(null)

    try {
      const formData = productSubmissionFormData(values)
      formData.set(SAVE_MODE_FIELD, mode)
      const result = await createProductAction(formData)

      if (result.kind === "success") {
        router.push(result.href)
        router.refresh()
        return
      }

      if (result.kind === "error") {
        setSubmitError(result.message)
      }
    } catch {
      setSubmitError("Produk belum tersimpan. Periksa koneksi lalu coba lagi.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const submitter =
          event.nativeEvent instanceof SubmitEvent
            ? event.nativeEvent.submitter
            : null
        const mode =
          submitter instanceof HTMLButtonElement &&
          isProductSaveMode(submitter.value)
            ? submitter.value
            : "draft"

        void handleSubmit((values) => saveProduct(values, mode))(event)
      }}
      className="flex flex-col gap-5 md:gap-6"
    >
      <AdminCard
        title="Foto Produk"
        description={`Unggah 1 sampai ${MAX_PRODUCT_IMAGES} foto. Foto pertama dipakai sebagai thumbnail produk.`}
      >
        <ProductImageUploader
          control={control}
          error={errors.images?.message ?? errors.images?.root?.message}
        />
      </AdminCard>

      <AdminCard
        title="Informasi Produk"
        description="Nama, kategori, dan deskripsi yang dibaca pembeli."
      >
        <FieldGroup className="gap-4">
          <TextField
            id="product-name"
            label="Nama Produk"
            description="Sebutkan jenis barang, merek, dan keterangan singkat."
            error={errors.name?.message}
            {...register("name")}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <SelectField
                  id="product-category"
                  label="Kategori"
                  options={CATEGORY_OPTIONS}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  error={errors.category?.message}
                />
              )}
            />
          </div>

          <TextareaField
            id="product-description"
            label="Deskripsi Produk"
            description="Tulis detail yang sering ditanyakan pembeli agar tidak perlu chat."
            error={errors.description?.message}
            className="min-h-32"
            {...register("description")}
          />
        </FieldGroup>
      </AdminCard>

      <AdminCard
        title="Harga & Stok"
        description="Harga jual, harga sebelum diskon, dan jumlah stok siap kirim."
      >
        <FieldGroup className="gap-4">
          {!hasVariants && (
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                id="product-price"
                label="Harga Jual"
                prefix="Rp"
                error={errors.price?.message}
                {...register("price", { setValueAs: parseOptionalNumberInput })}
              />

              <div className="flex flex-col gap-2">
                <NumberField
                  id="product-original-price"
                  label="Harga Sebelum Diskon"
                  prefix="Rp"
                  description="Opsional. Isi untuk menampilkan harga coret dan label diskon."
                  error={errors.compareAtPrice?.message}
                  {...register("compareAtPrice", {
                    setValueAs: parseOptionalNumberInput,
                  })}
                />

                <DiscountNote control={control} />
              </div>
            </div>
          )}

          <NumberField
            id="product-stock"
            label="Stok"
            description={`Jumlah barang siap kirim, maksimal ${formatNumber(MAX_STOCK)}.`}
            error={errors.stock?.message}
            className="sm:max-w-56"
            {...register("stock", { setValueAs: parseNumberInput })}
          />

          <NumberField
            id="product-weight"
            label="Berat Produk"
            suffix="gram"
            description={`Berat pengiriman, maksimal ${formatNumber(MAX_WEIGHT)} gram.`}
            error={errors.weight?.message}
            className="sm:max-w-56"
            {...register("weight", { setValueAs: parseNumberInput })}
          />
        </FieldGroup>
      </AdminCard>

      <AdminCard
        title="Varian"
        description={`Opsional. Tambahkan sampai ${MAX_VARIANTS} kelompok varian, misalnya Ukuran dan Warna.`}
      >
        <ProductVariantFields
          control={control}
          register={register}
          errors={errors}
        />
      </AdminCard>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
        {submitError && (
          <p role="alert" className="self-center text-sm text-destructive">
            {submitError}
          </p>
        )}
        {PRODUCT_SAVE_MODE_ORDER.map((kind) => {
          const { label, variant } = PRODUCT_SAVE_MODES[kind]

          return (
            <Button
              key={kind}
              type="submit"
              name={SAVE_MODE_FIELD}
              value={kind}
              disabled={pending}
              variant={variant}
              size="lg"
              className="w-full sm:w-auto"
            >
              {pending ? "Menyimpan..." : label}
            </Button>
          )
        })}
      </div>
    </form>
  )
}

export { ProductForm }
