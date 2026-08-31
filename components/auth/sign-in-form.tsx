"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { PasswordField, TextField } from "@/components/form/fields"
import { AuthForm } from "@/components/auth/auth-form"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { authClient } from "@/lib/auth/client"
import { authErrorMessage } from "@/lib/auth/errors"
import { signInSchema, type SignInValues } from "@/lib/auth/schema"
import { AUTH_ROUTES } from "@/lib/site/config"

const REMEMBER_ID = "sign-in-remember"

function SignInForm({ callbackURL }: { callbackURL: string }) {
  const router = useRouter()
  const [authError, setAuthError] = useState<string>()
  const [googlePending, setGooglePending] = useState(false)
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  })

  const onSubmit = handleSubmit(async (values) => {
    setAuthError(undefined)

    try {
      const { error } = await authClient.signIn.email({
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe,
      })

      if (error) {
        setAuthError(authErrorMessage(error))
        return
      }

      router.push(callbackURL)
      router.refresh()
    } catch {
      setAuthError(authErrorMessage(null))
    }
  })

  async function signInWithGoogle() {
    setAuthError(undefined)
    setGooglePending(true)

    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL,
      })

      if (error) {
        setAuthError(authErrorMessage(error))
        setGooglePending(false)
      }
    } catch {
      setAuthError(authErrorMessage(null))
      setGooglePending(false)
    }
  }

  return (
    <AuthForm
      onSubmit={onSubmit}
      onGoogle={signInWithGoogle}
      submitLabel="Masuk"
      googleLabel="Masuk dengan Google"
      error={authError}
      pending={isSubmitting}
      googlePending={googlePending}
    >
      <TextField
        id="sign-in-email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="nama@email.com"
        error={errors.email?.message}
        {...register("email")}
      />

      <PasswordField
        id="sign-in-password"
        label="Kata Sandi"
        autoComplete="current-password"
        placeholder="Masukkan kata sandi"
        error={errors.password?.message}
        labelAction={
          <Link
            href={AUTH_ROUTES.forgotPassword}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Lupa kata sandi?
          </Link>
        }
        {...register("password")}
      />

      <Field orientation="horizontal" className="gap-2">
        <Controller
          control={control}
          name="rememberMe"
          render={({ field }) => (
            <Checkbox
              id={REMEMBER_ID}
              name={field.name}
              aria-labelledby={`${REMEMBER_ID}-label`}
              checked={field.value}
              onCheckedChange={field.onChange}
              inputRef={field.ref}
            />
          )}
        />
        <FieldLabel
          id={`${REMEMBER_ID}-label`}
          htmlFor={REMEMBER_ID}
          className="font-normal text-muted-foreground"
        >
          Ingat saya
        </FieldLabel>
      </Field>
    </AuthForm>
  )
}

export { SignInForm }
