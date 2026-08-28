/**
 * Validation for account pages.
 */

import { z } from "zod"

import { MIN_PASSWORD_LENGTH } from "@/lib/auth/schema"

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter."),
})

export type ProfileValues = z.infer<typeof profileSchema>

export const addressSchema = z.object({
  label: z.string().trim().min(2, "Label alamat minimal 2 karakter."),
  recipient: z.string().trim().min(2, "Nama penerima minimal 2 karakter."),
  phone: z
    .string()
    .trim()
    .regex(
      /^(\+62|62|0)8\d{7,11}$/,
      "Nomor HP tidak valid. Contoh: 081234567890."
    ),
  street: z.string().trim().min(10, "Alamat lengkap minimal 10 karakter."),
  province: z.string().min(1, "Provinsi wajib dipilih."),
  city: z.string().min(1, "Kota atau kabupaten wajib dipilih."),
  district: z.string().min(1, "Kecamatan wajib dipilih."),
  subdistrict: z.string().min(1, "Kelurahan atau desa wajib dipilih."),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Kode pos harus 5 angka."),
  isPrimary: z.boolean(),
})

export type AddressValues = z.infer<typeof addressSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi."),
    newPassword: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`
      ),
    confirmPassword: z.string().min(1, "Ulangi kata sandi baru Anda."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Kata sandi tidak sama.",
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ["newPassword"],
    message: "Kata sandi baru harus berbeda dari yang sekarang.",
  })

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
