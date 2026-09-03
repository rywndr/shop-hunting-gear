import { z } from "zod"

export const TRACKING_MIN_LENGTH = 6
export const TRACKING_MAX_LENGTH = 40

const TRACKING_PATTERN = /^[A-Za-z0-9][A-Za-z0-9./ -]*[A-Za-z0-9]$/

export function normalizeTracking(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

export const trackingSchema = z
  .string()
  .transform(normalizeTracking)
  .superRefine((tracking, ctx) => {
    if (tracking.length === 0) {
      ctx.addIssue({ code: "custom", message: "Masukkan nomor resi." })
      return
    }

    if (tracking.length < TRACKING_MIN_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: `Nomor resi minimal ${TRACKING_MIN_LENGTH} karakter.`,
      })
      return
    }

    if (tracking.length > TRACKING_MAX_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: `Nomor resi maksimal ${TRACKING_MAX_LENGTH} karakter.`,
      })
      return
    }

    if (!TRACKING_PATTERN.test(tracking)) {
      ctx.addIssue({
        code: "custom",
        message:
          "Nomor resi hanya boleh berisi huruf, angka, titik, tanda hubung, dan garis miring.",
      })
    }
  })

export const shipOrderSchema = z.object({ tracking: trackingSchema })

export type ShipOrderInput = z.input<typeof shipOrderSchema>
export type ShipOrderValues = z.output<typeof shipOrderSchema>

export const SHIP_ORDER_DEFAULT_VALUES = {
  tracking: "",
} satisfies ShipOrderInput

export const TRACKING_PLACEHOLDER = "JP1234567890"
