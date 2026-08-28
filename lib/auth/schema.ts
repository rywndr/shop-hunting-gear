/**
 * Validation for sign-in and register forms.
 */

import { z } from "zod"

export const MIN_PASSWORD_LENGTH = 8

const emailField = z
  .string()
  .min(1, "Email wajib diisi.")
  .pipe(z.email("Format email tidak valid."))

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Kata sandi wajib diisi."),
  rememberMe: z.boolean(),
})

export type SignInValues = z.infer<typeof signInSchema>

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter."),
    email: emailField,
    password: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`
      ),
    confirmPassword: z.string().min(1, "Ulangi kata sandi Anda."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Kata sandi tidak sama.",
  })

export type RegisterValues = z.infer<typeof registerSchema>
