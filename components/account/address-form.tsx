"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import {
  ComboboxField,
  TextareaField,
  TextField,
} from "@/components/form/fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { EMPTY_ADDRESS } from "@/lib/account/mock"
import { addressSchema, type AddressValues } from "@/lib/account/schema"
import type { Address } from "@/lib/account/types"
import {
  locationsResponseSchema,
  type LocationLevel,
  type ShippingLocation,
} from "@/lib/shipping/schema"

const PRIMARY_ID = "primary-address"

type AddressFormProps = {
  submitLabel: string
  defaultValues?: AddressValues | Address
  onCancel: () => void
  onSubmit: (values: AddressValues) => Promise<string | undefined>
}

type RegionOptions = Readonly<
  Record<LocationLevel, readonly ShippingLocation[]>
>

type RegionLoading = Readonly<Record<LocationLevel, boolean>>

function isWaitingForParent(
  level: LocationLevel,
  loading: RegionLoading
): boolean {
  switch (level) {
    case "province":
      return false
    case "city":
      return loading.province
    case "district":
      return loading.province || loading.city
    case "subdistrict":
      return loading.province || loading.city || loading.district
    default: {
      const _exhaustive: never = level
      return _exhaustive
    }
  }
}

function normalizedAddressValues(
  values: AddressValues | Address | undefined
): AddressValues {
  const address = values ?? EMPTY_ADDRESS

  return {
    ...address,
    provinceId: address.provinceId ?? 0,
    cityId: address.cityId ?? 0,
    districtId: address.districtId ?? 0,
    subdistrictId: address.subdistrictId ?? 0,
  }
}

function seededRegions(values: AddressValues): RegionOptions {
  function seed(id: number, name: string, zipCode: string | null = null) {
    return id > 0 ? [{ id, name, zipCode }] : []
  }

  return {
    province: seed(values.provinceId, values.province),
    city: seed(values.cityId, values.city),
    district: seed(values.districtId, values.district),
    subdistrict: seed(
      values.subdistrictId,
      values.subdistrict,
      values.postalCode || null
    ),
  }
}

function initialRegionLoading(values: AddressValues): RegionLoading {
  return {
    province: true,
    city: values.provinceId > 0,
    district: values.cityId > 0,
    subdistrict: values.districtId > 0,
  }
}

function AddressForm({
  submitLabel,
  defaultValues = EMPTY_ADDRESS,
  onCancel,
  onSubmit,
}: AddressFormProps) {
  const [serverError, setServerError] = useState<string>()
  const [initialValues] = useState(() => normalizedAddressValues(defaultValues))
  const [regions, setRegions] = useState<RegionOptions>(() =>
    seededRegions(initialValues)
  )
  const [regionError, setRegionError] = useState<string>()
  const [loadingLevels, setLoadingLevels] =
    useState<RegionLoading>(() => initialRegionLoading(initialValues))
  const regionRequest = useRef<Record<LocationLevel, number>>({
    province: 0,
    city: 0,
    district: 0,
    subdistrict: 0,
  })
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setValue,
  } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: initialValues,
  })

  const loadRegions = useCallback(
    async (level: LocationLevel, parentId?: number) => {
      const requestId = regionRequest.current[level] + 1
      regionRequest.current[level] = requestId
      setLoadingLevels((current) => ({ ...current, [level]: true }))
      const params = new URLSearchParams({ level })

      if (parentId !== undefined) {
        params.set("parentId", String(parentId))
      }

      try {
        const response = await fetch(`/api/shipping/locations?${params}`)

        if (!response.ok) {
          throw new Error("Location request failed.")
        }

        const result = locationsResponseSchema.safeParse(await response.json())

        if (!result.success) {
          throw new Error("Invalid location response.")
        }

        if (regionRequest.current[level] !== requestId) {
          return
        }

        setRegions((current) => ({
          ...current,
          [level]: result.data.locations,
        }))
        setRegionError(undefined)
      } catch {
        if (regionRequest.current[level] === requestId) {
          setRegionError("Wilayah tidak dapat dimuat. Coba lagi.")
        }
      } finally {
        if (regionRequest.current[level] === requestId) {
          setLoadingLevels((current) => ({ ...current, [level]: false }))
        }
      }
    },
    []
  )

  function invalidateRegions(levels: readonly LocationLevel[]) {
    levels.forEach((level) => {
      regionRequest.current[level] += 1
    })
    setLoadingLevels((current) => {
      const next = { ...current }
      levels.forEach((level) => {
        next[level] = false
      })
      return next
    })
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadRegions("province")

      if (initialValues.provinceId > 0) {
        void loadRegions("city", initialValues.provinceId)
      }
      if (initialValues.cityId > 0) {
        void loadRegions("district", initialValues.cityId)
      }
      if (initialValues.districtId > 0) {
        void loadRegions("subdistrict", initialValues.districtId)
      }
    })
  }, [initialValues, loadRegions])

  function selectOption(
    level: LocationLevel,
    value: string
  ): ShippingLocation | undefined {
    const id = Number(value)
    return regions[level].find((location) => location.id === id)
  }

  function selectProvince(value: string) {
    const selected = selectOption("province", value)
    invalidateRegions(["city", "district", "subdistrict"])
    setValue("provinceId", selected?.id ?? 0, { shouldValidate: true })
    setValue("province", selected?.name ?? "")
    setValue("cityId", 0)
    setValue("city", "")
    setValue("districtId", 0)
    setValue("district", "")
    setValue("subdistrictId", 0)
    setValue("subdistrict", "")
    setValue("postalCode", "")
    setRegions((current) => ({
      ...current,
      city: [],
      district: [],
      subdistrict: [],
    }))

    if (selected) void loadRegions("city", selected.id)
  }

  function selectCity(value: string) {
    const selected = selectOption("city", value)
    invalidateRegions(["district", "subdistrict"])
    setValue("cityId", selected?.id ?? 0, { shouldValidate: true })
    setValue("city", selected?.name ?? "")
    setValue("districtId", 0)
    setValue("district", "")
    setValue("subdistrictId", 0)
    setValue("subdistrict", "")
    setValue("postalCode", "")
    setRegions((current) => ({
      ...current,
      district: [],
      subdistrict: [],
    }))

    if (selected) void loadRegions("district", selected.id)
  }

  function selectDistrict(value: string) {
    const selected = selectOption("district", value)
    invalidateRegions(["subdistrict"])
    setValue("districtId", selected?.id ?? 0, { shouldValidate: true })
    setValue("district", selected?.name ?? "")
    setValue("subdistrictId", 0)
    setValue("subdistrict", "")
    setValue("postalCode", "")
    setRegions((current) => ({ ...current, subdistrict: [] }))

    if (selected) void loadRegions("subdistrict", selected.id)
  }

  function selectSubdistrict(value: string) {
    const selected = selectOption("subdistrict", value)
    setValue("subdistrictId", selected?.id ?? 0, { shouldValidate: true })
    setValue("subdistrict", selected?.name ?? "")

    if (selected?.zipCode) {
      setValue("postalCode", selected.zipCode, { shouldValidate: true })
    }
  }

  const regionOptions = (level: LocationLevel) =>
    regions[level].map((location) => ({
      value: String(location.id),
      label: location.name,
    }))

  const regionLoading = (level: LocationLevel) =>
    loadingLevels[level] || isWaitingForParent(level, loadingLevels)

  const submit = handleSubmit(async (values) => {
    setServerError(undefined)
    const error = await onSubmit(values)

    if (error) {
      setServerError(error)
      return
    }

    onCancel()
  })

  return (
    <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <FieldGroup className="flex-1 gap-4 overflow-y-auto px-6 py-5">
        <TextField
          id="address-label"
          label="Label Alamat"
          placeholder="Rumah, Kantor, Kos"
          error={errors.label?.message}
          {...register("label")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="address-recipient"
            label="Nama Penerima"
            autoComplete="name"
            placeholder="Nama lengkap penerima"
            error={errors.recipient?.message}
            {...register("recipient")}
          />

          <TextField
            id="address-phone"
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
          id="address-street"
          label="Alamat Lengkap"
          autoComplete="street-address"
          placeholder="Nama jalan, nomor rumah, RT/RW, patokan terdekat"
          description="Tulis sedetail mungkin agar kurir mudah menemukan lokasi."
          error={errors.street?.message}
          {...register("street")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="provinceId"
            render={({ field }) => (
              <ComboboxField
                id="address-province"
                label="Provinsi"
                placeholder={
                  regionLoading("province")
                    ? "Memuat provinsi..."
                    : "Pilih provinsi"
                }
                emptyText="Provinsi tidak ditemukan."
                options={regionOptions("province")}
                name={field.name}
                value={field.value > 0 ? String(field.value) : ""}
                onValueChange={selectProvince}
                onBlur={field.onBlur}
                inputRef={field.ref}
                error={errors.provinceId?.message}
                disabled={regionLoading("province")}
                loading={regionLoading("province")}
              />
            )}
          />

          <Controller
            control={control}
            name="cityId"
            render={({ field }) => (
              <ComboboxField
                id="address-city"
                label="Kota / Kabupaten"
                placeholder={
                  regionLoading("city")
                    ? "Memuat kota atau kabupaten..."
                    : "Pilih kota atau kabupaten"
                }
                emptyText="Kota atau kabupaten tidak ditemukan."
                options={regionOptions("city")}
                name={field.name}
                value={field.value > 0 ? String(field.value) : ""}
                onValueChange={selectCity}
                onBlur={field.onBlur}
                inputRef={field.ref}
                error={errors.cityId?.message}
                disabled={regions.city.length === 0 || regionLoading("city")}
                loading={regionLoading("city")}
              />
            )}
          />

          <Controller
            control={control}
            name="districtId"
            render={({ field }) => (
              <ComboboxField
                id="address-district"
                label="Kecamatan"
                placeholder={
                  regionLoading("district")
                    ? "Memuat kecamatan..."
                    : "Pilih kecamatan"
                }
                emptyText="Kecamatan tidak ditemukan."
                options={regionOptions("district")}
                name={field.name}
                value={field.value > 0 ? String(field.value) : ""}
                onValueChange={selectDistrict}
                onBlur={field.onBlur}
                inputRef={field.ref}
                error={errors.districtId?.message}
                disabled={
                  regions.district.length === 0 || regionLoading("district")
                }
                loading={regionLoading("district")}
              />
            )}
          />

          <Controller
            control={control}
            name="subdistrictId"
            render={({ field }) => (
              <ComboboxField
                id="address-subdistrict"
                label="Kelurahan / Desa"
                placeholder={
                  regionLoading("subdistrict")
                    ? "Memuat kelurahan atau desa..."
                    : "Pilih kelurahan atau desa"
                }
                emptyText="Kelurahan atau desa tidak ditemukan."
                options={regionOptions("subdistrict")}
                name={field.name}
                value={field.value > 0 ? String(field.value) : ""}
                onValueChange={selectSubdistrict}
                onBlur={field.onBlur}
                inputRef={field.ref}
                error={errors.subdistrictId?.message}
                disabled={
                  regions.subdistrict.length === 0 ||
                  regionLoading("subdistrict")
                }
                loading={regionLoading("subdistrict")}
              />
            )}
          />

          <TextField
            id="address-postal-code"
            label="Kode Pos"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            placeholder="55281"
            error={errors.postalCode?.message}
            {...register("postalCode")}
          />
        </div>

        <input type="hidden" {...register("province")} />
        <input type="hidden" {...register("city")} />
        <input type="hidden" {...register("district")} />
        <input type="hidden" {...register("subdistrict")} />

        {regionError && (
          <p role="alert" className="text-sm text-destructive">
            {regionError}
          </p>
        )}

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

        {serverError && (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        )}
      </FieldGroup>

      <div className="flex flex-wrap gap-3 border-t border-border px-6 py-4">
        <Button type="submit" disabled={isSubmitting} className="h-10">
          {isSubmitting ? "Menyimpan..." : submitLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isSubmitting}
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
