"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { AccountCard, AccountFormCard } from "@/components/account/account-card"
import { CONTROL, PasswordField } from "@/components/form/fields"
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
import type { Account } from "@/lib/account/mock"
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from "@/lib/account/schema"
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/schema"

function ChangePasswordForm() {
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  return (
    <AccountFormCard
      title="Ubah Kata Sandi"
      submitLabel="Simpan Kata Sandi"
      onSubmit={handleSubmit(() => {})}
    >
      <PasswordField
        id="keamanan-sandi-lama"
        label="Kata Sandi Saat Ini"
        autoComplete="current-password"
        placeholder="Masukkan kata sandi saat ini"
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />

      <PasswordField
        id="keamanan-sandi-baru"
        label="Kata Sandi Baru"
        autoComplete="new-password"
        placeholder="Masukkan kata sandi baru"
        description={`Minimal ${MIN_PASSWORD_LENGTH} karakter.`}
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />

      <PasswordField
        id="keamanan-sandi-ulang"
        label="Ulangi Kata Sandi Baru"
        autoComplete="new-password"
        placeholder="Ulangi kata sandi baru"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
    </AccountFormCard>
  )
}

const CONFIRM_ID = "keamanan-hapus-konfirmasi"
const CONFIRM_PHRASE = "iya, saya yakin"

function DeleteAccountCard() {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")

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
          if (!next) setConfirmation("")
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

          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={confirmation.trim() !== CONFIRM_PHRASE}
              onClick={() => setOpen(false)}
            >
              Ya, Hapus Akun
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

      <DeleteAccountCard />
    </div>
  )
}

export { SecurityTab }
