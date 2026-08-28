import Link from "next/link"

import { CATEGORIES } from "@/lib/site/config"
import { cn } from "@/lib/utils"

function CategoryBar({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Kategori produk"
      className={cn(
        "hidden h-category-bar border-y border-navbar-border bg-navbar-accent/75 backdrop-blur-sm md:block",
        className
      )}
    >
      <ul className="mx-auto flex h-full max-w-7xl items-center justify-center px-4">
        {CATEGORIES.map((category) => (
          <li key={category.href} className="h-full">
            <Link
              href={category.href}
              className="flex h-full items-center px-6 text-sm font-medium tracking-wide text-navbar-accent-foreground uppercase transition-colors hover:bg-navbar-foreground/10"
            >
              {category.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export { CategoryBar }
