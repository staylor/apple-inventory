import { AppleApiError, checkAvailability } from '../../src/client.ts'
import { expandedSearch } from '../../src/expand.ts'
import { catalog, findProduct } from '../../src/products.ts'
import type { Availability } from '../../src/types.ts'

/**
 * How far to search. Apple answers each search with the 12 stores nearest the
 * location; the other choices combine several searches (see src/expand.ts).
 */
export const SEARCH_AREAS = [
  { value: 'nearest-12', label: 'Nearest 12 stores', nearest: 12 },
  { value: 'nearest-20', label: 'Nearest 20 stores', nearest: 20 },
  { value: 'within-25', label: 'Within 25 miles', miles: 25 },
  { value: 'within-50', label: 'Within 50 miles', miles: 50 },
  { value: 'within-100', label: 'Within 100 miles', miles: 100 },
  { value: 'within-200', label: 'Within 200 miles', miles: 200 },
] as const

export type SearchArea = (typeof SEARCH_AREAS)[number]

export interface SearchInput {
  parts: string[]
  location: string
  area: SearchArea
  inStockOnly: boolean
}

export interface StoreRow {
  store: Availability['store']
  /** Keyed by part number */
  parts: Record<string, { available: boolean; quote: string }>
}

export interface SearchResult {
  stores: StoreRow[]
  searches: number
  truncated: boolean
  /** Searches that apple.com didn't answer, so some stores may be missing */
  failedSearches: number
}

export type ParsedSearch =
  | { kind: 'empty'; input: SearchInput }
  | { kind: 'invalid'; input: SearchInput; error: string }
  | { kind: 'valid'; input: SearchInput }

/** Selected on a fresh form: the first product line. */
const DEFAULT_PARTS = catalog[0].products.map((p) => p.part)

/** Read the search form's query string. Only part numbers from the catalog are accepted. */
export function parseSearch(params: URLSearchParams): ParsedSearch {
  let submitted = params.has('location')
  let location = (params.get('location') ?? '').trim().slice(0, 80)
  let parts = params.getAll('part').filter((part) => findProduct(part) !== undefined)
  // Older links say `radius=<miles>` instead of `area=within-<miles>`.
  let areaValue = params.get('area') ?? `within-${params.get('radius')}`
  let input: SearchInput = {
    parts: submitted ? parts : DEFAULT_PARTS,
    location,
    area: SEARCH_AREAS.find((area) => area.value === areaValue) ?? SEARCH_AREAS[0],
    inStockOnly: params.get('inStock') === '1',
  }

  if (!submitted) return { kind: 'empty', input }
  if (location === '') return { kind: 'invalid', input, error: 'Enter a ZIP code or a city and state.' }
  if (parts.length === 0) return { kind: 'invalid', input, error: 'Choose at least one product.' }
  return { kind: 'valid', input }
}

export async function runSearch(input: SearchInput): Promise<SearchResult> {
  let query = { parts: input.parts, location: input.location }
  let { area } = input
  let rows: Availability[]
  let searches = 1
  let truncated = false
  let failedSearches = 0

  if (area.value === 'nearest-12') {
    // Apple's own answer: one search returns the 12 stores nearest the location.
    rows = await checkAvailability(query)
  } else {
    let result = await expandedSearch(
      query,
      'nearest' in area
        ? { limit: area.nearest }
        : { radiusMiles: area.miles, maxSearches: area.miles > 100 ? 50 : 25 },
    )
    rows = result.rows
    searches = result.searchedLocations.length + result.failedSearches
    truncated = result.truncated
    failedSearches = result.failedSearches
  }

  // One row per store (rows arrive sorted by distance), one cell per part.
  let stores = new Map<string, StoreRow>()
  for (let row of rows) {
    let entry = stores.get(row.store.number)
    if (!entry) {
      entry = { store: row.store, parts: {} }
      stores.set(row.store.number, entry)
    }
    entry.parts[row.partNumber] = { available: row.available, quote: row.quote }
  }

  let list = [...stores.values()]
  if (input.inStockOnly) {
    list = list.filter((row) => Object.values(row.parts).some((p) => p.available))
  }
  return { stores: list, searches, truncated, failedSearches }
}

/** Turn a failed search into a message for the page. */
export function describeError(error: unknown): string {
  // apple.com answers 541 to every request for a while after a burst of them.
  if (error instanceof AppleApiError && error.status === 541) {
    return 'apple.com is turning away requests from your network for now, which happens after a lot of searches in a short time. It can take about half an hour to clear.'
  }
  if (error instanceof AppleApiError) return error.message
  if (error instanceof Error && error.name === 'TimeoutError') {
    return 'apple.com took too long to respond. Try again in a moment.'
  }
  return 'Couldn’t reach apple.com. Check your connection and try again.'
}
