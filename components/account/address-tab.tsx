"use client"

import { useState } from "react"
import {
  MapPinIcon,
  PencilSimpleIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
} from "@phosphor-icons/react"

import { FLAT_CARD } from "@/components/account/account-card"
import { AddressForm } from "@/components/account/address-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  addressesResponseSchema,
  type AddressValues,
} from "@/lib/account/schema"
import type { Address } from "@/lib/account/types"
import { cn } from "@/lib/utils"

/**
 * Which address the dialog is for.
 */
type Editing = { mode: "new" } | { mode: "edit"; address: Address }

const DIALOG_COPY = {
  new: {
    title: "Alamat Baru",
    description: "Lengkapi wilayah dan kode pos agar biaya kirim akurat.",
    submitLabel: "Simpan Alamat",
  },
  edit: {
    title: "Ubah Alamat",
    description: "Perubahan berlaku untuk pesanan berikutnya.",
    submitLabel: "Simpan Perubahan",
  },
} as const

function AddressCard({
  address,
  onEdit,
  onSetPrimary,
  onDelete,
  pending,
}: {
  address: Address
  onEdit: () => void
  onSetPrimary: () => void
  onDelete: () => void
  pending: boolean
}) {
  return (
    <Card size="sm" className={FLAT_CARD}>
      <CardContent className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{address.label}</span>
          {address.isPrimary && <Badge variant="secondary">Utama</Badge>}
        </div>

        <div className="text-sm text-muted-foreground">
          <p className="text-foreground">{address.recipient}</p>
          <p>{address.phone}</p>
          <p className="mt-1">
            {address.street}, {address.subdistrict}, {address.district},{" "}
            {address.city}, {address.province} {address.postalCode}
          </p>
        </div>

        <div className="mt-1 flex flex-wrap gap-2">
          {!address.isPrimary && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={onSetPrimary}
            >
              <StarIcon aria-hidden />
              Jadikan Utama
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={onEdit}
          >
            <PencilSimpleIcon aria-hidden />
            Ubah
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={onDelete}
          >
            <TrashIcon aria-hidden />
            Hapus
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AddressTab({ addresses }: { addresses: readonly Address[] }) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const [currentAddresses, setCurrentAddresses] =
    useState<readonly Address[]>(addresses)
  const [pendingId, setPendingId] = useState<string>()
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null)
  const [actionError, setActionError] = useState<string>()
  const copy = DIALOG_COPY[editing?.mode ?? "new"]

  async function mutateAddresses({
    method,
    body,
    pendingKey,
  }: {
    method: "POST" | "PUT" | "PATCH" | "DELETE"
    body: unknown
    pendingKey: string
  }): Promise<string | undefined> {
    setPendingId(pendingKey)
    setActionError(undefined)

    try {
      const response = await fetch("/api/account/addresses", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        return "Alamat tidak dapat diperbarui. Coba lagi."
      }

      const result = addressesResponseSchema.safeParse(await response.json())

      if (!result.success) {
        return "Data alamat dari server tidak valid."
      }

      setCurrentAddresses(result.data.addresses)
      return undefined
    } catch {
      return "Tidak dapat terhubung. Periksa koneksi lalu coba lagi."
    } finally {
      setPendingId(undefined)
    }
  }

  function saveAddress(values: AddressValues) {
    if (editing?.mode === "edit") {
      return mutateAddresses({
        method: "PUT",
        body: { id: editing.address.id, values },
        pendingKey: editing.address.id,
      })
    }

    return mutateAddresses({
      method: "POST",
      body: values,
      pendingKey: "new",
    })
  }

  async function setPrimary(id: string) {
    const error = await mutateAddresses({
      method: "PATCH",
      body: { id },
      pendingKey: id,
    })
    setActionError(error)
  }

  async function deleteAddress() {
    if (!deleteTarget) {
      return
    }

    const error = await mutateAddresses({
      method: "DELETE",
      body: { id: deleteTarget.id },
      pendingKey: deleteTarget.id,
    })

    if (error) {
      setActionError(error)
      return
    }

    setDeleteTarget(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}

      {currentAddresses.length === 0 ? (
        <Empty className={cn(FLAT_CARD, "border-dashed py-10")}>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapPinIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Belum ada alamat</EmptyTitle>
            <EmptyDescription>
              Tambahkan alamat pengiriman agar biaya kirim bisa dihitung saat
              checkout.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-4">
          {currentAddresses.map((address) => (
            <li key={address.id}>
              <AddressCard
                address={address}
                onEdit={() => setEditing({ mode: "edit", address })}
                onSetPrimary={() => void setPrimary(address.id)}
                onDelete={() => setDeleteTarget(address)}
                pending={pendingId === address.id}
              />
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => setEditing({ mode: "new" })}
        className="h-10 self-start"
      >
        <PlusIcon aria-hidden />
        Tambah Alamat
      </Button>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border px-6 py-4 pr-14">
            <DialogTitle className="tracking-tight uppercase">
              {copy.title}
            </DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          {editing && (
            <AddressForm
              key={editing.mode === "edit" ? editing.address.id : "new"}
              submitLabel={copy.submitLabel}
              defaultValues={
                editing.mode === "edit" ? editing.address : undefined
              }
              onCancel={() => setEditing(null)}
              onSubmit={saveAddress}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus alamat ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Alamat {deleteTarget?.label} akan dihapus dari akun Anda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingId !== undefined}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pendingId !== undefined}
              onClick={(event) => {
                event.preventDefault()
                void deleteAddress()
              }}
            >
              {pendingId ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export { AddressTab }
