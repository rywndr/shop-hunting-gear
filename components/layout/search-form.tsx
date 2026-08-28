"use client"

import { useState } from "react"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  CATEGORY_QUERY,
  SEARCH_QUERY,
  findCategories,
  shopHref,
} from "@/lib/site/config"
import { cn } from "@/lib/utils"

type SearchFormProps = {
  className?: string
  id?: string
}

type SearchControlsProps = SearchFormProps & {
  categories: readonly string[]
  initialSearch: string
}

function SearchControls({
  categories,
  initialSearch,
  className,
  id = "site-search",
}: SearchControlsProps) {
  const router = useRouter()
  const [search, setSearch] = useState(initialSearch)

  return (
    <form
      action="/"
      role="search"
      onSubmit={(event) => {
        event.preventDefault()

        router.push(shopHref({ categories, search: search.trim() }))
      }}
      className={cn("relative", className)}
    >
      <label htmlFor={id} className="sr-only">
        Cari produk
      </label>
      <Input
        id={id}
        name={SEARCH_QUERY}
        type="search"
        autoComplete="off"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Cari produk"
        className="h-10 appearance-none bg-background pr-11 text-foreground [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon-lg"
        aria-label="Cari"
        className="absolute inset-y-0 right-0 h-10 w-11 text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <MagnifyingGlassIcon className="size-5" />
      </Button>
    </form>
  )
}

function SearchForm({ className, id }: SearchFormProps) {
  const searchParams = useSearchParams()
  const query = searchParams.get(SEARCH_QUERY) ?? ""
  const categories = findCategories(searchParams.getAll(CATEGORY_QUERY)).map(
    (category) => category.slug
  )

  return (
    <SearchControls
      key={query}
      categories={categories}
      initialSearch={query}
      className={className}
      id={id}
    />
  )
}

export { SearchForm }
