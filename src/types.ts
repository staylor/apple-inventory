// Shapes of the parts of the pickup-message response we use.
// The real payload contains many more fields; only the relevant ones are typed.

export interface PickupMessageResponse {
  head: { status: string; data: Record<string, unknown> };
  body: {
    stores?: RawStore[];
    errorMessage?: string;
    location?: string;
    storesCount?: number;
  };
}

export interface RawStore {
  storeName: string;
  storeNumber: string;
  city: string;
  state: string;
  country: string;
  phoneNumber: string;
  storedistance: number;
  storeDistanceWithUnit: string;
  storelatitude: number;
  storelongitude: number;
  reservationUrl: string;
  address: { address: string; address2: string | null; postalCode: string };
  partsAvailability: Record<string, RawPartAvailability>;
}

export interface RawPartAvailability {
  partNumber: string;
  storePickEligible: boolean;
  /** e.g. "available", "unavailable", "ineligible" */
  pickupDisplay: string;
  /** e.g. "Available Today", "Currently unavailable" */
  pickupSearchQuote: string;
  pickupType: string;
  messageTypes?: {
    regular?: {
      storePickupQuote?: string;
      storePickupProductTitle?: string;
    };
  };
}

/** Normalized result: one row per (store, part). */
export interface Availability {
  partNumber: string;
  productTitle: string;
  available: boolean;
  status: string;
  quote: string;
  store: {
    number: string;
    name: string;
    city: string;
    state: string;
    distance: number;
    distanceText: string;
    phone: string;
    url: string;
  };
}

export interface QueryOptions {
  /** Part numbers, e.g. "MX2D3AM/A" */
  parts: string[];
  /** ZIP / postal code or "City, ST" */
  location?: string;
  /** Specific store number, e.g. "R250" */
  store?: string;
  /** Country path segment, e.g. "" for US, "uk", "ca" */
  country?: string;
}
