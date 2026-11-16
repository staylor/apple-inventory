// Apple's pickup-message endpoint only ever returns the ~12 stores nearest to
// the searched location. To cover a larger radius, or find more stores, we
// "crawl" outward: search again from the postal codes of stores near the edge
// of what we've found, merge the results, and repeat until the requested
// radius is covered or the requested number of nearest stores is certain.

import { fetchStores, normalize } from "./client.ts";
import type { Availability, QueryOptions, RawStore } from "./types.ts";

export interface ExpandOptions {
  /** Find every store within this many miles of `location`. */
  radiusMiles?: number;
  /** Return only this many stores, nearest first (with or without a radius). */
  limit?: number;
  /** Upper bound on the number of API requests (including the first one). */
  maxSearches?: number;
  /** Parallel requests. Keep this low to be polite to apple.com. */
  concurrency?: number;
  /** Called after each search, for progress reporting. */
  onProgress?: (done: number, storesFound: number) => void;
}

export interface ExpandResult {
  rows: Availability[];
  /** Locations that were searched; pass to `searchLocations` to re-check cheaply. */
  searchedLocations: string[];
  /** True if `maxSearches` was hit before the search was complete. */
  truncated: boolean;
  /** Searches after the first that failed (e.g. apple.com refused them); stores may be missing. */
  failedSearches: number;
}

interface Point {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

const storePoint = (s: RawStore): Point => ({ lat: s.storelatitude, lon: s.storelongitude });

/**
 * The API doesn't tell us the coordinates of the searched location, only each
 * store's coordinates and distance from it. Recover the origin by finding the
 * point whose distances to the stores best match what Apple reported.
 */
function estimateOrigin(stores: RawStore[]): Point {
  const cost = (p: Point) =>
    stores.reduce((sum, s) => sum + (haversineMiles(p, storePoint(s)) - s.storedistance) ** 2, 0);

  let best = storePoint(stores[0]);
  let bestCost = cost(best);
  for (let step = 1; step > 0.0005; step /= 2) {
    let improved = true;
    while (improved) {
      improved = false;
      for (const [dLat, dLon] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const candidate = { lat: best.lat + dLat, lon: best.lon + dLon };
        const c = cost(candidate);
        if (c < bestCost) {
          best = candidate;
          bestCost = c;
          improved = true;
        }
      }
    }
  }
  return best;
}

interface Search {
  center: Point;
  /** Distance to the farthest store returned. Every store closer than this was returned. */
  reach: number;
}

export async function expandedSearch(query: QueryOptions, opts: ExpandOptions): Promise<ExpandResult> {
  if (!query.location) throw new Error("Expanding the search requires a location");
  const { radiusMiles = Infinity, limit = Infinity, maxSearches = 25, concurrency = 3, onProgress } = opts;
  if (radiusMiles === Infinity && limit === Infinity) throw new Error("Expanding the search requires a radius or a limit");

  const first = await fetchStores(query);
  if (first.length === 0) {
    return { rows: [], searchedLocations: [query.location], truncated: false, failedSearches: 0 };
  }

  const origin = estimateOrigin(first);
  const stores = new Map<string, RawStore>(first.map((s) => [s.storeNumber, s]));
  const searches: Search[] = [{ center: origin, reach: Math.max(...first.map((s) => s.storedistance)) }];
  const searchedLocations = [query.location];
  const searchedStores = new Set<string>();
  onProgress?.(1, stores.size);

  const distanceFromOrigin = (s: RawStore) => haversineMiles(origin, storePoint(s));
  // A search centered on a store deep inside an earlier search's area can't
  // reveal anything new, so only search from stores near the edge.
  const isInterior = (s: RawStore) =>
    searches.some((q) => haversineMiles(q.center, storePoint(s)) < q.reach / 2);
  // Apple's first answer holds the stores nearest the location, so it's
  // enough on its own when it reaches the radius or holds `limit` stores.
  const firstSearchIsEnough = () => searches[0].reach >= radiusMiles || first.length >= limit;
  // How far out an unfound store could still matter: the radius, or with a
  // limit, the distance to the limit-th nearest store found so far (which
  // finding more stores can only lower).
  const coverMiles = () => {
    const distances = [...stores.values()].map(distanceFromOrigin).sort((a, b) => a - b);
    return Math.min(radiusMiles, distances[limit - 1] ?? Infinity);
  };

  let truncated = false;
  let failedSearches = 0;
  while (!firstSearchIsEnough()) {
    const cover = coverMiles();
    const frontier = [...stores.values()]
      .filter((s) => !searchedStores.has(s.storeNumber) && distanceFromOrigin(s) <= cover && !isInterior(s))
      .sort((a, b) => distanceFromOrigin(b) - distanceFromOrigin(a));
    if (frontier.length === 0) break;

    const remaining = maxSearches - searchedLocations.length - failedSearches;
    if (remaining <= 0) {
      truncated = true;
      break;
    }

    const batch = frontier.slice(0, Math.min(concurrency, remaining));
    batch.forEach((s) => searchedStores.add(s.storeNumber));
    const results = await Promise.allSettled(
      batch.map((s) => fetchStores({ ...query, location: s.address.postalCode })),
    );

    results.forEach((result, i) => {
      if (result.status !== "fulfilled") {
        failedSearches++;
        return;
      }
      const found = result.value;
      searchedLocations.push(batch[i].address.postalCode);
      if (found.length === 0) return;
      searches.push({ center: storePoint(batch[i]), reach: Math.max(...found.map((s) => s.storedistance)) });
      for (const s of found) if (!stores.has(s.storeNumber)) stores.set(s.storeNumber, s);
    });
    onProgress?.(searchedLocations.length, stores.size);
  }

  return { rows: toRows([...stores.values()], origin, radiusMiles, limit), searchedLocations, truncated, failedSearches };
}

/** Re-run a previously planned set of searches (e.g. on each tick of --watch). */
export async function searchLocations(
  query: QueryOptions,
  locations: string[],
  radiusMiles: number,
  concurrency = 3,
): Promise<Availability[]> {
  const stores = new Map<string, RawStore>();
  let origin: Point | undefined;
  for (let i = 0; i < locations.length; i += concurrency) {
    const batch = locations.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((location) => fetchStores({ ...query, location })));
    results.forEach((r, j) => {
      const found = r;
      if (i + j === 0 && found.length > 0) origin = estimateOrigin(found);
      for (const s of found) if (!stores.has(s.storeNumber)) stores.set(s.storeNumber, s);
    });
  }
  return origin ? toRows([...stores.values()], origin, radiusMiles) : [];
}

function toRows(stores: RawStore[], origin: Point, radiusMiles: number, limit = Infinity): Availability[] {
  // Replace each store's distance (relative to whichever search found it)
  // with its distance from the original location. Sort before rounding, so
  // the limit keeps the truly nearest stores.
  const nearest = stores
    .map((store) => ({ store, miles: haversineMiles(origin, storePoint(store)) }))
    .filter(({ miles }) => miles <= radiusMiles)
    .sort((a, b) => a.miles - b.miles)
    .slice(0, limit)
    .map(({ store, miles }) => {
      const d = Math.round(miles * 10) / 10;
      return { ...store, storedistance: d, storeDistanceWithUnit: `${d} mi` };
    });
  return normalize(nearest);
}
