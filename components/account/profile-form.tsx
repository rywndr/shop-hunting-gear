"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { UserCircleIcon } from "@phosphor-icons/react"
import { useForm } from "react-hook-form"

import { AccountFormCard } from "@/components/account/account-card"
import { TextField } from "@/components/form/fields"
import { profileSchema, type ProfileValues } from "@/lib/account/schema"
import type { Account } from "@/lib/account/types"
import { authClient } from "@/lib/auth/client"
import { authErrorMessage } from "@/lib/auth/errors"
import { formatShortDate } from "@/utils/format/intl"

function ProfileForm({ account }: { account: Account }) {
  const router = useRouter()
  const [formError, setFormError] = useState<string>()
  const [success, setSuccess] = useState<string>()
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: account.name },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined)
    setSuccess(undefined)

    try {
      const { error } = await authClient.updateUser({ name: values.name })

      if (error) {
        setFormError(authErrorMessage(error))
        return
      }

      setSuccess("Nama berhasil diperbarui.")
      router.refresh()
    } catch {
      setFormError(authErrorMessage(null))
    }
  })

  return (
    <AccountFormCard
      title="Info Dasar"
      description="Nama ini yang tampil pada pesanan dan ulasan Anda."
      submitLabel="Simpan Perubahan"
      onSubmit={onSubmit}
      pending={isSubmitting}
      error={formError}
      success={success}
    >
      <div className="flex items-center gap-3">
        <UserCircleIcon
          aria-hidden
          className="size-10 shrink-0 text-muted-foreground"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{account.name}</p>
          <p className="text-xs text-muted-foreground">
            Bergabung {formatShortDate(account.joinedAt)}
          </p>
        </div>
      </div>

      <TextField
        id="profil-nama"
        label="Nama Tampilan"
        autoComplete="name"
        placeholder="Nama lengkap Anda"
        error={errors.name?.message}
        {...register("name")}
      />

      <TextField
        id="profil-email"
        label="Email"
        type="email"
        readOnly
        value={account.email}
      />
    </AccountFormCard>
  )
}

export { ProfileForm }
