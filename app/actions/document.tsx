import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { ImportMap } from 'remix/component/server'

import { scriptEntry } from '../assets.ts'

export interface DocumentProps {
  children?: RemixNode
  title?: string
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, title = 'Pickup Finder' } = handle.props
    let { href, importMap, preloads } = scriptEntry

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <title>{title}</title>
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href}></script>
        </head>
        <body mix={bodyStyle}>{children}</body>
      </html>
    )
  }
}

const bodyStyle = css({
  '--bg': '#f5f5f7',
  '--surface': '#ffffff',
  '--surface-muted': '#f0f0f3',
  '--border': '#d9d9de',
  '--text': '#1d1d1f',
  '--text-muted': '#6e6e73',
  '--accent': '#0071e3',
  '--accent-text': '#ffffff',
  '--accent-soft': '#e8f1fc',
  '--ok': '#1a7f37',
  '--ok-soft': '#e3f4e8',
  '--warn': '#9a6700',
  '--warn-soft': '#fff4d6',
  '--error': '#c4281c',
  '--error-soft': '#fdeceb',
  '@media (prefers-color-scheme: dark)': {
    '--bg': '#111113',
    '--surface': '#1c1c1f',
    '--surface-muted': '#26262a',
    '--border': '#38383d',
    '--text': '#f5f5f7',
    '--text-muted': '#a1a1a6',
    '--accent': '#2997ff',
    '--accent-soft': '#14293f',
    '--ok': '#4ac26b',
    '--ok-soft': '#142a1b',
    '--warn': '#d4a72c',
    '--warn-soft': '#2e2510',
    '--error': '#ff6b5e',
    '--error-soft': '#3a1714',
  },
  '& *, & *::before, & *::after': { boxSizing: 'border-box' },
  margin: 0,
  minHeight: '100vh',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  fontSize: '15px',
  lineHeight: 1.45,
  WebkitFontSmoothing: 'antialiased',
})
