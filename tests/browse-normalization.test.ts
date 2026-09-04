import assert from "node:assert/strict"
import test from "node:test"

import {
  browseIndexable,
  browsePageCount,
  normalizeBrowseQuery,
  resolveBrowseRequest,
  type BrowseQuery,
} from "../lib/site/browse"

const PAGE_COUNT = 10

function resolve(query: BrowseQuery, pageCount = PAGE_COUNT) {
  return resolveBrowseRequest({ query, pageCount })
}

test("the bare catalog is indexable and canonical at the root", () => {
  const { selection, canonical, redirectTo, index } = resolve({})

  assert.deepEqual(selection, { categories: [], search: "", page: 1 })
  assert.equal(canonical, "/")
  assert.equal(redirectTo, null)
  assert.equal(index, true)
})

test("page=1 permanently redirects to the root", () => {
  const { selection, canonical, redirectTo, redirectType } = resolve({
    page: "1",
  })

  assert.equal(selection.page, 1)
  assert.equal(canonical, "/")
  assert.equal(redirectTo, "/")
  assert.equal(redirectType, "permanent")
})

test("an in-range page self-canonicalizes and stays indexable", () => {
  const { selection, canonical, redirectTo, index } = resolve({ page: "2" })

  assert.equal(selection.page, 2)
  assert.equal(canonical, "/?page=2")
  assert.equal(redirectTo, null)
  assert.equal(index, true)
})

test("an out-of-range page temporarily redirects to the current last page", () => {
  const { selection, canonical, redirectTo, redirectType } = resolve({
    page: "999",
  })

  assert.equal(selection.page, PAGE_COUNT)
  assert.equal(canonical, `/?page=${PAGE_COUNT}`)
  assert.equal(redirectTo, `/?page=${PAGE_COUNT}`)
  assert.equal(redirectType, "temporary")
})

test("an out-of-range page on a single-page catalog redirects to the root", () => {
  const { selection, redirectTo } = resolve({ page: "999" }, 1)

  assert.equal(selection.page, 1)
  assert.equal(redirectTo, "/")
})

test("malformed page values fall back to page one", () => {
  for (const page of [
    "0",
    "-1",
    "-0",
    "2.5",
    "abc",
    "",
    " ",
    "1e400",
    "NaN",
    "Infinity",
  ]) {
    const { selection, redirectTo, redirectType } = resolve({ page })

    assert.equal(selection.page, 1, `page=${page}`)
    assert.equal(redirectTo, "/", `page=${page}`)
    assert.equal(redirectType, "permanent", `page=${page}`)
  }
})

test("integral decimal and padded page values normalize to the integer", () => {
  for (const page of ["2.0", " 2 ", "02"]) {
    const { selection, redirectTo } = resolve({ page })

    assert.equal(selection.page, 2, `page=${page}`)
    assert.equal(redirectTo, "/?page=2", `page=${page}`)
  }
})

test("repeated page params resolve to the first value", () => {
  const { selection, redirectTo } = resolve({ page: ["3", "7"] })

  assert.equal(selection.page, 3)
  assert.equal(redirectTo, "/?page=3")
})

test("one category is indexable and self-canonical", () => {
  const { selection, canonical, redirectTo, index } = resolve({
    category: "hunting",
  })

  assert.deepEqual(selection.categories, ["hunting"])
  assert.equal(canonical, "/?category=hunting")
  assert.equal(redirectTo, null)
  assert.equal(index, true)
})

test("two categories stay functional but are not indexable", () => {
  const { selection, canonical, redirectTo, index } = resolve({
    category: ["hunting", "fishing"],
  })

  assert.deepEqual(selection.categories, ["hunting", "fishing"])
  assert.equal(canonical, "/?category=hunting&category=fishing")
  assert.equal(redirectTo, null)
  assert.equal(index, false)
})

test("three categories are not indexable", () => {
  assert.equal(
    resolve({ category: ["hunting", "fishing", "hobbies"] }).index,
    false
  )
})

test("selecting every category redirects to the unfiltered catalog", () => {
  const { selection, canonical, redirectTo, index } = resolve({
    category: ["hunting", "fishing", "spareparts", "hobbies"],
  })

  assert.deepEqual(selection.categories, [])
  assert.equal(canonical, "/")
  assert.equal(redirectTo, "/")
  assert.equal(index, true)
})

test("non-canonical category order permanently redirects", () => {
  const { canonical, redirectTo, redirectType } = resolve({
    category: ["hobbies", "hunting"],
  })

  assert.equal(canonical, "/?category=hunting&category=hobbies")
  assert.equal(redirectTo, "/?category=hunting&category=hobbies")
  assert.equal(redirectType, "permanent")
})

test("duplicate categories permanently redirect to one param", () => {
  const { selection, redirectTo, redirectType } = resolve({
    category: ["hunting", "hunting"],
  })

  assert.deepEqual(selection.categories, ["hunting"])
  assert.equal(redirectTo, "/?category=hunting")
  assert.equal(redirectType, "permanent")
})

test("unknown categories are dropped", () => {
  const { selection, redirectTo } = resolve({
    category: ["senapan", "hunting"],
  })

  assert.deepEqual(selection.categories, ["hunting"])
  assert.equal(redirectTo, "/?category=hunting")
})

test("an only-unknown category redirects to the unfiltered catalog", () => {
  const { selection, redirectTo, index } = resolve({ category: "senapan" })

  assert.deepEqual(selection.categories, [])
  assert.equal(redirectTo, "/")
  assert.equal(index, true)
})

test("category and page combine into one canonical URL", () => {
  const { canonical, redirectTo, index } = resolve({
    category: "fishing",
    page: "3",
  })

  assert.equal(canonical, "/?category=fishing&page=3")
  assert.equal(redirectTo, null)
  assert.equal(index, true)
})

test("params are reordered into the canonical sequence", () => {
  const { redirectTo } = resolve({ page: "3", category: "fishing" })

  assert.equal(redirectTo, "/?category=fishing&page=3")
})

test("search is never indexable", () => {
  const { selection, canonical, redirectTo, index } = resolve({
    q: "joran",
  })

  assert.equal(selection.search, "joran")
  assert.equal(canonical, "/?q=joran")
  assert.equal(redirectTo, null)
  assert.equal(index, false)
})

test("search with a single category is still not indexable", () => {
  const { canonical, redirectTo, index } = resolve({
    category: "fishing",
    q: "joran",
  })

  assert.equal(canonical, "/?category=fishing&q=joran")
  assert.equal(redirectTo, null)
  assert.equal(index, false)
})

test("search keeps its page and stays unindexed", () => {
  const { selection, canonical, redirectTo, index } = resolve({
    q: "joran",
    page: "2",
  })

  assert.equal(selection.page, 2)
  assert.equal(canonical, "/?q=joran&page=2")
  assert.equal(redirectTo, null)
  assert.equal(index, false)
})

test("a padded or empty search normalizes away", () => {
  assert.equal(resolve({ q: "  joran  " }).redirectTo, "/?q=joran")
  assert.equal(resolve({ q: "   " }).redirectTo, "/")
  assert.equal(resolve({ q: "" }).canonical, "/")
})

test("unrelated params never trigger a redirect", () => {
  assert.equal(resolve({ utm_source: "instagram" }).redirectTo, null)
  assert.equal(
    resolve({ category: "hunting", utm_source: "instagram" }).redirectTo,
    null
  )
})

test("normalization does not depend on the page count", () => {
  const query: BrowseQuery = { category: ["hobbies", "hunting"], q: " reel " }

  assert.deepEqual(normalizeBrowseQuery(query), {
    categories: ["hunting", "hobbies"],
    search: "reel",
    page: 1,
  })
})

test("indexability follows the normalized selection", () => {
  assert.equal(
    browseIndexable({ categories: [], search: "", page: 4 }),
    true,
    "deep pages of the unfiltered catalog stay indexable"
  )
  assert.equal(
    browseIndexable({ categories: ["hunting"], search: "", page: 1 }),
    true
  )
  assert.equal(
    browseIndexable({
      categories: ["hunting", "fishing"],
      search: "",
      page: 1,
    }),
    false
  )
  assert.equal(
    browseIndexable({ categories: [], search: "reel", page: 1 }),
    false
  )
})

test("an empty catalog still has one page", () => {
  assert.equal(browsePageCount(0, 10), 1)
  assert.equal(browsePageCount(10, 10), 1)
  assert.equal(browsePageCount(11, 10), 2)
})
