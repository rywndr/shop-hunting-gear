"use client"

import { GoogleIcon } from "@/components/icons/google-icon"
import { Button } from "@/components/ui/button"
import { FieldGroup, FieldSeparator } from "@/components/ui/field"

type AuthFormProps = {
  children: React.ReactNode
  onSubmit: React.FormEventHandler<HTMLFormElement>
  onGoogle: () => void
  submitLabel: string
  googleLabel: string
  error?: string | undefined
  pending?: boolean | undefined
  googlePending?: boolean | undefined
}

function AuthForm({
  children,
  onSubmit,
  onGoogle,
  submitLabel,
  googleLabel,
  error,
  pending = false,
  googlePending = false,
}: AuthFormProps) {
  const disabled = pending || googlePending

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <FieldGroup className="gap-4">{children}</FieldGroup>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={disabled} className="h-10 w-full">
        {pending ? "Memproses..." : submitLabel}
      </Button>

      <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
        atau
      </FieldSeparator>

      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={onGoogle}
        className="h-10 w-full gap-2"
      >
        <GoogleIcon className="size-5" />
        {googlePending ? "Menghubungkan ke Google..." : googleLabel}
      </Button>
    </form>
  )
}

export { AuthForm }
