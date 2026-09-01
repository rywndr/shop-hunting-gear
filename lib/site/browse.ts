import {
  CATEGORIES,
  CATEGORY_QUERY,
  PAGE_QUERY,
  SEARCH_QUERY,
  findCategories,
  shopHref,
  type CategorySlug,
} from "./config"

export type BrowseQuery = Readonly<
  Record<string, string | readonly string[] | undefined>
>

export type BrowseSelection = {
  readonly categories: readonly CategorySlug[]
  readonly search: string
  readonly page: number
}

type BrowseResolutionBase = {
  readonly selection: BrowseSelection
  readonly canonical: string
  readonly index: boolean
}

export type BrowseResolution = BrowseResolutionBase &
  (
    | { readonly redirectType: null; readonly redirectTo: null }
    | {
        readonly redirectType: "permanent" | "temporary"
        readonly redirectTo: string
      }
  )

const MAX_INDEXABLE_CATEGORIES = 1

const BROWSE_QUERIES = [CATEGORY_QUERY, SEARCH_QUERY, PAGE_QUERY] as const

type BrowseQueryKey = (typeof BROWSE_QUERIES)[number]

function isBrowseQueryKey(key: string): key is BrowseQueryKey {
  return BROWSE_QUERIES.some((query) => query === key)
}

function queryValues(
  value: string | readonly string[] | undefined
): readonly string[] {
  if (value === undefined) {
    return []
  }

  return typeof value === "string" ? [value] : value
}

function firstValue(value: string | readonly string[] | undefined) {
  return queryValues(value)[0]
}

function pageNumber(value: string | undefined) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
}

function selectedCategories(
  value: string | readonly string[] | undefined
): readonly CategorySlug[] {
  const slugs = findCategories(queryValues(value)).map(
    (category) => category.slug
  )

  return slugs.length === CATEGORIES.length ? [] : slugs
}

export function normalizeBrowseQuery(query: BrowseQuery): BrowseSelection {
  return {
    categories: selectedCategories(query[CATEGORY_QUERY]),
    search: firstValue(query[SEARCH_QUERY])?.trim() ?? "",
    page: pageNumber(firstValue(query[PAGE_QUERY])),
  }
}

export function browseHref(selection: BrowseSelection) {
  return shopHref({
    categories: selection.categories,
    search: selection.search,
    page: selection.page,
  })
}

export function requestedBrowseHref(query: BrowseQuery) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (!isBrowseQueryKey(key)) {
      continue
    }

    for (const item of queryValues(value)) {
      params.append(key, item)
    }
  }

  const search = params.toString()
  return search ? `/?${search}` : "/"
}

export function browseIndexable(selection: BrowseSelection) {
  return (
    selection.search === "" &&
    selection.categories.length <= MAX_INDEXABLE_CATEGORIES
  )
}

export function browsePageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function resolveBrowseRequest({
  query,
  pageCount,
}: {
  readonly query: BrowseQuery
  readonly pageCount: number
}): BrowseResolution {
  const normalized = normalizeBrowseQuery(query)
  const lastPage = Math.max(1, pageCount)
  const selection = {
    ...normalized,
    page: Math.min(normalized.page, lastPage),
  }
  const canonical = browseHref(selection)
  const resolution = {
    selection,
    canonical,
    index: browseIndexable(selection),
  }

  if (normalized.page > lastPage) {
    return {
      ...resolution,
      redirectType: "temporary",
      redirectTo: canonical,
    }
  }

  if (requestedBrowseHref(query) !== canonical) {
    return {
      ...resolution,
      redirectType: "permanent",
      redirectTo: canonical,
    }
  }

  return { ...resolution, redirectType: null, redirectTo: null }
}
