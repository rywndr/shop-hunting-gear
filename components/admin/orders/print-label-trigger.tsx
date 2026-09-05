"use client"

import { useEffect, useRef } from "react"
import { PrinterIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

async function documentReady() {
  if (document.readyState !== "complete") {
    await new Promise<void>((resolve) => {
      window.addEventListener("load", () => resolve(), { once: true })
    })
  }

  await document.fonts.ready
}

function PrintLabelTrigger() {
  const requested = useRef(false)

  useEffect(() => {
    if (requested.current) return

    let cancelled = false

    async function print() {
      await documentReady()
      if (cancelled) return

      requested.current = true
    }

    void print()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Button
      type="button"
      variant="outline"
      data-print-hidden
      onClick={() => window.print()}
    >
      <PrinterIcon data-icon="inline-start" />
      Cetak
    </Button>
  )
}

export { PrintLabelTrigger }
