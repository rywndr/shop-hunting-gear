"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form"
import { PlusIcon, TrashIcon } from "@phosphor-icons/react"

import { editProductAction } from "@/app/admin/produk/actions"
import { AdminCard } from "@/components/admin/admin-card"
import { ProductImageUploader } from "@/components/admin/produk/product-image-uploader"
import {
  NumberField,
  SelectField,
  TextareaField,
  TextField,
} from "@/components/form/fields"
import { Button } from "@/components/ui/button"
import { FieldError, FieldGroup } from "@/components/ui/field"
import {
  CATEGORY_OPTIONS,
  EMPTY_VARIANT,
  EMPTY_VARIANT_OPTION,
  parseNumberInput,
  parseOptionalNumberInput,
  productEditFormSchema,
  type ProductEditFormInput,
  type ProductEditFormValues,
} from "@/lib/admin/product-form"
import { productSubmissionFormData } from "@/lib/admin/product-submission"
import type { EditableProduct } from "@/lib/products/service"

function ProductEditForm({ product }: { product: EditableProduct }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductEditFormInput, unknown, ProductEditFormValues>({
    resolver: zodResolver(productEditFormSchema),
    defaultValues: {
      images: product.images.map((image, index) => ({
        kind: "existing",
        id: image.id,
        name: image.alt,
        previewUrl: product.imageUrls[index],
      })),
      name: product.name,
      category: product.category,
      description: product.description.join("\n\n"),
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      stock: product.stock,
      weight: product.weight,
      variants: product.variants.map((variant) => ({
        label: variant.label,
        options: variant.options.map((option) => {
          const imageIndex = product.images.findIndex(
            ({ id }) => id === option.imageId
          )
          return {
            ...option,
            image:
              imageIndex >= 0 && option.imageId
                ? {
                    kind: "existing" as const,
                    id: option.imageId,
                    name: option.value,
                    previewUrl: product.imageUrls[imageIndex],
                  }
                : null,
          }
        }),
      })),
    },
  })
  const variants = useFieldArray({ control, name: "variants" })

  function save(values: ProductEditFormValues) {
    setSubmitError(null)
    startTransition(async () => {
      const result = await editProductAction({
        productId: product.id,
        formData: productSubmissionFormData(values),
      })
      if (result.kind === "error") setSubmitError(result.message)
      else {
        router.push("/admin/produk?tab=all")
        router.refresh()
      }
    })
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(save)}
      className="flex flex-col gap-5 md:gap-6"
    >
      <AdminCard
        title="Foto Produk"
        description="Tambah, hapus, atau geser foto untuk mengubah urutannya."
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
            id="produk-nama"
            label="Nama Produk"
            error={errors.name?.message}
            {...register("name")}
          />
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <SelectField
                id="produk-kategori"
                label="Kategori"
                options={CATEGORY_OPTIONS}
                value={field.value}
                onValueChange={field.onChange}
                error={errors.category?.message}
              />
            )}
          />
          <TextareaField
            id="produk-deskripsi"
            label="Deskripsi Produk"
            className="min-h-32"
            error={errors.description?.message}
            {...register("description")}
          />
        </FieldGroup>
      </AdminCard>

      <AdminCard
        title="Harga & Stok"
        description="Harga jual, harga sebelum diskon, stok, dan berat pengiriman."
      >
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="produk-harga"
            label="Harga Jual"
            prefix="Rp"
            error={errors.price?.message}
            {...register("price", { setValueAs: parseOptionalNumberInput })}
          />
          <NumberField
            id="produk-harga-coret"
            label="Harga Sebelum Diskon"
            prefix="Rp"
            error={errors.compareAtPrice?.message}
            {...register("compareAtPrice", {
              setValueAs: parseOptionalNumberInput,
            })}
          />
          <NumberField
            id="produk-stok"
            label="Stok"
            error={errors.stock?.message}
            {...register("stock", { setValueAs: parseNumberInput })}
          />
          <NumberField
            id="produk-berat"
            label="Berat Produk"
            suffix="gram"
            error={errors.weight?.message}
            {...register("weight", { setValueAs: parseNumberInput })}
          />
        </FieldGroup>
      </AdminCard>

      <AdminCard
        title="Varian"
        description="Nama varian, pilihan, harga, dan berat tiap pilihan."
      >
        <div className="flex flex-col gap-4">
          {variants.fields.map((variant, variantIndex) => (
            <VariantEditor
              key={variant.id}
              control={control}
              register={register}
              errors={errors}
              variantIndex={variantIndex}
              onRemove={() => variants.remove(variantIndex)}
            />
          ))}
          {variants.fields.length < 2 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => variants.append(EMPTY_VARIANT)}
              className="self-start"
            >
              <PlusIcon />
              Tambah Varian
            </Button>
          )}
          <FieldError>
            {errors.variants?.message ?? errors.variants?.root?.message}
          </FieldError>
        </div>
      </AdminCard>

      <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
        {submitError && (
          <p role="alert" className="self-center text-sm text-destructive">
            {submitError}
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => router.back()}
        >
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>
    </form>
  )
}

type FormApi = {
  control: Control<ProductEditFormInput, unknown, ProductEditFormValues>
  register: UseFormRegister<ProductEditFormInput>
  errors: FieldErrors<ProductEditFormInput>
}

function VariantEditor({
  control,
  register,
  errors,
  variantIndex,
  onRemove,
}: FormApi & { variantIndex: number; onRemove: () => void }) {
  const options = useFieldArray({
    control,
    name: `variants.${variantIndex}.options`,
  })
  return (
    <section
      className="space-y-4 border p-3 sm:p-4"
      aria-label={`Varian ${variantIndex + 1}`}
    >
      <div className="flex items-start gap-2">
        <TextField
          id={`varian-${variantIndex}`}
          label={`Varian ${variantIndex + 1}`}
          className="flex-1"
          error={errors.variants?.[variantIndex]?.label?.message}
          {...register(`variants.${variantIndex}.label`)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="mt-7"
          aria-label={`Hapus varian ${variantIndex + 1}`}
          onClick={onRemove}
        >
          <TrashIcon />
        </Button>
      </div>
      <div className="space-y-3">
        {options.fields.map((option, optionIndex) => (
          <div
            key={option.id}
            className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-start"
          >
            <TextField
              id={`varian-${variantIndex}-${optionIndex}-nama`}
              label="Pilihan"
              error={
                errors.variants?.[variantIndex]?.options?.[optionIndex]?.value
                  ?.message
              }
              {...register(
                `variants.${variantIndex}.options.${optionIndex}.value`
              )}
            />
            <NumberField
              id={`varian-${variantIndex}-${optionIndex}-harga`}
              label="Harga"
              prefix="Rp"
              error={
                errors.variants?.[variantIndex]?.options?.[optionIndex]?.price
                  ?.message
              }
              {...register(
                `variants.${variantIndex}.options.${optionIndex}.price`,
                { setValueAs: parseOptionalNumberInput }
              )}
            />
            <NumberField
              id={`varian-${variantIndex}-${optionIndex}-berat`}
              label="Berat"
              suffix="gram"
              error={
                errors.variants?.[variantIndex]?.options?.[optionIndex]?.weight
                  ?.message
              }
              {...register(
                `variants.${variantIndex}.options.${optionIndex}.weight`,
                { setValueAs: parseOptionalNumberInput }
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="sm:mt-7"
              disabled={options.fields.length === 1}
              aria-label={`Hapus pilihan ${optionIndex + 1}`}
              onClick={() => options.remove(optionIndex)}
            >
              <TrashIcon />
            </Button>
          </div>
        ))}
      </div>
      {options.fields.length < 12 && (
        <Button
          type="button"
          variant="outline"
          onClick={() => options.append(EMPTY_VARIANT_OPTION)}
        >
          <PlusIcon />
          Tambah Pilihan
        </Button>
      )}
    </section>
  )
}

export { ProductEditForm }
