import { createController } from 'remix/router'

import { assets } from '../assets.ts'
import { routes } from '../routes.ts'
import { HomePage } from './home-page.tsx'
import { describeError, parseSearch, runSearch } from './search.ts'

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
    },
    async home(context) {
      let search = parseSearch(context.url.searchParams)

      if (search.kind === 'empty') {
        return context.render(<HomePage input={search.input} />)
      }
      if (search.kind === 'invalid') {
        return context.render(<HomePage input={search.input} error={search.error} />, { status: 400 })
      }

      try {
        let result = await runSearch(search.input)
        return context.render(<HomePage input={search.input} result={result} />)
      } catch (error) {
        console.error('Search failed', error)
        return context.render(<HomePage input={search.input} error={describeError(error)} />, {
          status: 502,
        })
      }
    },
  },
})
