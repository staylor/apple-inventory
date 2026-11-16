# apple-inventory

Check Apple Store in-store pickup availability using Apple's
`https://www.apple.com/shop/retail/pickup-message` endpoint. There's a web UI
(Remix 3) and a command-line tool, sharing the same code in `src/`.

Requires Node 24.3+ (`nvm use` picks it up from `.nvmrc`).

## Setup

```sh
nvm use
pnpm install
```

## Web UI

```sh
pnpm dev      # http://localhost:44100, restarts on server changes
pnpm hmr      # same, with hot reloading in the browser
pnpm start    # production mode
pnpm test     # route and validation tests (no network)
```

Pick products, enter a ZIP code or city, and choose how far to search: the
nearest 12 or 20 stores, or every store within 25 to 200 miles. The search
form uses GET, so every result page has a URL you can bookmark or share.

The products offered come from `src/products.ts`. To add a product line, add an
entry to `catalog` with part numbers from the product's Buy page on
apple.com (see "Finding part numbers" below).

## Command line

```sh
# Stores near a ZIP code
pnpm cli -p MX2D3AM/A -l 10001

# Several products, only stores where they're in stock, within 10 miles
pnpm cli -p MX2D3AM/A,MXK53AM/A -l 94103 --available --radius 10

# One specific store, JSON output
pnpm cli -p MX2D3AM/A -s R250 --json

# Every store within 100 miles (see "Search radius" below)
pnpm cli -p MX2D3AM/A -l 10001 --radius 100 --available

# Poll every 60s and beep when a product becomes available somewhere new
pnpm cli -p MX2D3AM/A -l 10001 --available --watch 60
```

Run `pnpm cli --help` for all options.

## Layout

- `src/` — Apple API client (`client.ts`), radius expansion (`expand.ts`),
  product catalog (`products.ts`), and the CLI (`cli.ts`)
- `server.ts`, `app/` — Remix web app. `app/routes.ts` defines URLs,
  `app/actions/controller.tsx` handles the search, `app/actions/home-page.tsx`
  renders it. Browser code lives only in `app/actions/public/`.

## Search radius

Apple's endpoint only returns the ~12 stores nearest the searched location
(about 12 miles in Manhattan, but 75+ miles in rural areas). When `--radius` is
larger than that, the tool searches again from the ZIP codes of stores near the
edge of what it has found, merges the results, and repeats until the radius is
covered. Distances are recalculated from your original location.

This uses up to `--max-searches` requests (default 25). A 100-mile search
around New York City finds about 40 stores in about 5 seconds. If the limit is
reached first, it prints a warning. With `--watch`, the first check works out
which locations to search, and later checks reuse that list.

The web UI's "Nearest 20 stores" option crawls the same way, but only until no
store it hasn't found could be closer than the 20th it has. Around New York
City that takes about 12 searches (about 4 seconds), versus one search for the
nearest 12. If apple.com doesn't answer some of the searches, the results say
so, since stores may be missing.

## Finding part numbers

Part numbers look like `MX2D3AM/A` or `MDV64LL/A`. The product's Buy page on
apple.com (for example `/shop/buy-home/apple-homeview`) includes them in its
page source as `"partNumber":"…"`. Ignore AppleCare part numbers (they start
with `S`). You can confirm what a part number is with the CLI: the product
name appears in its output.

iPhone Buy pages list each configuration once per carrier (AT&T, T-Mobile,
Verizon, unlocked), but the carriers share one part number, and the carrier
doesn't affect in-store pickup availability, so add one entry per storage and
color.

Mac Buy pages list the configurations that stores stock as
`"btrOrFdPartNumber":"…"`. Everything else is built to order, including the
nano-texture display on every MacBook Pro configuration except one
(`MJ9X4LL/A`). The endpoint accepts a built-to-order configuration (a base model
such as `Z1UY` in `parts.N`, with its option codes in `option.N`), but reports
it as "Currently unavailable" at every store, and gives the same answer for
made-up option codes, so the catalog leaves those configurations out.

Pickup results only give a Mac's size and color. To see a part number's chip,
memory, and storage, open `https://www.apple.com/shop/product/<part number>`,
which redirects to a Buy page titled with the full configuration.

## Using as a library

```ts
import { checkAvailability } from "./src/client.ts";

const rows = await checkAvailability({ parts: ["MX2D3AM/A"], location: "10001" });
console.log(rows.filter((r) => r.available));
```

## Notes

Apple answers for at most 20 part numbers per request and silently ignores the
rest, so searches with more parts are split into groups of 20 and merged. Each
group is a separate request, and with `--radius` that multiplies by the number
of locations searched.

This is an undocumented Apple endpoint. It may change or rate-limit you, so keep
`--watch` intervals reasonable (the CLI enforces a minimum of 10 seconds). After
a burst of a few hundred requests in a few minutes, Apple answered HTTP 541 to
every request from the same network for about half an hour.
