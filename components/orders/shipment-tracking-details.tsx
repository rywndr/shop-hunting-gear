import { Badge } from "@/components/ui/badge"
import type { ShipmentTracking } from "@/lib/shipping/schema"

function displayValue(value: string | null) {
  return value ?? "Belum tersedia"
}

function DataRow({
  label,
  children,
}: {
  readonly label: string
  readonly children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 border-b py-2 last:border-b-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  )
}

function eventDateTime({
  date,
  time,
}: {
  readonly date: string | null
  readonly time: string | null
}) {
  return [date, time]
    .filter((value): value is string => value !== null)
    .join(" ")
}

function ShipmentTrackingDetails({
  tracking,
}: {
  readonly tracking: ShipmentTracking
}) {
  const { summary, deliveryStatus, manifest } = tracking
  const deliveryInfoAvailable =
    deliveryStatus.status !== null ||
    deliveryStatus.podReceiver !== null ||
    deliveryStatus.podDate !== null ||
    deliveryStatus.podTime !== null

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="font-heading text-sm font-semibold uppercase">
          Ringkasan pengiriman
        </h3>
        <dl className="border-y text-sm">
          <DataRow label="Jasa kirim">
            {summary.courierName} ({summary.courierCode})
          </DataRow>
          <DataRow label="Nomor resi">
            <span className="font-mono">{summary.waybillNumber}</span>
          </DataRow>
          <DataRow label="Status saat ini">
            <Badge variant="secondary">{displayValue(summary.status)}</Badge>
          </DataRow>
          <DataRow label="Pengiriman">
            <span className="break-words">
              {displayValue(summary.origin)} →{" "}
              {displayValue(summary.destination)}
            </span>
          </DataRow>
          {summary.serviceCode !== null && (
            <DataRow label="Layanan">{summary.serviceCode}</DataRow>
          )}
          {summary.waybillDate !== null && (
            <DataRow label="Tanggal resi">{summary.waybillDate}</DataRow>
          )}
          {summary.receiverName !== null && (
            <DataRow label="Penerima">{summary.receiverName}</DataRow>
          )}
        </dl>
        <p className="text-xs text-muted-foreground">
          Status penerimaan:{" "}
          {tracking.delivered ? "Sudah diterima" : "Belum diterima"}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-heading text-sm font-semibold uppercase">
          Status penyerahan
        </h3>
        {deliveryInfoAvailable ? (
          <dl className="border-y text-sm">
            <DataRow label="Status">
              {displayValue(deliveryStatus.status)}
            </DataRow>
            {deliveryStatus.podReceiver !== null && (
              <DataRow label="Diterima oleh">
                {deliveryStatus.podReceiver}
              </DataRow>
            )}
            {deliveryStatus.podDate !== null && (
              <DataRow label="Tanggal diterima">
                {deliveryStatus.podDate}
              </DataRow>
            )}
            {deliveryStatus.podTime !== null && (
              <DataRow label="Waktu diterima">{deliveryStatus.podTime}</DataRow>
            )}
          </dl>
        ) : (
          <p className="border-y py-3 text-sm text-muted-foreground">
            Belum ada informasi penyerahan dari kurir.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-heading text-sm font-semibold uppercase">
          Riwayat perjalanan
        </h3>
        {manifest.length === 0 ? (
          <p className="border-y py-3 text-sm text-muted-foreground">
            Belum ada riwayat perjalanan dari kurir.
          </p>
        ) : (
          <ol
            className="flex flex-col border-l border-border"
            aria-label="Riwayat perjalanan paket"
          >
            {manifest.map((event, index) => (
              <li
                key={`${event.date ?? "tanpa-tanggal"}-${event.time ?? "tanpa-waktu"}-${index}`}
                className="relative pb-5 pl-5 last:pb-0"
              >
                <span
                  className="absolute top-1.5 -left-1.25 size-2.5 border-2 border-background bg-primary"
                  aria-hidden
                />
                <p className="text-sm font-medium">
                  {event.description ?? "Keterangan tidak tersedia"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {eventDateTime(event)}
                  {event.city && ` · ${event.city}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

export { ShipmentTrackingDetails }
