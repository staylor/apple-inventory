import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { AppleApiError } from '../../src/client.ts'
import { catalog } from '../../src/products.ts'
import { router } from '../router.ts'
import { routes } from '../routes.ts'
import { describeError, parseSearch } from './search.ts'

// These tests cover everything up to the apple.com request; none of them hit the network.

function get(search = '') {
  return router.fetch(new URL(routes.home.href() + search, 'http://localhost'))
}

describe('home page', () => {
  it('renders every catalog product, with the first product line selected', async () => {
    let response = await get()
    let html = await response.text()

    assert.equal(response.status, 200)
    for (let [index, line] of catalog.entries()) {
      for (let product of line.products) {
        let checked = new RegExp(`value="${product.part}"[^>]*checked`)
        assert.match(html, new RegExp(`value="${product.part}"`))
        if (index === 0) assert.match(html, checked)
        else assert.doesNotMatch(html, checked)
      }
    }
  })

  it('asks for a location when it is blank', async () => {
    let response = await get('?location=&part=MDV64LL/A')

    assert.equal(response.status, 400)
    assert.match(await response.text(), /Enter a ZIP code/)
  })

  it('asks for a product when none are selected', async () => {
    let response = await get('?location=10001')

    assert.equal(response.status, 400)
    assert.match(await response.text(), /Choose at least one product/)
  })
})

describe('parseSearch', () => {
  it('ignores part numbers that are not in the catalog', () => {
    let search = parseSearch(new URLSearchParams('location=10001&part=BOGUS/A&part=MDV64LL/A'))

    assert.equal(search.kind, 'valid')
    assert.deepEqual(search.input.parts, ['MDV64LL/A'])
  })

  it('only accepts the offered search areas', () => {
    let area = (value: string) =>
      parseSearch(new URLSearchParams(`location=10001&part=MDV64LL/A&area=${value}`)).input.area.value

    assert.equal(area('nearest-20'), 'nearest-20')
    assert.equal(area('within-100'), 'within-100')
    assert.equal(area('within-5000'), 'nearest-12')
    assert.equal(area(''), 'nearest-12')
  })

  it('still reads links that use the old radius parameter', () => {
    let search = parseSearch(new URLSearchParams('location=10001&part=MDV64LL/A&radius=50'))

    assert.equal(search.input.area.value, 'within-50')
  })
})

describe('describeError', () => {
  it('explains when apple.com is turning requests away', () => {
    assert.match(describeError(new AppleApiError('Apple returned HTTP 541 Unknown', 541)), /turning away requests/)
    assert.equal(describeError(new AppleApiError('Apple returned HTTP 500', 500)), 'Apple returned HTTP 500')
  })
})
