import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { PrintLabelTrigger } from "@/components/admin/pesanan/print-label-trigger"
import { ShippingLabel } from "@/components/admin/pesanan/shipping-label"
import { buttonVariants } from "@/components/ui/button"
import { canPrintShippingLabel } from "@/lib/admin/orders"
import { shippingLabelForOrder } from "@/lib/orders/service"

export const metadata: Metadata = { title: "Label pengiriman" }

export default async function ShippingLabelPage({
  params,
}: PageProps<"/admin/orders/[orderId]/label">) {
  const { orderId } = await params
  const label = await shippingLabelForOrder(orderId)

  if (!label) notFound()

  if (!canPrintShippingLabel(label)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="font-heading text-lg font-bold">
          Label belum bisa dicetak
        </h1>
        <p className="text-sm text-muted-foreground">
          Pesanan <span className="font-mono break-all">{label.id}</span> belum
          memiliki nomor resi. Tandai pesanan dikirim lebih dulu.
        </p>
        <Link
          href="/admin/orders?tab=to-ship"
          className={buttonVariants({ variant: "outline" })}
        >
          Kembali ke daftar pesanan
        </Link>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh justify-center bg-muted p-4 print:block print:min-h-0 print:bg-white print:p-0">
      <div className="flex flex-col items-center gap-4 print:items-start print:gap-0">
        <PrintLabelTrigger />
        <ShippingLabel label={label} />
      </div>
    </main>
  )
}
