"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { PasswordField, TextField } from "@/components/auth/auth-field"
import { AuthForm } from "@/components/auth/auth-form"
import {
  MIN_PASSWORD_LENGTH,
  registerSchema,
  type RegisterValues,
} from "@/lib/auth/schema"

function RegisterForm() {
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const onSubmit = handleSubmit(() => {})

  return (
    <AuthForm
      onSubmit={onSubmit}
      submitLabel="Daftar"
      googleLabel="Daftar dengan Google"
    >
      <TextField
        id="register-name"
        label="Nama Lengkap"
        autoComplete="name"
        placeholder="Nama anda"
        error={errors.name?.message}
        {...register("name")}
      />

      <TextField
        id="register-email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="nama@email.com"
        error={errors.email?.message}
        {...register("email")}
      />

      <PasswordField
        id="register-password"
        label="Kata Sandi"
        autoComplete="new-password"
        placeholder="Buat kata sandi"
        description={`Minimal ${MIN_PASSWORD_LENGTH} karakter.`}
        error={errors.password?.message}
        {...register("password")}
      />

      <PasswordField
        id="register-confirm-password"
        label="Ulangi Kata Sandi"
        autoComplete="new-password"
        placeholder="Ulangi kata sandi"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
    </AuthForm>
  )
}

export { RegisterForm }
