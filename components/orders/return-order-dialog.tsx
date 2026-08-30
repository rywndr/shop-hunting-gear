"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import type { Order } from "@/lib/orders/config"

type ReturnOrderDialogProps = {
  readonly order: Pick<Order, "id" | "items">
  readonly triggerLabel: string
}

function reasonControlId(orderId: string) {
  return `alasan-retur-${orderId.replaceAll("/", "-")}`
}

function ReturnOrderDialog({ order, triggerLabel }: ReturnOrderDialogProps) {
  const reasonId = reasonControlId(order.id)

  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant="outline" className="h-10" />}
      >
        {triggerLabel}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajukan retur barang</DialogTitle>
          <DialogDescription>
            Retur berlaku untuk seluruh transaksi {order.id}. Semua barang di
            bawah ini akan disertakan dalam pengajuan.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="border">
            <h3 className="border-b px-3 py-2 text-sm font-medium">
              Barang dalam transaksi
            </h3>
            <ul className="divide-y">
              {order.items.map((item, index) => (
                <li
                  key={`${item.name}-${item.variant}-${index}`}
                  className="flex items-start justify-between gap-4 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.variant}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {item.quantity} barang
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Field>
            <FieldLabel htmlFor={reasonId}>Alasan retur</FieldLabel>
            <Textarea
              id={reasonId}
              name="returnReason"
              placeholder="Jelaskan kondisi barang dan alasan retur"
              rows={4}
            />
          </Field>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Batal
            </DialogClose>
            <Button type="submit">Kirim Pengajuan Retur</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { ReturnOrderDialog }
