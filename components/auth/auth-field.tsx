"use client"

import { useState } from "react"
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const CONTROL = "h-10"

type AuthFieldProps = Omit<React.ComponentProps<typeof Input>, "id"> & {
  id: string
  label: string
  description?: string
  error?: string
}

function TextField({
  id,
  label,
  description,
  error,
  className,
  ...props
}: AuthFieldProps) {
  const invalid = Boolean(error)

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        aria-invalid={invalid || undefined}
        className={cn(CONTROL, className)}
        {...props}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  )
}

type PasswordFieldProps = AuthFieldProps & {
  labelAction?: React.ReactNode
}

function PasswordField({
  id,
  label,
  description,
  error,
  labelAction,
  className,
  ...props
}: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const invalid = Boolean(error)
  const RevealIcon = revealed ? EyeSlashIcon : EyeIcon

  return (
    <Field data-invalid={invalid}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {labelAction}
      </div>

      <div className="relative">
        <Input
          id={id}
          type={revealed ? "text" : "password"}
          aria-invalid={invalid || undefined}
          className={cn(CONTROL, "pr-11", className)}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-controls={id}
          aria-pressed={revealed}
          aria-label={
            revealed ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
          }
          onClick={() => setRevealed((shown) => !shown)}
          className="absolute inset-y-0 right-0 h-10 w-11 text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <RevealIcon className="size-5" />
        </Button>
      </div>

      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  )
}

export { PasswordField, TextField }
