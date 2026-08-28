"use client"

import { MoonIcon, SunIcon } from "@phosphor-icons/react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

function useThemeSwap() {
  const { resolvedTheme, setTheme } = useTheme()

  return () => setTheme(resolvedTheme === "dark" ? "light" : "dark")
}

function ThemeToggle({ className }: { className?: string }) {
  const swapTheme = useThemeSwap()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Ganti tema warna"
      onClick={swapTheme}
      className={cn("shrink-0", className)}
    >
      <SunIcon className="hidden dark:block" aria-hidden />
      <MoonIcon className="dark:hidden" aria-hidden />
    </Button>
  )
}

function ThemeToggleMenuItem({ className }: { className?: string }) {
  const swapTheme = useThemeSwap()

  return (
    <DropdownMenuItem
      closeOnClick={false}
      onClick={swapTheme}
      className={className}
    >
      <SunIcon className="hidden dark:block" aria-hidden />
      <MoonIcon className="dark:hidden" aria-hidden />
      <span className="dark:hidden">Tema gelap</span>
      <span className="hidden dark:inline">Tema terang</span>
    </DropdownMenuItem>
  )
}

export { ThemeToggle, ThemeToggleMenuItem }
