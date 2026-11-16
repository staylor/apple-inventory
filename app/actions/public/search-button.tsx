import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

// Hydrated so it can show progress: wider-radius searches make several
// requests to apple.com and can take a few seconds. Pending state follows the
// frame's reload events, so it resets whenever the results render, including
// validation errors and failures.
export const SearchButton = clientEntry(import.meta.url, function SearchButton(handle: Handle) {
  let pending = false

  handle.frame.addEventListener(
    'reloadStart',
    () => {
      pending = true
      handle.update()
    },
    { signal: handle.signal },
  )
  handle.frame.addEventListener(
    'reloadComplete',
    () => {
      pending = false
      handle.update()
    },
    { signal: handle.signal },
  )

  return () => (
    <button type="submit" disabled={pending} aria-busy={pending} mix={buttonStyle}>
      {pending ? 'Searching…' : 'Search stores'}
    </button>
  )
})

const buttonStyle = css({
  appearance: 'none',
  font: 'inherit',
  fontWeight: 600,
  height: '44px',
  padding: '0 22px',
  border: 0,
  borderRadius: '10px',
  background: 'var(--accent)',
  color: 'var(--accent-text)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  '&:hover': { filter: 'brightness(1.08)' },
  '&:focus-visible': { outline: '3px solid var(--accent-soft)', outlineOffset: '2px' },
  '&:disabled': { cursor: 'progress', opacity: 0.7 },
})
