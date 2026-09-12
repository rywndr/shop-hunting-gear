"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRightIcon,
  CheckIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  XIcon,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { BrowseSelection } from "@/lib/site/browse"
import {
  BROWSE_SORT_OPTIONS,
  CATEGORY_QUERY,
  SEARCH_QUERY,
  SORT_QUERY,
  findCategories,
  isBrowseSort,
  shopHref as baseShopHref,
  type CategorySlug,
} from "@/lib/site/config"
import { MOBILE_QUERY } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/utils/format/intl"

type ShopHrefOptions = NonNullable<Parameters<typeof baseShopHref>[0]>

function shopHref(options?: ShopHrefOptions) {
  return `${baseShopHref(options)}#catalog`
}

type CategoryCount = {
  readonly slug: CategorySlug
  readonly label: string
  readonly count: number
}

type BrowseControlsProps = {
  readonly categories: readonly CategoryCount[]
  readonly selection: BrowseSelection
  readonly total: number
}

function browseFormHref(
  event: FormEvent<HTMLFormElement>,
  fallback: BrowseSelection
) {
  const data = new FormData(event.currentTarget)
  const categories = findCategories(
    data
      .getAll(CATEGORY_QUERY)
      .filter((value): value is string => typeof value === "string")
  ).map((category) => category.slug)
  const searchValue = data.get(SEARCH_QUERY)
  const sortValue = data.get(SORT_QUERY)

  return shopHref({
    categories,
    search: typeof searchValue === "string" ? searchValue.trim() : "",
    sort: isBrowseSort(sortValue) ? sortValue : fallback.sort,
  })
}

function HiddenSelectionFields({
  selection,
  includeSearch = true,
}: {
  readonly selection: BrowseSelection
  readonly includeSearch?: boolean
}) {
  return (
    <>
      {includeSearch && selection.search && (
        <input type="hidden" name={SEARCH_QUERY} value={selection.search} />
      )}
      {selection.categories.map((category) => (
        <input
          key={category}
          type="hidden"
          name={CATEGORY_QUERY}
          value={category}
        />
      ))}
      <input type="hidden" name={SORT_QUERY} value={selection.sort} />
    </>
  )
}

function SearchBox({
  selection,
  id,
  autoFocus = false,
  showSubmit = false,
  onNavigate,
}: {
  readonly selection: BrowseSelection
  readonly id: string
  readonly autoFocus?: boolean
  readonly showSubmit?: boolean
  readonly onNavigate?: () => void
}) {
  const router = useRouter()
  const [value, setValue] = useState(selection.search)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <form
      action="/"
      role="search"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault()
        onNavigate?.()
        router.push(browseFormHref(event, selection))
      }}
    >
      <HiddenSelectionFields selection={selection} includeSearch={false} />
      <label htmlFor={id} className="sr-only">
        Cari produk
      </label>
      <MagnifyingGlassIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        id={id}
        name={SEARCH_QUERY}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Cari produk"
        className={cn(
          "h-11 rounded-none border-foreground bg-background pl-10 [&::-webkit-search-cancel-button]:hidden",
          showSubmit ? "pr-23" : "pr-12"
        )}
      />
      <div className="absolute inset-y-0 right-px flex items-center">
        {value.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="size-11 rounded-none"
            aria-label="Hapus teks pencarian"
            onClick={() => {
              setValue("")
              inputRef.current?.focus()
            }}
          >
            <XIcon aria-hidden className="size-4" />
          </Button>
        )}
        {showSubmit && (
          <Button
            type="submit"
            variant="ghost"
            size="icon-lg"
            className="size-11 rounded-none"
            aria-label="Cari produk"
          >
            <ArrowRightIcon aria-hidden className="size-4" />
          </Button>
        )}
      </div>
    </form>
  )
}

function SelectionMark({ selected }: { readonly selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-5 shrink-0 items-center justify-center border border-muted-foreground",
        selected && "border-foreground bg-foreground text-background"
      )}
    >
      {selected && <CheckIcon className="size-3.5" weight="bold" />}
    </span>
  )
}

function DesktopCategoryOptions({
  categories,
  selection,
}: BrowseControlsProps) {
  const selected = new Set(selection.categories)
  const catalogTotal = categories.reduce(
    (total, category) => total + category.count,
    0
  )

  return (
    <div className="space-y-1">
      <Link
        href={shopHref({ search: selection.search, sort: selection.sort })}
        aria-current={selection.categories.length === 0 ? "true" : undefined}
        className="flex min-h-9 items-center gap-2 text-sm hover:underline aria-[current=true]:font-semibold"
      >
        <SelectionMark selected={selection.categories.length === 0} />
        <span>Semua kategori</span>
        <span className="ml-auto text-muted-foreground tabular-nums">
          {formatNumber(catalogTotal)}
        </span>
      </Link>
      {categories.map((category) => {
        const isSelected = selected.has(category.slug)
        const nextCategories = isSelected
          ? selection.categories.filter((slug) => slug !== category.slug)
          : [...selection.categories, category.slug]

        return (
          <Link
            key={category.slug}
            href={shopHref({
              categories: nextCategories,
              search: selection.search,
              sort: selection.sort,
            })}
            aria-current={isSelected ? "true" : undefined}
            className="flex min-h-9 items-center gap-2 text-sm hover:underline aria-[current=true]:font-semibold"
          >
            <SelectionMark selected={isSelected} />
            <span>{category.label}</span>
            <span className="ml-auto text-muted-foreground tabular-nums">
              {formatNumber(category.count)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function DesktopSortOptions({
  selection,
}: Pick<BrowseControlsProps, "selection">) {
  return (
    <div className="space-y-1">
      {BROWSE_SORT_OPTIONS.map((option) => {
        const isSelected = selection.sort === option.value

        return (
          <Link
            key={option.value}
            href={shopHref({
              categories: selection.categories,
              search: selection.search,
              sort: option.value,
            })}
            aria-current={isSelected ? "true" : undefined}
            className="flex min-h-9 items-center gap-2 text-sm hover:underline aria-[current=true]:font-semibold"
          >
            <span
              aria-hidden
              className="flex size-5 items-center justify-center rounded-full border border-muted-foreground"
            >
              {isSelected && (
                <span className="size-2.5 rounded-full bg-foreground" />
              )}
            </span>
            {option.label}
          </Link>
        )
      })}
    </div>
  )
}

function MobileFilterOptions({ categories, selection }: BrowseControlsProps) {
  const catalogTotal = categories.reduce(
    (total, category) => total + category.count,
    0
  )

  return (
    <>
      {selection.search && (
        <input type="hidden" name={SEARCH_QUERY} value={selection.search} />
      )}

      <fieldset className="space-y-1">
        <legend className="mb-3 font-semibold">Kategori</legend>
        <label className="flex min-h-10 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={selection.categories.length === 0}
            readOnly
            disabled
            className="size-5 accent-foreground"
          />
          <span>Semua kategori</span>
          <span className="ml-auto text-muted-foreground tabular-nums">
            {formatNumber(catalogTotal)}
          </span>
        </label>
        {categories.map((category) => (
          <label
            key={category.slug}
            className="flex min-h-10 items-center gap-3 text-sm"
          >
            <input
              type="checkbox"
              name={CATEGORY_QUERY}
              value={category.slug}
              defaultChecked={selection.categories.includes(category.slug)}
              className="size-5 accent-foreground"
            />
            <span>{category.label}</span>
            <span className="ml-auto text-muted-foreground tabular-nums">
              {formatNumber(category.count)}
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="mt-7 border-t border-border pt-6">
        <legend className="mb-3 font-semibold">Urutkan berdasarkan</legend>
        <div className="space-y-1">
          {BROWSE_SORT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex min-h-10 items-center gap-3 text-sm"
            >
              <input
                type="radio"
                name={SORT_QUERY}
                value={option.value}
                defaultChecked={selection.sort === option.value}
                className="size-5 accent-foreground"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  )
}

function DesktopSidebar(props: BrowseControlsProps) {
  return (
    <aside
      aria-labelledby="catalog-filters-heading"
      className="sticky top-28 hidden self-start md:block"
    >
      <h2 id="catalog-filters-heading" className="sr-only">
        Pencarian dan filter katalog
      </h2>
      <SearchBox
        key={props.selection.search}
        selection={props.selection}
        id="catalog-search-desktop"
        showSubmit
      />
      <p className="border-b border-border py-6 text-sm text-muted-foreground tabular-nums">
        {formatNumber(props.total)} produk
      </p>

      <section aria-labelledby="category-filter-heading" className="py-6">
        <h3 id="category-filter-heading" className="mb-3 font-semibold">
          Kategori
        </h3>
        <DesktopCategoryOptions {...props} />
      </section>

      <section
        aria-labelledby="sort-filter-heading"
        className="border-t border-border py-6"
      >
        <h3 id="sort-filter-heading" className="mb-3 font-semibold">
          Urutkan berdasarkan
        </h3>
        <DesktopSortOptions selection={props.selection} />
      </section>
    </aside>
  )
}

function MobileToolbar(props: BrowseControlsProps) {
  const router = useRouter()
  const [filterOpen, setFilterOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const activeFilterCount = props.selection.categories.length

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        setFilterOpen(false)
        setSearchOpen(false)
      }
    }

    query.addEventListener("change", closeOnDesktop)
    return () => query.removeEventListener("change", closeOnDesktop)
  }, [])

  return (
    <div className="flex items-center justify-between md:hidden">
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="lg"
              className="h-11 rounded-none border-foreground"
            />
          }
        >
          Filter
          {activeFilterCount > 0 && (
            <span className="tabular-nums">({activeFilterCount})</span>
          )}
          <FunnelSimpleIcon aria-hidden className="size-4" />
        </SheetTrigger>
        <SheetContent
          side="left"
          showCloseButton={false}
          overlayClassName="top-navbar"
          className="data-[side=left]:top-navbar data-[side=left]:h-auto data-[side=left]:w-[calc(100%-2.5rem)] sm:max-w-sm"
        >
          <SheetHeader className="flex-row items-center justify-between border-b border-border px-5 py-2">
            <SheetTitle className="sr-only">Filter produk</SheetTitle>
            <SheetClose
              render={
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="size-11 rounded-none"
                />
              }
              aria-label="Tutup filter"
            >
              <XIcon aria-hidden className="size-5" />
            </SheetClose>
            <SheetDescription className="tabular-nums">
              {formatNumber(props.total)} produk
            </SheetDescription>
          </SheetHeader>

          <form
            action="/"
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault()
              setFilterOpen(false)
              router.push(browseFormHref(event, props.selection))
            }}
          >
            <div className="flex-1 overflow-y-auto px-5 py-6">
              <MobileFilterOptions {...props} />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border p-5">
              <Button
                nativeButton={false}
                variant="outline"
                size="lg"
                render={
                  <Link
                    href={shopHref({ search: props.selection.search })}
                    onNavigate={() => setFilterOpen(false)}
                  />
                }
              >
                Hapus filter
              </Button>
              <Button type="submit" size="lg">
                Terapkan
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="icon-lg"
              className="size-11 rounded-none border-foreground"
              aria-label="Buka pencarian produk"
            />
          }
        >
          <MagnifyingGlassIcon className="size-5" />
        </SheetTrigger>
        <SheetContent
          side="top"
          showCloseButton={false}
          overlayClassName="top-navbar"
          className="gap-3 overflow-hidden border-b border-border p-4 data-[side=top]:top-navbar data-[side=top]:data-ending-style:translate-y-0 data-[side=top]:data-starting-style:translate-y-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Cari produk</SheetTitle>
            <SheetDescription>
              Masukkan nama atau kata kunci produk.
            </SheetDescription>
          </SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SearchBox
                selection={props.selection}
                id="catalog-search-mobile"
                autoFocus
                onNavigate={() => setSearchOpen(false)}
              />
            </div>
            <SheetClose className="text-sm underline underline-offset-4">
              Batal
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function BrowseControls(props: BrowseControlsProps) {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileToolbar {...props} />
    </>
  )
}

export { BrowseControls }
export type { CategoryCount }
