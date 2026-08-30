"use client"

import { useState } from "react"
import { CheckCircleIcon, UploadSimpleIcon } from "@phosphor-icons/react"

import { OrderQueueBadge } from "@/components/admin/pesanan/order-queue-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

function MarkOrderPaidDialog({ orderId }: { orderId: string }) {
  const [proofName, setProofName] = useState<string | null>(null)
  const proofId = `bukti-pembayaran-${orderId.replaceAll("/", "-")}`

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        Tandai dibayar
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tandai pesanan sudah dibayar?</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4 border-y py-3">
            <div className="min-w-0">
              <span className="block text-xs text-muted-foreground">
                Pesanan
              </span>
              <span className="block truncate font-mono text-sm">
                {orderId}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2 text-xs">
              <span className="text-muted-foreground">Status baru</span>
              <OrderQueueBadge queue="toShip" />
            </div>
          </div>

          <Field>
            <FieldLabel htmlFor={proofId}>Bukti pembayaran (opsional)</FieldLabel>
            <div className="flex min-w-0 items-center gap-3 border bg-input/50 p-2">
              <Input
                id={proofId}
                name="paymentProof"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="sr-only"
                onChange={(event) =>
                  setProofName(event.target.files?.[0]?.name ?? null)
                }
              />
              <label
                htmlFor={proofId}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
              >
                <UploadSimpleIcon aria-hidden />
                Pilih bukti
              </label>
              <span className="min-w-0 truncate text-sm text-muted-foreground">
                {proofName ?? "Belum ada berkas dipilih"}
              </span>
            </div>
          </Field>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
          <Button type="button">Konfirmasi sudah dibayar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { MarkOrderPaidDialog }
