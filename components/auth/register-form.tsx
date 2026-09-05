"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { PasswordField, TextField } from "@/components/form/fields"
import { AuthForm } from "@/components/auth/auth-form"
import { useNotification } from "@/components/notification/notification-provider"
import { authClient } from "@/lib/auth/client"
import { authErrorMessage } from "@/lib/auth/errors"
import {
  clearAuthNotification,
  queueAuthNotification,
} from "@/lib/auth/notification"
import {
  MIN_PASSWORD_LENGTH,
  registerSchema,
  type RegisterValues,
} from "@/lib/auth/schema"

function RegisterForm({ callbackURL }: { callbackURL: string }) {
  const router = useRouter()
  const { showNotification } = useNotification()
  const [authError, setAuthError] = useState<string>()
  const [googlePending, setGooglePending] = useState(false)
  const {
    formState: { errors, isSubmitting },
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

  const onSubmit = handleSubmit(async (values) => {
    setAuthError(undefined)
    clearAuthNotification()

    try {
      const { error } = await authClient.signUp.email({
        name: values.name,
        email: values.email,
        password: values.password,
      })

      if (error) {
        setAuthError(authErrorMessage(error))
        return
      }

      showNotification({ variant: "success", message: "Akun berhasil dibuat." })
      router.push(callbackURL)
      router.refresh()
    } catch {
      setAuthError(authErrorMessage(null))
    }
  })

  async function registerWithGoogle() {
    setAuthError(undefined)
    setGooglePending(true)
    queueAuthNotification("sign-up")

    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL,
      })

      if (error) {
        clearAuthNotification()
        setAuthError(authErrorMessage(error))
        setGooglePending(false)
      }
    } catch {
      clearAuthNotification()
      setAuthError(authErrorMessage(null))
      setGooglePending(false)
    }
  }

  return (
    <AuthForm
      onSubmit={onSubmit}
      onGoogle={registerWithGoogle}
      submitLabel="Daftar"
      googleLabel="Daftar dengan Google"
      error={authError}
      pending={isSubmitting}
      googlePending={googlePending}
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
