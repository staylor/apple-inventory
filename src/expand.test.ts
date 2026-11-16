import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { expandedSearch, haversineMiles } from './expand.ts'
import type { Availability } from './types.ts'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

// A 12×12 grid of stores about 3 miles apart, nudged so that no two stores
// are exactly the same distance from the searched location.
const fakeStores = Array.from({ length: 144 }, (_, k) => ({
  number: `R${k}`,
  postalCode: `Z${k}`,
  lat: 40 + Math.floor(k / 12) * 0.05 + ((k * 7) % 11) * 0.001,
  lon: -74 + (k % 12) * 0.06 + ((k * 5) % 13) * 0.001,
}))
/** Where the searched ZIP code, 10001, is. */
const home = { lat: 40.2731, lon: -73.6847 }

/** Fake Apple endpoint: like the real one, it returns the 12 stores nearest the searched postal code. */
function fakeApple({ refuseStoreSearches = false } = {}) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    let location = new URL(String(input)).searchParams.get('location')
    if (location !== '10001' && refuseStoreSearches) return new Response('', { status: 541 })
    let center = location === '10001' ? home : fakeStores.find((s) => s.postalCode === location)!
    let stores = fakeStores
      .map((store) => ({ store, miles: haversineMiles(center, store) }))
      .sort((a, b) => a.miles - b.miles)
      .slice(0, 12)
      .map(({ store, miles }) => ({
        storeNumber: store.number,
        storeName: store.number,
        storedistance: Math.round(miles * 100) / 100,
        storelatitude: store.lat,
        storelongitude: store.lon,
        address: { postalCode: store.postalCode },
        partsAvailability: { A: { partNumber: 'A', pickupDisplay: 'available', pickupSearchQuote: 'Available Today' } },
      }))
    return Response.json({ head: { status: '200', data: {} }, body: { stores } })
  }) as typeof fetch
}

const byDistance = fakeStores
  .map((store) => ({ number: store.number, miles: haversineMiles(home, store) }))
  .sort((a, b) => a.miles - b.miles)

/** The stores in the results, in a fixed order for comparing. */
function storesFound(rows: Availability[]): string[] {
  return [...new Set(rows.map((row) => row.store.number))].sort()
}

function storesWhere(test: (s: { miles: number }, index: number) => boolean): string[] {
  return byDistance.filter(test).map((s) => s.number).sort()
}

// Distances are measured from where the search estimates the location is, so
// stores a few hundredths of a mile apart can trade places. Compare which
// stores were found, and check the results' own order separately.
function assertSortedByDistance(rows: Availability[]) {
  let distances = rows.map((row) => row.store.distance)
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b))
}

describe('expandedSearch', () => {
  it('finds the nearest stores beyond the 12 one search returns', async () => {
    fakeApple()

    let result = await expandedSearch({ parts: ['A'], location: '10001' }, { limit: 20 })

    assert.deepEqual(storesFound(result.rows), storesWhere((_, i) => i < 20))
    assertSortedByDistance(result.rows)
    assert.ok(result.searchedLocations.length > 1)
    assert.equal(result.truncated, false)
  })

  it('uses only the first search when it holds enough stores', async () => {
    fakeApple()

    let result = await expandedSearch({ parts: ['A'], location: '10001' }, { limit: 10 })

    assert.deepEqual(storesFound(result.rows), storesWhere((_, i) => i < 10))
    assert.equal(result.searchedLocations.length, 1)
  })

  it('finds every store within a radius', async () => {
    fakeApple()

    let result = await expandedSearch({ parts: ['A'], location: '10001' }, { radiusMiles: 10 })

    let expected = storesWhere((s) => s.miles <= 10)
    assert.ok(expected.length > 12)
    assert.deepEqual(storesFound(result.rows), expected)
    assertSortedByDistance(result.rows)
  })

  it('counts searches that apple.com refuses', async () => {
    fakeApple({ refuseStoreSearches: true })

    let result = await expandedSearch({ parts: ['A'], location: '10001' }, { limit: 20 })

    assert.ok(result.failedSearches > 0)
    assert.deepEqual(storesFound(result.rows), storesWhere((_, i) => i < 12))
  })
})
