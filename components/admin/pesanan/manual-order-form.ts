import type { UseFormReturn } from "react-hook-form"

import type {
  ManualOrderInput,
  ManualOrderValues,
} from "@/lib/admin/manual-order"

export type ManualOrderForm = UseFormReturn<
  ManualOrderInput,
  unknown,
  ManualOrderValues
>

export function fieldError(error: { message?: string } | undefined) {
  return error?.message
}
