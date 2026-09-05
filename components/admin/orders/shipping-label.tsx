import Image from "next/image"

import type { PrintableShippingLabel } from "@/lib/orders/service"
import { SITE } from "@/lib/site/config"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/utils/format/intl"

/**
 * Fixed print colors and physical units keep output independent of the theme.
 */
const PRINT_STYLES = `
@media print {
  @page {
    size: 100mm 150mm;
    margin: 0;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    background: #fff;
  }

  [data-print-hidden] {
    display: none !important;
  }
}
`

const SECTION_TITLE = "text-[7pt] font-bold tracking-[0.14em] uppercase"

function addressLines({
  street,
  subdistrict,
  district,
  city,
  province,
  postalCode,
}: PrintableShippingLabel["address"]) {
  const region = [subdistrict, district].filter(Boolean).join(", ")
  const area = [city, province].filter(Boolean).join(", ")

  return [street, region, [area, postalCode].filter(Boolean).join(" ")].filter(
    Boolean
  )
}

function ShippingLabel({ label }: { label: PrintableShippingLabel }) {
  return (
    <>
      <style
        href="shipping-label-print"
        precedence="high"
        dangerouslySetInnerHTML={{ __html: PRINT_STYLES }}
      />

      <article
        data-shipping-label
        className="flex w-[100mm] flex-col gap-[2.5mm] border border-black bg-white p-[5mm] text-black"
      >
        <header className="flex items-start justify-between gap-[3mm] border-b border-black pb-[2mm]">
          <div className="flex min-w-0 items-center gap-[2mm]">
            <Image
              src={SITE.logo.src}
              width={SITE.logo.width}
              height={SITE.logo.height}
              alt=""
              priority
              className="h-[11mm] w-auto"
            />

            <div className="min-w-0">
              <p className="font-heading text-[10pt] leading-tight font-bold uppercase">
                {SITE.alternateName}
              </p>
              <p className={SECTION_TITLE}>Label Pengiriman</p>
            </div>
          </div>
        </header>

        <div className="flex items-baseline justify-between gap-[2mm] text-[7pt]">
          <span className="shrink-0 uppercase">No. Pesanan</span>
          <span className="min-w-0 text-right font-mono break-all">
            {label.id}
          </span>
        </div>

        <section className="border border-black p-[2mm]">
          <p className="text-[13pt] leading-none font-bold uppercase">
            {label.courierName}
          </p>
          <p className="mt-[1mm] text-[8pt] uppercase">{label.service}</p>

          <p
            className={cn(
              "mt-[2mm] border-t border-black pt-[1.5mm]",
              SECTION_TITLE
            )}
          >
            No. Resi
          </p>
          <p className="font-mono text-[14pt] leading-tight font-bold break-all">
            {label.tracking}
          </p>
        </section>

        <section className="border border-black p-[2mm]">
          <h2 className={SECTION_TITLE}>Penerima</h2>

          <p className="text-[11pt] leading-tight font-bold break-words">
            {label.address.recipient}
          </p>
          <p className="font-mono text-[9pt]">{label.address.phone}</p>

          <div className="mt-[1mm] text-[9pt] leading-snug break-words">
            {addressLines(label.address).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>

        <section className="border-t border-black pt-[1.5mm] text-[7pt]">
          <h2 className={SECTION_TITLE}>Pengirim</h2>
          <p className="font-bold">{SITE.alternateName}</p>
          <p>
            {SITE.phone.display} &middot; {SITE.email.display}
          </p>
        </section>

        <section className="border-t border-black pt-[1.5mm]">
          <h2 className={SECTION_TITLE}>Isi Paket</h2>

          <ol className="mt-[1mm] flex flex-col gap-[1mm] text-[8pt]">
            {label.items.map((item, index) => (
              <li
                key={`${item.name} ${item.variant}`}
                className="flex break-inside-avoid gap-[1.5mm]"
              >
                <span className="shrink-0 tabular-nums">{index + 1}.</span>

                <span className="min-w-0 flex-1 break-words">
                  <span className="font-bold">{item.name}</span>
                  <span className="block">
                    {item.variant && <>{item.variant} &middot; </>}x
                    {formatNumber(item.quantity)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </article>
    </>
  )
}

export { ShippingLabel }
