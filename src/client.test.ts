import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { MAX_PARTS_PER_REQUEST, fetchStores } from './client.ts'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

/** Fake Apple endpoint: like the real one, it ignores parts past the 20th. */
function fakeApple(requests: string[][]) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    let url = new URL(String(input))
    let parts = [...url.searchParams].filter(([key]) => key.startsWith('parts.')).map(([, value]) => value)
    requests.push(parts)
    let partsAvailability = Object.fromEntries(
      parts.slice(0, MAX_PARTS_PER_REQUEST).map((part) => [part, { partNumber: part, pickupDisplay: 'available' }]),
    )
    let stores = ['R001', 'R002'].map((storeNumber) => ({ storeNumber, partsAvailability }))
    return Response.json({ head: { status: '200', data: {} }, body: { stores } })
  }) as typeof fetch
}

describe('fetchStores', () => {
  it('splits large part lists so Apple answers for every part', async () => {
    let requests: string[][] = []
    fakeApple(requests)
    let parts = Array.from({ length: 45 }, (_, i) => `PART${i}`)

    let stores = await fetchStores({ parts, location: '10001' })

    assert.deepEqual(requests.map((r) => r.length), [20, 20, 5])
    assert.equal(stores.length, 2)
    for (let store of stores) {
      assert.deepEqual(Object.keys(store.partsAvailability).sort(), [...parts].sort())
    }
  })

  it('makes a single request for small part lists', async () => {
    let requests: string[][] = []
    fakeApple(requests)

    await fetchStores({ parts: ['A', 'B'], location: '10001' })

    assert.equal(requests.length, 1)
  })
})
