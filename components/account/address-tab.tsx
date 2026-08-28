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
import type { Address } from "@/lib/account/mock"
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
}: {
  address: Address
  onEdit: () => void
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
            <Button type="button" variant="outline" size="sm">
              <StarIcon aria-hidden />
              Jadikan Utama
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            <PencilSimpleIcon aria-hidden />
            Ubah
          </Button>
          <Button type="button" variant="ghost" size="sm">
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
  const copy = DIALOG_COPY[editing?.mode ?? "new"]

  return (
    <div className="flex flex-col gap-4">
      {addresses.length === 0 ? (
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
          {addresses.map((address) => (
            <li key={address.id}>
              <AddressCard
                address={address}
                onEdit={() => setEditing({ mode: "edit", address })}
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
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { AddressTab }
