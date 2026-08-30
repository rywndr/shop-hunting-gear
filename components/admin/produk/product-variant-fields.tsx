"use client"

import { useEffect, useId, useRef } from "react"
import Image from "next/image"
import { ImagesIcon, PlusIcon, TrashIcon, XIcon } from "@phosphor-icons/react"
import { useController, useFieldArray } from "react-hook-form"

import { CONTROL, TextField } from "@/components/form/fields"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  EMPTY_VARIANT,
  EMPTY_VARIANT_OPTION,
  IMAGE_ACCEPT,
  MAX_VARIANTS,
  MAX_VARIANT_OPTIONS,
  parseOptionalNumberInput,
  type ProductFormControl,
  type ProductFormErrors,
  type ProductFormRegister,
} from "@/lib/admin/product-form"

type ProductVariantFieldsProps = {
  control: ProductFormControl
  register: ProductFormRegister
  errors: ProductFormErrors
}

function VariantOptionImage({
  control,
  optionIndex,
  variantIndex,
}: Pick<ProductVariantFieldsProps, "control"> & {
  optionIndex: number
  variantIndex: number
}) {
  const { field } = useController({
    control,
    name: `variants.${variantIndex}.options.${optionIndex}.image`,
  })
  const createdPreview = useRef<string | null>(null)

  useEffect(
    () => () => {
      if (createdPreview.current) {
        URL.revokeObjectURL(createdPreview.current)
      }
    },
    []
  )

  function chooseImage(file: File | undefined) {
    if (createdPreview.current) {
      URL.revokeObjectURL(createdPreview.current)
    }

    if (!file) {
      createdPreview.current = null
      field.onChange(null)
      return
    }

    const previewUrl = URL.createObjectURL(file)
    createdPreview.current = previewUrl
    field.onChange({ name: file.name, previewUrl })
  }

  return (
    <div className="relative size-20 shrink-0 border border-dashed border-input bg-muted">
      {field.value ? (
        <>
          <Image
            src={field.value.previewUrl}
            alt={field.value.name}
            fill
            unoptimized
            sizes="5rem"
            className="object-cover"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Hapus foto ${field.value.name}`}
            onClick={() => chooseImage(undefined)}
            className="absolute top-1 right-1 bg-navbar/80 text-navbar-foreground hover:bg-navbar hover:text-navbar-foreground"
          >
            <XIcon />
          </Button>
        </>
      ) : (
        <label className="flex size-full cursor-pointer flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground hover:bg-muted/50 has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/30">
          <ImagesIcon className="size-5" aria-hidden />
          Foto
          <input
            type="file"
            accept={IMAGE_ACCEPT}
            aria-label="Tambah foto pilihan varian"
            onChange={(event) => {
              chooseImage(event.target.files?.[0])
              event.target.value = ""
            }}
            className="sr-only"
          />
        </label>
      )}
    </div>
  )
}

function VariantOptionFields({
  control,
  register,
  errors,
  variantIndex,
}: ProductVariantFieldsProps & { variantIndex: number }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `variants.${variantIndex}.options`,
  })
  const labelId = useId()
  const position = variantIndex + 1
  const optionErrors = errors.variants?.[variantIndex]?.options
  const listError = optionErrors?.message ?? optionErrors?.root?.message

  return (
    <Field aria-labelledby={labelId}>
      <FieldTitle id={labelId}>Pilihan Varian</FieldTitle>

      <div className="flex flex-col gap-2">
        {fields.map((field, index) => {
          const errorsForOption = optionErrors?.[index]
          const valueError = errorsForOption?.value?.message

          return (
            <div key={field.id} className="flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <VariantOptionImage
                  control={control}
                  variantIndex={variantIndex}
                  optionIndex={index}
                />

                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
                  <div>
                    <Input
                      aria-label={`Pilihan ${index + 1} untuk varian ${position}`}
                      aria-invalid={Boolean(valueError) || undefined}
                      className={CONTROL}
                      {...register(
                        `variants.${variantIndex}.options.${index}.value`
                      )}
                    />
                    <FieldError>{valueError}</FieldError>
                  </div>

                  <TextField
                    id={`varian-${variantIndex}-pilihan-${index}-harga`}
                    label="Harga"
                    type="number"
                    inputMode="numeric"
                    error={errorsForOption?.price?.message}
                    {...register(
                      `variants.${variantIndex}.options.${index}.price`,
                      { setValueAs: parseOptionalNumberInput }
                    )}
                  />

                  <TextField
                    id={`varian-${variantIndex}-pilihan-${index}-berat`}
                    label="Berat (gram)"
                    type="number"
                    inputMode="numeric"
                    description="Opsional"
                    error={errorsForOption?.weight?.message}
                    {...register(
                      `variants.${variantIndex}.options.${index}.weight`,
                      { setValueAs: parseOptionalNumberInput }
                    )}
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  disabled={fields.length === 1}
                  aria-label={`Hapus pilihan ${index + 1} varian ${position}`}
                  onClick={() => remove(index)}
                  className="shrink-0 text-muted-foreground"
                >
                  <XIcon />
                </Button>
              </div>

            </div>
          )
        })}
      </div>

      <FieldError>{listError}</FieldError>

      {fields.length < MAX_VARIANT_OPTIONS && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => append(EMPTY_VARIANT_OPTION)}
          className="w-full sm:w-auto sm:self-start"
        >
          <PlusIcon data-icon="inline-start" />
          Tambah Pilihan
        </Button>
      )}
    </Field>
  )
}

function ProductVariantFields({
  control,
  register,
  errors,
}: ProductVariantFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  })

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field, index) => {
        const position = index + 1

        return (
          <div
            key={field.id}
            className="flex flex-col gap-4 border border-border p-3 sm:p-4"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 sm:max-w-md">
                <TextField
                  id={`produk-varian-${position}`}
                  label={`Varian ${position}`}
                  description="Nama kelompok pilihan, misalnya Ukuran atau Warna."
                  error={errors.variants?.[index]?.label?.message}
                  {...register(`variants.${index}.label`)}
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label={`Hapus varian ${position}`}
                onClick={() => remove(index)}
                className="mt-7 shrink-0 text-muted-foreground"
              >
                <TrashIcon />
              </Button>
            </div>

            <VariantOptionFields
              control={control}
              register={register}
              errors={errors}
              variantIndex={index}
            />
          </div>
        )
      })}

      {fields.length < MAX_VARIANTS && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => append(EMPTY_VARIANT)}
          className="w-full sm:w-auto sm:self-start"
        >
          <PlusIcon data-icon="inline-start" />
          Tambah Varian
        </Button>
      )}

      <FieldError>
        {errors.variants?.message ?? errors.variants?.root?.message}
      </FieldError>
    </div>
  )
}

export { ProductVariantFields }
