"use client"

import { useId } from "react"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function SearchField({
  label,
  value,
  onValueChange,
  className,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  className?: string
}) {
  const inputId = useId()

  return (
    <div role="search" className={cn("relative", className)}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Input
        id={inputId}
        type="search"
        autoComplete="off"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={label}
        className="pl-8 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
      />
      <MagnifyingGlassIcon
        className="pointer-events-none absolute inset-y-0 left-2.5 my-auto size-4 text-muted-foreground"
        aria-hidden
      />
    </div>
  )
}

export { SearchField }
