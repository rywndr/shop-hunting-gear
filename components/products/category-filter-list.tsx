"use client"

import { useState } from "react"
import { XIcon } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"

import type { Category } from "@/lib/site/config"
import { shopHref } from "@/lib/site/config"

type CategoryFilterListProps = {
  categories: readonly Pick<Category, "label" | "slug">[]
  search: string
}

function CategoryFilterList({
  categories,
  search,
}: CategoryFilterListProps) {
  const router = useRouter()
  const [visibleCategories, setVisibleCategories] = useState(categories)
  const slugs = visibleCategories.map((category) => category.slug)

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {visibleCategories.map((category) => (
        <button
          key={category.slug}
          type="button"
          onClick={() => {
            setVisibleCategories((current) =>
              current.filter((item) => item.slug !== category.slug)
            )
            router.push(
              shopHref({
                categories: slugs.filter((slug) => slug !== category.slug),
                search,
              })
            )
          }}
          aria-label={`Hapus filter kategori ${category.label}`}
          className="inline-flex h-8 items-center gap-1.5 border border-border bg-muted px-2.5 text-xs font-medium hover:border-primary/40 hover:bg-accent"
        >
          {category.label}
          <XIcon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  )
}

export { CategoryFilterList }
