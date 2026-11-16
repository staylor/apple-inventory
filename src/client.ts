import type {
  Availability,
  PickupMessageResponse,
  QueryOptions,
  RawStore,
} from "./types.ts";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

export class AppleApiError extends Error {
  /** HTTP status, when apple.com answered with an error */
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export function buildUrl(opts: QueryOptions): string {
  if (opts.parts.length === 0) throw new AppleApiError("At least one part number is required");
  if (!opts.location && !opts.store) throw new AppleApiError("Either a location or a store is required");

  const prefix = opts.country ? `/${opts.country}` : "";
  const url = new URL(`https://www.apple.com${prefix}/shop/retail/pickup-message`);
  url.searchParams.set("pl", "true");
  opts.parts.forEach((part, i) => url.searchParams.set(`parts.${i}`, part));
  if (opts.location) url.searchParams.set("location", opts.location);
  if (opts.store) url.searchParams.set("store", opts.store);
  return url.toString();
}

export async function fetchPickupMessage(
  opts: QueryOptions,
  { timeoutMs = 15_000 }: { timeoutMs?: number } = {},
): Promise<PickupMessageResponse> {
  const res = await fetch(buildUrl(opts), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new AppleApiError(`Apple returned HTTP ${res.status} ${res.statusText}`, res.status);
  }
  const data = (await res.json()) as PickupMessageResponse;
  if (data.body.errorMessage && !data.body.stores) {
    throw new AppleApiError(`Apple: ${data.body.errorMessage} (${opts.parts.join(", ")})`);
  }
  return data;
}

/**
 * Apple answers for at most this many parts per request and silently drops
 * the rest, so larger queries are split up and merged.
 */
export const MAX_PARTS_PER_REQUEST = 20;

/**
 * Fetch the stores near a location with availability for every requested
 * part, splitting the parts across as many requests as needed.
 */
export async function fetchStores(opts: QueryOptions): Promise<RawStore[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < opts.parts.length; i += MAX_PARTS_PER_REQUEST) {
    chunks.push(opts.parts.slice(i, i + MAX_PARTS_PER_REQUEST));
  }
  const responses = await Promise.all(chunks.map((parts) => fetchPickupMessage({ ...opts, parts })));

  // Every chunk searches the same location, so the stores match; merge each
  // store's per-part availability into the first response's store list.
  const merged = new Map<string, RawStore>();
  for (const response of responses) {
    for (const store of response.body.stores ?? []) {
      const existing = merged.get(store.storeNumber);
      if (existing) {
        existing.partsAvailability = { ...existing.partsAvailability, ...store.partsAvailability };
      } else {
        merged.set(store.storeNumber, { ...store, partsAvailability: { ...store.partsAvailability } });
      }
    }
  }
  return [...merged.values()];
}

export function normalize(stores: RawStore[]): Availability[] {
  const rows: Availability[] = [];
  for (const s of stores) {
    for (const p of Object.values(s.partsAvailability ?? {})) {
      rows.push({
        partNumber: p.partNumber,
        productTitle: p.messageTypes?.regular?.storePickupProductTitle ?? p.partNumber,
        available: p.pickupDisplay === "available",
        status: p.pickupDisplay,
        quote: p.pickupSearchQuote,
        store: {
          number: s.storeNumber,
          name: s.storeName,
          city: s.city,
          state: s.state,
          distance: s.storedistance,
          distanceText: s.storeDistanceWithUnit,
          phone: s.phoneNumber,
          url: s.reservationUrl,
        },
      });
    }
  }
  return rows;
}

/** Fetch and normalize availability for the given parts near a location/store. */
export async function checkAvailability(opts: QueryOptions): Promise<Availability[]> {
  return normalize(await fetchStores(opts));
}
