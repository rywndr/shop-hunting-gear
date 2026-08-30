"use client"

import { Controller } from "react-hook-form"

import {
  fieldError,
  type ManualOrderForm,
} from "@/components/admin/pesanan/manual-order-form"
import {
  NumberField,
  SelectField,
  TextareaField,
  TextField,
} from "@/components/form/fields"
import { COURIER_OPTIONS } from "@/lib/admin/manual-order"

function ManualOrderShippingStep({ form }: { form: ManualOrderForm }) {
  const {
    control,
    register,
    formState: { errors },
  } = form

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        id="manual-order-recipient"
        label="Nama penerima"
        autoComplete="name"
        {...register("recipient")}
        error={fieldError(errors.recipient)}
      />
      <TextField
        id="manual-order-phone"
        label="Nomor telepon"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="08xxxxxxxxxx"
        {...register("phone")}
        error={fieldError(errors.phone)}
      />
      <div className="sm:col-span-2">
        <TextareaField
          id="manual-order-address"
          label="Alamat lengkap"
          autoComplete="street-address"
          placeholder="Nama jalan, nomor, RT/RW, kelurahan, kecamatan, kota, provinsi, dan kode pos"
          {...register("address")}
          error={fieldError(errors.address)}
        />
      </div>
      <Controller
        control={control}
        name="courier"
        render={({ field }) => (
          <SelectField
            id="manual-order-courier"
            label="Kurir"
            placeholder="Pilih kurir"
            options={COURIER_OPTIONS}
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            inputRef={field.ref}
            error={fieldError(errors.courier)}
          />
        )}
      />
      <NumberField
        id="manual-order-shipping-cost"
        label="Ongkos kirim"
        prefix="Rp"
        min={0}
        step={1000}
        {...register("shippingCost")}
        error={fieldError(errors.shippingCost)}
        description="Isi 0 jika pengiriman gratis."
      />
      <div className="sm:col-span-2">
        <TextareaField
          id="manual-order-note"
          label="Catatan admin"
          {...register("note")}
        />
      </div>
    </div>
  )
}

export { ManualOrderShippingStep }
