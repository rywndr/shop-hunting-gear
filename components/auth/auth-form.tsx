"use client"

import { GoogleIcon } from "@/components/icons/google-icon"
import { Button } from "@/components/ui/button"
import { FieldGroup, FieldSeparator } from "@/components/ui/field"

type AuthFormProps = {
  children: React.ReactNode
  onSubmit: React.FormEventHandler<HTMLFormElement>
  submitLabel: string
  googleLabel: string
}

function AuthForm({
  children,
  onSubmit,
  submitLabel,
  googleLabel,
}: AuthFormProps) {
  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <FieldGroup className="gap-4">{children}</FieldGroup>

      <Button type="submit" className="h-10 w-full">
        {submitLabel}
      </Button>

      <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
        atau
      </FieldSeparator>

      <Button type="button" variant="outline" className="h-10 w-full gap-2">
        <GoogleIcon className="size-5" />
        {googleLabel}
      </Button>
    </form>
  )
}

export { AuthForm }
