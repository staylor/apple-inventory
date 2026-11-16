#!/usr/bin/env node
import { parseArgs } from "node:util";
import { checkAvailability } from "./client.ts";
import { expandedSearch, searchLocations } from "./expand.ts";
import type { Availability } from "./types.ts";

const HELP = `Usage: apple-inventory --part <PART> [--part <PART> ...] (--location <ZIP> | --store <R###>) [options]

Check Apple Store in-store pickup availability.

Options:
  -p, --part <part>        Part number, e.g. MX2D3AM/A (repeatable, or comma-separated)
  -l, --location <loc>     ZIP / postal code or "City, ST" to search near
  -s, --store <store>      Specific store number, e.g. R250
  -c, --country <code>     Apple country path, e.g. uk, ca, au (default: US)
  -a, --available          Only show stores where the product is available
  -r, --radius <miles>     Search all stores within this distance of --location.
                           Apple only returns the ~12 nearest stores per search, so
                           larger radii are covered by searching from several points.
      --max-searches <n>   Cap on API requests used to cover --radius (default 25)
  -w, --watch <seconds>    Re-check every N seconds; prints when availability appears
      --json               Output JSON instead of a table
  -h, --help               Show this help

Examples:
  pnpm cli -p MX2D3AM/A -l 10001
  pnpm cli -p MX2D3AM/A,MXK53AM/A -l 94103 --available
  pnpm cli -p MX2D3AM/A -l 10001 --radius 100
  pnpm cli -p MX2D3AM/A -l 10001 --watch 60
`;

const { values } = parseArgs({
  options: {
    part: { type: "string", short: "p", multiple: true },
    location: { type: "string", short: "l" },
    store: { type: "string", short: "s" },
    country: { type: "string", short: "c" },
    available: { type: "boolean", short: "a", default: false },
    radius: { type: "string", short: "r" },
    "max-searches": { type: "string", default: "25" },
    watch: { type: "string", short: "w" },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help || !values.part?.length || (!values.location && !values.store)) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

const parts = values.part.flatMap((p) => p.split(",")).map((p) => p.trim().toUpperCase()).filter(Boolean);
const radius = values.radius ? Number(values.radius) : undefined;
const maxSearches = Number(values["max-searches"]);
const watchSeconds = values.watch ? Number(values.watch) : undefined;

if (radius !== undefined && Number.isNaN(radius)) fail("--radius must be a number");
if (!(maxSearches >= 1)) fail("--max-searches must be a number >= 1");
if (watchSeconds !== undefined && !(watchSeconds >= 10)) fail("--watch must be a number >= 10 seconds");

function fail(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function filterRows(rows: Availability[]): Availability[] {
  return rows.filter(
    (r) => (!values.available || r.available) && (radius === undefined || r.store.distance <= radius),
  );
}

function printTable(rows: Availability[]): void {
  if (rows.length === 0) {
    console.log("No matching stores.");
    return;
  }
  const byPart = new Map<string, Availability[]>();
  for (const r of rows) byPart.set(r.partNumber, [...(byPart.get(r.partNumber) ?? []), r]);

  for (const [part, list] of byPart) {
    const availableCount = list.filter((r) => r.available).length;
    console.log(`\n${list[0].productTitle} (${part}) — available at ${availableCount}/${list.length} stores`);
    console.table(
      list.map((r) => ({
        Store: `${r.store.name} (${r.store.number})`,
        Location: `${r.store.city}, ${r.store.state}`,
        Distance: r.store.distanceText,
        Status: `${r.available ? "✅" : "❌"} ${r.quote}`,
      })),
    );
  }
}

const query = { parts, location: values.location, store: values.store, country: values.country };
/** Search locations discovered by the first expanded search, reused on later --watch ticks. */
let plannedLocations: string[] | undefined;

async function fetchRows(): Promise<Availability[]> {
  if (radius === undefined || !values.location || values.store) return checkAvailability(query);
  if (plannedLocations) return searchLocations(query, plannedLocations, radius);

  const result = await expandedSearch(query, {
    radiusMiles: radius,
    maxSearches,
    onProgress: (done, found) => process.stderr.write(`\rSearched ${done} location(s), found ${found} store(s)...`),
  });
  process.stderr.write("\n");
  if (result.truncated) {
    console.error(`Warning: stopped after ${maxSearches} searches; stores near the edge of ${radius} mi may be missing (raise --max-searches).`);
  }
  if (result.failedSearches > 0) {
    console.error(`Warning: apple.com didn't answer ${result.failedSearches} search(es); some stores may be missing.`);
  }
  plannedLocations = result.searchedLocations;
  return result.rows;
}

async function runOnce(): Promise<Availability[]> {
  const rows = filterRows(await fetchRows());
  if (values.json) console.log(JSON.stringify(rows, null, 2));
  else printTable(rows);
  return rows;
}

async function watch(seconds: number): Promise<void> {
  const seen = new Set<string>();
  for (;;) {
    console.log(`\n[${new Date().toLocaleTimeString()}] Checking...`);
    try {
      const rows = await runOnce();
      for (const r of rows.filter((r) => r.available)) {
        const key = `${r.partNumber}@${r.store.number}`;
        if (!seen.has(key)) {
          seen.add(key);
          console.log(`\u0007🔔 NEW: ${r.productTitle} available at ${r.store.name} (${r.store.distanceText})`);
        }
      }
    } catch (err) {
      console.error(`Check failed: ${(err as Error).message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}

try {
  if (watchSeconds) await watch(watchSeconds);
  else await runOnce();
} catch (err) {
  fail((err as Error).message);
}
