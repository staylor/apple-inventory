import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { catalog, describeModel, findProduct, type Product, type ProductLine } from '../../src/products.ts'
import { routes } from '../routes.ts'
import { Document } from './document.tsx'
import { SearchButton } from './public/search-button.tsx'
import { SEARCH_AREAS, type SearchInput, type SearchResult, type StoreRow } from './search.ts'

interface HomePageProps {
  input: SearchInput
  result?: SearchResult
  error?: string
}

export function HomePage(handle: Handle<HomePageProps>) {
  return () => {
    let { input, result, error } = handle.props
    let title = result ? `Pickup near ${input.location} · Pickup Finder` : 'Pickup Finder'

    return (
      <Document title={title}>
        <main mix={pageStyle}>
          <header mix={css({ marginBottom: '24px' })}>
            <h1 mix={css({ fontSize: '28px', lineHeight: 1.15, margin: '0 0 6px', letterSpacing: '-0.01em' })}>
              Pickup Finder
            </h1>
            <p mix={css({ margin: 0, color: 'var(--text-muted)' })}>
              Check in-store pickup availability at Apple Stores near you.
            </p>
          </header>

          <SearchForm input={input} />

          {error ? (
            <p role="alert" mix={[noticeStyle, css({ background: 'var(--error-soft)', color: 'var(--error)' })]}>
              {error}
            </p>
          ) : null}

          {result ? <Results input={input} result={result} /> : null}
        </main>
      </Document>
    )
  }
}

function SearchForm(handle: Handle<{ input: SearchInput }>) {
  return () => {
    let { input } = handle.props
    let selected = new Set(input.parts)

    return (
      <form method="get" action={routes.home.href()} mix={cardStyle}>
        {catalog.map((line) => (
          <ProductPicker line={line} selected={selected} />
        ))}

        <div mix={controlsRowStyle}>
          <label mix={fieldStyle}>
            <span mix={fieldLabelStyle}>ZIP code or city</span>
            <input
              name="location"
              defaultValue={input.location}
              placeholder="e.g. 10001 or Chicago, IL"
              autoComplete="postal-code"
              required
              mix={inputStyle}
            />
          </label>

          <label mix={fieldStyle}>
            <span mix={fieldLabelStyle}>Search area</span>
            <select name="area" mix={inputStyle}>
              {SEARCH_AREAS.map((area) => (
                <option value={area.value} selected={input.area.value === area.value}>
                  {area.label}
                </option>
              ))}
            </select>
          </label>

          <label mix={checkboxLabelStyle}>
            <input type="checkbox" name="inStock" value="1" defaultChecked={input.inStockOnly} />
            Only stores with stock
          </label>

          <SearchButton />
        </div>
      </form>
    )
  }
}

function ProductPicker(handle: Handle<{ line: ProductLine; selected: Set<string> }>) {
  return () => {
    let { line, selected } = handle.props
    let models = Map.groupBy(line.products, (p) => p.model)
    let selectedCount = line.products.filter((p) => selected.has(p.part)).length

    // Native <details> keeps long product lines out of the way without any
    // browser JavaScript; lines with a selection start open.
    return (
      <details open={selectedCount > 0} mix={detailsStyle}>
        <summary mix={summaryStyle}>
          {line.name}
          <span mix={css({ fontWeight: 400, fontSize: '13px', color: 'var(--text-muted)' })}>
            {selectedCount > 0 ? `${selectedCount} of ${line.products.length} selected` : `${line.products.length} options`}
          </span>
        </summary>
        <fieldset mix={css({ border: 0, margin: 0, padding: '4px 0 6px', minWidth: 0 })}>
          <legend mix={visuallyHiddenStyle}>{line.name}</legend>
          {[...models].map(([model, products]) => (
            <div mix={css({ marginBottom: '12px' })}>
              <div mix={[fieldLabelStyle, css({ marginBottom: '6px' })]}>{model}</div>
              {products.some((p) => p.config) ? (
                <div mix={configGridStyle}>
                  {[...Map.groupBy(products, (p) => p.config ?? '')].flatMap(([config, configProducts]) => [
                    <span mix={configLabelStyle}>{config}</span>,
                    <ColorChips products={configProducts} selected={selected} />,
                  ])}
                </div>
              ) : (
                <ColorChips products={products} selected={selected} />
              )}
            </div>
          ))}
        </fieldset>
      </details>
    )
  }
}

function ColorChips(handle: Handle<{ products: Product[]; selected: Set<string> }>) {
  return () => {
    let { products, selected } = handle.props

    return (
      <div mix={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' })}>
        {products.map((product) => (
          <label mix={chipStyle} title={product.part}>
            <input
              type="checkbox"
              name="part"
              value={product.part}
              defaultChecked={selected.has(product.part)}
              mix={css({ margin: 0, accentColor: 'var(--accent)' })}
            />
            <Swatch color={product.swatch} />
            {product.color}
          </label>
        ))}
      </div>
    )
  }
}

function Results(handle: Handle<{ input: SearchInput; result: SearchResult }>) {
  return () => {
    let { input, result } = handle.props
    let products = input.parts.map(findProduct).filter((p): p is Product => p !== undefined)
    let place = 'miles' in input.area ? `within ${input.area.miles} miles of ${input.location}` : `near ${input.location}`

    return (
      <section aria-labelledby="results-heading" mix={css({ marginTop: '28px' })}>
        <h2 id="results-heading" mix={css({ fontSize: '20px', margin: '0 0 4px' })}>
          {result.stores.length} {result.stores.length === 1 ? 'store' : 'stores'} {place}
        </h2>
        <p mix={css({ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: '13px' })}>
          {input.inStockOnly ? 'Showing only stores with at least one selected product. ' : ''}
          {result.searches > 1 ? `Combined ${result.searches} searches on apple.com.` : ''}
        </p>

        {result.truncated ? (
          <p mix={[noticeStyle, css({ background: 'var(--warn-soft)', color: 'var(--warn)' })]}>
            Stopped after {result.searches} searches, so stores near the edge of the area may be missing.
          </p>
        ) : null}

        {result.failedSearches > 0 ? (
          <p mix={[noticeStyle, css({ background: 'var(--warn-soft)', color: 'var(--warn)' })]}>
            apple.com didn’t answer {result.failedSearches} of the {result.searches} searches, so some stores may be
            missing. Searching again later may fill them in.
          </p>
        ) : null}

        <ul mix={summaryListStyle}>
          {products.map((product) => {
            let count = result.stores.filter((row) => row.parts[product.part]?.available).length
            return (
              <li mix={summaryItemStyle}>
                <Swatch color={product.swatch} />
                <span>
                  <strong>{product.color}</strong>{' '}
                  <span mix={css({ color: 'var(--text-muted)' })}>{describeModel(product)}</span>
                </span>
                <span mix={css({ marginLeft: 'auto', fontWeight: 600, whiteSpace: 'nowrap', color: count > 0 ? 'var(--ok)' : 'var(--text-muted)' })}>
                  {count > 0 ? `${count} ${count === 1 ? 'store' : 'stores'}` : 'None'}
                </span>
              </li>
            )
          })}
        </ul>

        {result.stores.length === 0 ? (
          <p mix={[noticeStyle, css({ background: 'var(--surface-muted)' })]}>
            {input.inStockOnly ? 'No stores in this area have the selected products in stock.' : 'No stores found.'}
          </p>
        ) : (
          <StoreTable products={products} stores={result.stores} />
        )}
      </section>
    )
  }
}

function StoreTable(handle: Handle<{ products: Product[]; stores: StoreRow[] }>) {
  return () => {
    let { products, stores } = handle.props

    return (
      <div mix={tableWrapStyle}>
        <table mix={tableStyle}>
          <thead>
            <tr>
              <th scope="col" mix={[stickyColStyle, css({ background: 'var(--surface-muted)' })]}>
                Store
              </th>
              <th scope="col">Distance</th>
              {products.map((product) => (
                <th scope="col" title={product.part}>
                  <span mix={css({ display: 'inline-flex', alignItems: 'center', gap: '6px' })}>
                    <Swatch color={product.swatch} />
                    {product.color}
                  </span>
                  <span mix={css({ display: 'block', fontWeight: 400, color: 'var(--text-muted)', fontSize: '12px' })}>
                    {describeModel(product)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stores.map((row) => (
              <tr>
                <th scope="row" mix={[stickyColStyle, css({ fontWeight: 400 })]}>
                  <a href={row.store.url} target="_blank" rel="noreferrer" mix={css({ color: 'var(--text)', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } })}>
                    {row.store.name}
                  </a>
                  <span mix={css({ display: 'block', color: 'var(--text-muted)', fontSize: '13px' })}>
                    {row.store.city}, {row.store.state}
                  </span>
                </th>
                <td mix={css({ whiteSpace: 'nowrap', color: 'var(--text-muted)' })}>{row.store.distanceText}</td>
                {products.map((product) => (
                  <td>
                    <Availability status={row.parts[product.part]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
}

function Availability(handle: Handle<{ status?: { available: boolean; quote: string } }>) {
  return () => {
    let { status } = handle.props
    if (!status) return <span mix={css({ color: 'var(--text-muted)' })}>—</span>
    if (!status.available) return <span mix={css({ color: 'var(--text-muted)' })}>Unavailable</span>

    // Apple's quote reads like "Available Today"; keep the part that varies.
    let when = status.quote.replace(/^available\s+/i, '') || 'Available'
    return <span mix={pillOkStyle}>{when}</span>
  }
}

function Swatch(handle: Handle<{ color: string }>) {
  return () => (
    <span
      aria-hidden="true"
      style={{ background: handle.props.color }}
      mix={css({
        display: 'inline-block',
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.35)',
        flex: '0 0 auto',
      })}
    />
  )
}

const pageStyle = css({
  maxWidth: '1040px',
  margin: '0 auto',
  padding: '40px 16px 64px',
})

const cardStyle = css({
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  padding: '20px',
})

const controlsRowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  gap: '12px 16px',
  paddingTop: '16px',
})

const fieldStyle = css({ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 200px', minWidth: 0 })

const fieldLabelStyle = css({ fontSize: '13px', color: 'var(--text-muted)' })

const inputStyle = css({
  font: 'inherit',
  height: '44px',
  padding: '0 12px',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  background: 'var(--surface)',
  color: 'var(--text)',
  width: '100%',
  '&:focus': { outline: '3px solid var(--accent-soft)', borderColor: 'var(--accent)' },
})

const checkboxLabelStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  height: '44px',
  whiteSpace: 'nowrap',
  '& input': { margin: 0, accentColor: 'var(--accent)' },
})

const chipStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 14px 8px 10px',
  border: '1px solid var(--border)',
  borderRadius: '999px',
  background: 'var(--surface)',
  cursor: 'pointer',
  userSelect: 'none',
  '&:has(input:checked)': { borderColor: 'var(--accent)', background: 'var(--accent-soft)' },
  '&:has(input:focus-visible)': { outline: '3px solid var(--accent-soft)', outlineOffset: '1px' },
})

const detailsStyle = css({
  borderBottom: '1px solid var(--border)',
  marginBottom: '16px',
  '&:last-of-type': { marginBottom: 0 },
  // Chevron that rotates when the section is open. Both states live in this
  // one style because each css() style is its own cascade layer.
  '& > summary::before': {
    content: '""',
    width: '7px',
    height: '7px',
    borderRight: '2px solid var(--text-muted)',
    borderBottom: '2px solid var(--text-muted)',
    transform: 'translateY(-3px) rotate(-45deg)',
    transition: 'transform 150ms ease',
    flex: '0 0 auto',
  },
  '&[open] > summary::before': { transform: 'translateY(-5px) rotate(45deg)' },
})

const summaryStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  gap: '10px',
  fontWeight: 600,
  fontSize: '17px',
  padding: '0 0 12px',
  cursor: 'pointer',
  listStyle: 'none',
  '&::-webkit-details-marker': { display: 'none' },
})

// Configuration labels share a column as wide as the longest one, so every
// configuration's colors line up. On phones, each label sits above its colors.
const configGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'fit-content(45%) minmax(0, 1fr)',
  alignItems: 'center',
  gap: '8px 12px',
  '@media (max-width: 560px)': { gridTemplateColumns: 'minmax(0, 1fr)', rowGap: '6px' },
})

const configLabelStyle = css({
  fontSize: '13px',
  fontWeight: 600,
  lineHeight: 1.35,
  color: 'var(--text-muted)',
  '@media (max-width: 560px)': { '&:not(:first-child)': { marginTop: '8px' } },
})

const visuallyHiddenStyle = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
})

const noticeStyle = css({
  margin: '20px 0 0',
  padding: '12px 16px',
  borderRadius: '10px',
})

const summaryListStyle = css({
  listStyle: 'none',
  margin: '0 0 16px',
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: '8px',
})

const summaryItemStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 14px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
})

const tableWrapStyle = css({
  overflowX: 'auto',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
})

const tableStyle = css({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '14px',
  '& th, & td': {
    padding: '10px 14px',
    textAlign: 'left',
    verticalAlign: 'top',
    borderBottom: '1px solid var(--border)',
  },
  '& thead th': {
    fontSize: '13px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    background: 'var(--surface-muted)',
  },
  '& tbody tr:last-child > *': { borderBottom: 0 },
})

const stickyColStyle = css({
  position: 'sticky',
  left: 0,
  background: 'var(--surface)',
  minWidth: '170px',
})

const pillOkStyle = css({
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: '999px',
  background: 'var(--ok-soft)',
  color: 'var(--ok)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
})
