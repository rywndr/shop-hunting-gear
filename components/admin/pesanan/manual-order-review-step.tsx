import type {
  ManualOrderInput,
  ManualOrderProduct,
} from "@/lib/admin/manual-order"
import { formatRupiah } from "@/utils/format/intl"

type ManualOrderReviewStepProps = {
  values: Partial<ManualOrderInput>
  product: ManualOrderProduct | undefined
}

function ManualOrderReviewStep({
  values,
  product,
}: ManualOrderReviewStepProps) {
  const quantity = Number(values.quantity) || 0
  const shippingCost = Number(values.shippingCost) || 0
  const subtotal = (product?.price ?? 0) * quantity

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 border border-border p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Pelanggan</p>
          <p className="font-medium">{values.buyer}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Barang</p>
          <p className="font-medium">{product?.name}</p>
          <p className="text-sm text-muted-foreground">
            {values.variant} · {quantity} barang
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Penerima</p>
          <p className="font-medium">{values.recipient}</p>
          <p className="text-sm text-muted-foreground">{values.phone}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pengiriman</p>
          <p className="font-medium">{values.courier}</p>
          <p className="text-sm whitespace-pre-line text-muted-foreground">
            {values.address}
          </p>
        </div>
      </div>

      <dl className="grid gap-2 border border-border p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{formatRupiah(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Ongkos kirim</dt>
          <dd className="tabular-nums">{formatRupiah(shippingCost)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">
            {formatRupiah(subtotal + shippingCost)}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">
        Tombol pembuatan pesanan belum mengirim data karena backend belum
        tersambung.
      </p>
    </div>
  )
}

export { ManualOrderReviewStep }
