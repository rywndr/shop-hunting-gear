"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { AccountCard, AccountFormCard } from "@/components/account/account-card"
import { CONTROL, PasswordField } from "@/components/form/fields"
import { useNotification } from "@/components/notification/notification-provider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Account } from "@/lib/account/types"
import { authClient } from "@/lib/auth/client"
import { authErrorMessage } from "@/lib/auth/errors"
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from "@/lib/account/schema"
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/schema"

function ChangePasswordForm() {
  const { showNotification } = useNotification()
  const [formError, setFormError] = useState<string>()
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined)

    try {
      const { error } = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      })

      if (error) {
        setFormError(authErrorMessage(error))
        return
      }

      reset()
      showNotification({
        variant: "success",
        message: "Kata sandi berhasil diperbarui.",
      })
    } catch {
      setFormError(authErrorMessage(null))
    }
  })

  return (
    <AccountFormCard
      title="Ubah Kata Sandi"
      submitLabel="Simpan Kata Sandi"
      onSubmit={onSubmit}
      pending={isSubmitting}
      error={formError}
    >
      <PasswordField
        id="security-current-password"
        label="Kata Sandi Saat Ini"
        autoComplete="current-password"
        placeholder="Masukkan kata sandi saat ini"
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />

      <PasswordField
        id="security-new-password"
        label="Kata Sandi Baru"
        autoComplete="new-password"
        placeholder="Masukkan kata sandi baru"
        description={`Minimal ${MIN_PASSWORD_LENGTH} karakter.`}
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />

      <PasswordField
        id="security-confirm-password"
        label="Ulangi Kata Sandi Baru"
        autoComplete="new-password"
        placeholder="Ulangi kata sandi baru"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
    </AccountFormCard>
  )
}

const CONFIRM_ID = "security-delete-confirmation"
const CONFIRM_PHRASE = "iya, saya yakin"

function DeleteAccountCard({ account }: { account: Account }) {
  const router = useRouter()
  const { showNotification } = useNotification()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [password, setPassword] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string>()

  async function deleteAccount() {
    setDeleting(true)
    setDeleteError(undefined)

    try {
      const { error } = await authClient.deleteUser(
        account.provider === "credential" ? { password } : {}
      )

      if (error) {
        setDeleteError(authErrorMessage(error))
        setDeleting(false)
        return
      }

      showNotification({ variant: "success", message: "Akun berhasil dihapus." })
      router.push("/")
      router.refresh()
    } catch {
      setDeleteError(authErrorMessage(null))
      setDeleting(false)
    }
  }

  return (
    <AccountCard
      tone="destructive"
      title="Hapus Akun"
      description="Akun, riwayat pesanan, dan alamat tersimpan akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
    >
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setConfirmation("")
            setPassword("")
          }
        }}
      >
        <AlertDialogTrigger
          render={<Button type="button" variant="destructive" />}
          className="h-10"
        >
          Hapus Akun Saya
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus akun ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh data yang terkait akun ini akan dihapus permanen. Ketik
              &quot;{CONFIRM_PHRASE}&quot; untuk konfirmasi hapus.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Input
            id={CONFIRM_ID}
            aria-label="Konfirmasi hapus akun"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={CONFIRM_PHRASE}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className={CONTROL}
          />

          {account.provider === "credential" && (
            <Input
              type="password"
              aria-label="Kata sandi saat ini"
              autoComplete="current-password"
              placeholder="Kata sandi saat ini"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={CONTROL}
            />
          )}

          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                deleting ||
                confirmation.trim() !== CONFIRM_PHRASE ||
                (account.provider === "credential" && password.length === 0)
              }
              onClick={(event) => {
                event.preventDefault()
                void deleteAccount()
              }}
            >
              {deleting ? "Menghapus..." : "Ya, Hapus Akun"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AccountCard>
  )
}

function SecurityTab({ account }: { account: Account }) {
  return (
    <div className="flex flex-col gap-4">
      {account.provider === "credential" ? (
        <ChangePasswordForm />
      ) : (
        <AccountCard
          title="Kata Sandi"
          description="Akun ini masuk lewat Google, jadi tidak ada kata sandi yang perlu diubah di sini."
        >
          <p className="text-sm text-muted-foreground">
            Kelola kata sandi Anda dari setelan keamanan akun Google.
          </p>
        </AccountCard>
      )}

      <DeleteAccountCard account={account} />
    </div>
  )
}

export { SecurityTab }
