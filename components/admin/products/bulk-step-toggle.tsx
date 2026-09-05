"use client"

import { useRouter } from "next/navigation"

import { FilterToggle } from "@/components/admin/filter-toggle"
import {
  bulkHref,
  isBulkStep,
  BULK_STEPS,
  BULK_STEP_ORDER,
  type BulkMode,
  type BulkStepKind,
} from "@/lib/admin/bulk"

function BulkStepToggle({
  mode,
  step,
}: {
  mode: BulkMode
  step: BulkStepKind
}) {
  const router = useRouter()

  return (
    <FilterToggle
      label={`Tahap ${mode.label}`}
      value={step}
      isValue={isBulkStep}
      onValueChange={(next) => router.push(bulkHref({ mode, step: next }))}
      options={BULK_STEP_ORDER.map((kind) => ({
        value: kind,
        label: BULK_STEPS[kind].label,
      }))}
    />
  )
}

export { BulkStepToggle }
