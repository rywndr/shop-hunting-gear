export const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export const RETURN_REASONS = {
  damaged: "Barang rusak saat diterima",
  defective: "Barang tidak berfungsi",
  wrong_item: "Barang yang dikirim salah",
  not_as_described: "Barang tidak sesuai deskripsi",
} as const

export type ReturnReason = keyof typeof RETURN_REASONS

export const RETURN_STATUSES = {
  requested: "Menunggu pemeriksaan pengajuan",
  approved: "Disetujui, menunggu barang dikembalikan",
  rejected: "Pengajuan ditolak",
  inspected: "Barang diterima dan diperiksa",
} as const
export type ReturnStatus = keyof typeof RETURN_STATUSES

export const REFUND_STATUSES = {
  ready: "Siap dikembalikan",
  pending: "Menunggu konfirmasi pengembalian dana",
  blocked: "Memerlukan pemeriksaan admin",
  confirmed: "Dana telah dikembalikan",
} as const
export type RefundStatus = keyof typeof REFUND_STATUSES

export type AdminReturnRequest = {
  readonly id: string
  readonly orderId: string
  readonly status: ReturnStatus
  readonly reason: ReturnReason
  readonly details: string
  readonly note: string | null
  readonly photos: readonly { readonly id: string; readonly url: string }[]
  readonly items: readonly {
    readonly id: string
    readonly name: string
    readonly quantity: number
    readonly receivedQuantity: number | null
    readonly resellableQuantity: number | null
  }[]
  readonly refund: {
    readonly method: "midtrans" | "offline"
    readonly status: RefundStatus
    readonly amount: number
    readonly reference: string | null
    readonly lastError: string | null
  } | null
}

export type CustomerReturnState =
  | { readonly kind: "eligible" }
  | { readonly kind: "unavailable" }
  | {
      readonly kind: "requested"
      readonly id: string
      readonly status: ReturnStatus
      readonly note: string | null
      readonly refundStatus: RefundStatus | null
    }
