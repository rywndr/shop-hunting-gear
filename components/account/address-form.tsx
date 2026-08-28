"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { SelectField, TextareaField, TextField } from "@/components/form/fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { REGION_FIELDS } from "@/lib/account/config"
import { EMPTY_ADDRESS } from "@/lib/account/mock"
import { addressSchema, type AddressValues } from "@/lib/account/schema"

const PRIMARY_ID = "alamat-utama"

type AddressFormProps = {
  submitLabel: string
  defaultValues?: AddressValues
  onCancel: () => void
}

function AddressForm({
  submitLabel,
  defaultValues = EMPTY_ADDRESS,
  onCancel,
}: AddressFormProps) {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues,
  })

  return (
    <form
      noValidate
      onSubmit={handleSubmit(() => {})}
      className="flex min-h-0 flex-1 flex-col"
    >
      <FieldGroup className="flex-1 gap-4 overflow-y-auto px-6 py-5">
        <TextField
          id="alamat-label"
          label="Label Alamat"
          placeholder="Rumah, Kantor, Kos"
          error={errors.label?.message}
          {...register("label")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="alamat-penerima"
            label="Nama Penerima"
            autoComplete="name"
            placeholder="Nama lengkap penerima"
            error={errors.recipient?.message}
            {...register("recipient")}
          />

          <TextField
            id="alamat-telepon"
            label="Nomor HP"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="081234567890"
            error={errors.phone?.message}
            {...register("phone")}
          />
        </div>

        <TextareaField
          id="alamat-jalan"
          label="Alamat Lengkap"
          autoComplete="street-address"
          placeholder="Nama jalan, nomor rumah, RT/RW, patokan terdekat"
          description="Tulis sedetail mungkin agar kurir mudah menemukan lokasi."
          error={errors.street?.message}
          {...register("street")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {REGION_FIELDS.map((region) => (
            <Controller
              key={region.name}
              control={control}
              name={region.name}
              render={({ field }) => (
                <SelectField
                  id={`alamat-${region.name}`}
                  label={region.label}
                  placeholder={region.placeholder}
                  options={region.options}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  error={errors[region.name]?.message}
                />
              )}
            />
          ))}

          <TextField
            id="alamat-kode-pos"
            label="Kode Pos"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            placeholder="55281"
            error={errors.postalCode?.message}
            {...register("postalCode")}
          />
        </div>

        <Field orientation="horizontal" className="gap-2">
          <Controller
            control={control}
            name="isPrimary"
            render={({ field }) => (
              <Checkbox
                id={PRIMARY_ID}
                name={field.name}
                aria-labelledby={`${PRIMARY_ID}-label`}
                checked={field.value}
                onCheckedChange={field.onChange}
                inputRef={field.ref}
              />
            )}
          />
          <FieldLabel
            id={`${PRIMARY_ID}-label`}
            htmlFor={PRIMARY_ID}
            className="font-normal text-muted-foreground"
          >
            Jadikan alamat utama
          </FieldLabel>
        </Field>
      </FieldGroup>

      <div className="flex flex-wrap gap-3 border-t border-border px-6 py-4">
        <Button type="submit" className="h-10">
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="h-10"
        >
          Batal
        </Button>
      </div>
    </form>
  )
}

export { AddressForm }
