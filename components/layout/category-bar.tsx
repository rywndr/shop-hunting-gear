"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

import {
  CATEGORIES,
  CATEGORY_QUERY,
  SEARCH_QUERY,
  findCategories,
  shopHref,
} from "@/lib/site/config"
import { cn } from "@/lib/utils"

function CategoryBar({ className }: { className?: string }) {
  const searchParams = useSearchParams()
  const selected = findCategories(searchParams.getAll(CATEGORY_QUERY))
  const selectedSlugs = selected.map((category) => category.slug)
  const search = searchParams.get(SEARCH_QUERY) ?? undefined

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
          <li key={category.slug} className="h-full">
            <Link
              href={shopHref({
                categories: selectedSlugs.includes(category.slug)
                  ? selectedSlugs.filter((slug) => slug !== category.slug)
                  : [...selectedSlugs, category.slug],
                search,
              })}
              aria-current={selectedSlugs.includes(category.slug)}
              className="flex h-full items-center px-6 text-sm font-medium tracking-wide text-navbar-accent-foreground uppercase transition-colors hover:bg-navbar-foreground/10 aria-[current=true]:bg-navbar-foreground/10"
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
