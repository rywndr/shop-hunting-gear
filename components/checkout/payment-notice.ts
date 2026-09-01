export type PaymentNotice = {
  readonly kind: "info" | "success" | "error"
  readonly message: string
}

export function paymentNoticeForConfirmation(result: {
  readonly kind: "paid" | "pending" | "cancelled" | "error"
}): PaymentNotice {
  switch (result.kind) {
    case "paid":
      return {
        kind: "success",
        message: "Pembayaran berhasil dikonfirmasi.",
      }
    case "pending":
      return {
        kind: "info",
        message:
          "Pembayaran diterima. Status pesanan masih menunggu konfirmasi.",
      }
    case "cancelled":
      return {
        kind: "error",
        message: "Midtrans tidak mengonfirmasi pembayaran ini.",
      }
    case "error":
      return {
        kind: "info",
        message:
          "Pembayaran selesai di Midtrans. Status pesanan akan diperbarui setelah konfirmasi.",
      }
    default: {
      const _exhaustive: never = result.kind
      return _exhaustive
    }
  }
}
