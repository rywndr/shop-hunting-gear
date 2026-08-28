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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const CONTROL = "h-10 read-only:cursor-not-allowed read-only:opacity-60"

type FieldFrameProps = {
  id: string
  label: string
  description?: string
  error?: string
  labelAction?: React.ReactNode
  children: React.ReactNode
}

function FieldFrame({
  id,
  label,
  description,
  error,
  labelAction,
  children,
}: FieldFrameProps) {
  return (
    <Field data-invalid={Boolean(error)}>
      {labelAction ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          {labelAction}
        </div>
      ) : (
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
      )}

      {children}

      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  )
}

type ControlProps<T> = Omit<T, "id"> & {
  id: string
  label: string
  description?: string
  error?: string
}

type TextFieldProps = ControlProps<React.ComponentProps<typeof Input>>

function TextField({
  id,
  label,
  description,
  error,
  className,
  ...props
}: TextFieldProps) {
  return (
    <FieldFrame id={id} label={label} description={description} error={error}>
      <Input
        id={id}
        aria-invalid={Boolean(error) || undefined}
        className={cn(CONTROL, className)}
        {...props}
      />
    </FieldFrame>
  )
}

type PasswordFieldProps = TextFieldProps & {
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
  const RevealIcon = revealed ? EyeSlashIcon : EyeIcon

  return (
    <FieldFrame
      id={id}
      label={label}
      description={description}
      error={error}
      labelAction={labelAction}
    >
      <div className="relative">
        <Input
          id={id}
          type={revealed ? "text" : "password"}
          aria-invalid={Boolean(error) || undefined}
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
    </FieldFrame>
  )
}

type TextareaFieldProps = ControlProps<React.ComponentProps<typeof Textarea>>

function TextareaField({
  id,
  label,
  description,
  error,
  className,
  ...props
}: TextareaFieldProps) {
  return (
    <FieldFrame id={id} label={label} description={description} error={error}>
      <Textarea
        id={id}
        aria-invalid={Boolean(error) || undefined}
        className={cn("min-h-20", className)}
        {...props}
      />
    </FieldFrame>
  )
}

type SelectFieldProps = {
  id: string
  label: string
  placeholder: string
  options: readonly string[]
  value: string
  onValueChange: (value: string) => void
  onBlur?: () => void
  name?: string
  inputRef?: React.Ref<HTMLInputElement>
  description?: string
  error?: string
  disabled?: boolean
}

function SelectField({
  id,
  label,
  placeholder,
  options,
  value,
  onValueChange,
  onBlur,
  name,
  inputRef,
  description,
  error,
  disabled,
}: SelectFieldProps) {
  return (
    <FieldFrame id={id} label={label} description={description} error={error}>
      <Select
        name={name}
        inputRef={inputRef}
        disabled={disabled}
        value={value}
        onValueChange={(next: string | null) => onValueChange(next ?? "")}
      >
        <SelectTrigger
          id={id}
          onBlur={onBlur}
          aria-invalid={Boolean(error) || undefined}
          className={cn(CONTROL, "w-full")}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldFrame>
  )
}

export { CONTROL, PasswordField, SelectField, TextareaField, TextField }
