import {
  manualOrderCustomerLabel,
  manualOrderDeliveryMethod,
  type ManualOrderCustomer,
  type ManualOrderInput,
  type ManualOrderProduct,
} from "@/lib/admin/manual-order"
import { formatRupiah } from "@/utils/format/intl"

type ManualOrderReviewStepProps = {
  values: Partial<ManualOrderInput>
  customer: ManualOrderCustomer | undefined
  product: ManualOrderProduct | undefined
}

function ManualOrderReviewStep({
  values,
  customer,
  product,
}: ManualOrderReviewStepProps) {
  const quantity = Number(values.quantity) || 0
  const delivery = manualOrderDeliveryMethod(values.deliveryMethod ?? "")
  const requiresAddress = delivery?.requiresAddress ?? true
  const shippingCost = requiresAddress ? Number(values.shippingCost) || 0 : 0
  const subtotal = (product?.price ?? 0) * quantity

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 border border-border p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Pelanggan</p>
          <p className="font-medium">
            {customer ? manualOrderCustomerLabel(customer) : "-"}
          </p>
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
          <p className="font-medium">{delivery?.label}</p>
          <p className="text-sm whitespace-pre-line text-muted-foreground">
            {requiresAddress
              ? values.address
              : "Diambil pelanggan di toko, tanpa nomor resi."}
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
        Pesanan dibuat dengan status Belum Bayar. Tandai sudah dibayar setelah
        pembayaran diterima.
      </p>
    </div>
  )
}

export { ManualOrderReviewStep }
