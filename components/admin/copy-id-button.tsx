"use client"

import { useState } from "react"
import { CheckIcon, CopyIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function CopyIdButton({
  value,
  label = value,
  className,
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={copy}
      aria-label={copied ? `${label} tersalin` : `Salin ${label}`}
      className={cn(
        "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100",
        className
      )}
    >
      {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
    </Button>
  )
}

export { CopyIdButton }
