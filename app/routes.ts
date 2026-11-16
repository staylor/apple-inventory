import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  // The search form submits with GET, so results live at a shareable URL.
  home: get('/'),
})
