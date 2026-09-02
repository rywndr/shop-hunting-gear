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
import {
  manualOrderRequiresAddress,
  MANUAL_ORDER_DELIVERY_OPTIONS,
} from "@/lib/admin/manual-order"

function ManualOrderShippingStep({ form }: { form: ManualOrderForm }) {
  const {
    control,
    clearErrors,
    register,
    setValue,
    watch,
    formState: { errors },
  } = form
  const deliveryMethod = watch("deliveryMethod")
  const requiresAddress = manualOrderRequiresAddress(deliveryMethod)

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
      <Controller
        control={control}
        name="deliveryMethod"
        render={({ field }) => (
          <SelectField
            id="manual-order-delivery-method"
            label="Metode pengiriman"
            placeholder="Pilih metode pengiriman"
            options={MANUAL_ORDER_DELIVERY_OPTIONS}
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value)

              if (!manualOrderRequiresAddress(value)) {
                setValue("shippingCost", 0, { shouldDirty: true })
                clearErrors(["shippingCost", "address"])
              }
            }}
            onBlur={field.onBlur}
            name={field.name}
            inputRef={field.ref}
            error={fieldError(errors.deliveryMethod)}
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
        disabled={!requiresAddress}
        error={fieldError(errors.shippingCost)}
        description={
          requiresAddress
            ? "Isi 0 jika pengiriman gratis."
            : "Pengambilan di toko tidak dikenai ongkos kirim."
        }
      />
      {requiresAddress ? (
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
      ) : (
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Pelanggan mengambil barang langsung di toko, jadi alamat pengiriman
          tidak diperlukan.
        </p>
      )}
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
