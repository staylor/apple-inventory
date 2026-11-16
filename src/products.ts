// Products the UI offers, grouped by product line.
// Part numbers come from the product's "Buy" page on apple.com (US store).
// To add a product line, append an entry to `catalog`.

export interface Product {
  part: string;
  /** Model within the product line, e.g. "HomeView (Wall Mounted)" */
  model: string;
  /** Configuration within the model, e.g. "256GB" or "M5 Pro, 24GB, 1TB" (optional) */
  config?: string;
  /** Finish / color name as Apple lists it */
  color: string;
  /** CSS color used for the swatch in the UI */
  swatch: string;
}

export interface ProductLine {
  id: string;
  name: string;
  /** Where the part numbers were collected from */
  source: string;
  products: Product[];
}

export const catalog: ProductLine[] = [
  {
    id: "homeview",
    name: "HomeView",
    source: "https://www.apple.com/shop/buy-home/apple-homeview",
    products: [
      { part: "MDH14LL/A", model: "HomeView", color: "Silver", swatch: "#e3e4e5" },
      { part: "MDH24LL/A", model: "HomeView", color: "Space Gray", swatch: "#7d7e80" },
      { part: "MDH34LL/A", model: "HomeView", color: "Starlight", swatch: "#f0e4d3" },
      { part: "MDH44LL/A", model: "HomeView", color: "Rose Pink", swatch: "#f1c6c8" },
      { part: "MDV64LL/A", model: "HomeView (Wall Mounted)", color: "Silver", swatch: "#e3e4e5" },
      { part: "MDV74LL/A", model: "HomeView (Wall Mounted)", color: "Space Gray", swatch: "#7d7e80" },
    ],
  },
  {
    id: "iphone-duo",
    name: "iPhone Duo",
    source: "https://www.apple.com/shop/buy-iphone/iphone-duo",
    // The Buy page lists every configuration once per carrier, but carriers
    // share one part number and don't change in-store pickup availability.
    products: [
      { part: "MK1E4LL/A", model: "iPhone Duo", config: "256GB", color: "Star White", swatch: "#f2f1ec" },
      { part: "MK1F4LL/A", model: "iPhone Duo", config: "256GB", color: "Night Sky", swatch: "#2b3040" },
      { part: "MK1G4LL/A", model: "iPhone Duo", config: "512GB", color: "Star White", swatch: "#f2f1ec" },
      { part: "MK1H4LL/A", model: "iPhone Duo", config: "512GB", color: "Night Sky", swatch: "#2b3040" },
      { part: "MK1J4LL/A", model: "iPhone Duo", config: "1TB", color: "Star White", swatch: "#f2f1ec" },
      { part: "MK1L4LL/A", model: "iPhone Duo", config: "1TB", color: "Night Sky", swatch: "#2b3040" },
      { part: "MK1Q4LL/A", model: "iPhone Duo", config: "2TB", color: "Star White", swatch: "#f2f1ec" },
      { part: "MK1R4LL/A", model: "iPhone Duo", config: "2TB", color: "Night Sky", swatch: "#2b3040" },
    ],
  },
  {
    id: "macbook-pro-proled-xdr",
    name: "MacBook Pro with PROLED XDR Display",
    source: "https://www.apple.com/shop/buy-mac/macbook-pro-proled-xdr",
    // Only the configurations stores stock have part numbers. Nano-texture is
    // a built-to-order option on all but MJ9X4LL/A, and the endpoint can't
    // check built-to-order Macs (see "Finding part numbers" in the README).
    products: [
      { part: "MJ2G4LL/A", model: "14-inch MacBook Pro", config: "M5 Pro, 24GB, 1TB", color: "Silver", swatch: "#e3e4e5" },
      { part: "MJ2K4LL/A", model: "14-inch MacBook Pro", config: "M5 Pro, 24GB, 1TB", color: "Space Black", swatch: "#393839" },
      { part: "MJ9X4LL/A", model: "14-inch MacBook Pro", config: "M5 Pro, 24GB, 1TB", color: "Space Black, nano-texture", swatch: "#393839" },
      { part: "MJ2J4LL/A", model: "14-inch MacBook Pro", config: "M5 Max, 36GB, 2TB", color: "Silver", swatch: "#e3e4e5" },
      { part: "MJ2M4LL/A", model: "14-inch MacBook Pro", config: "M5 Max, 36GB, 2TB", color: "Space Black", swatch: "#393839" },
      { part: "MJ2W4LL/A", model: "16-inch MacBook Pro", config: "M5 Pro, 24GB, 1TB", color: "Silver", swatch: "#e3e4e5" },
      { part: "MJ304LL/A", model: "16-inch MacBook Pro", config: "M5 Pro, 24GB, 1TB", color: "Space Black", swatch: "#393839" },
      { part: "MJ2X4LL/A", model: "16-inch MacBook Pro", config: "M5 Max, 36GB, 2TB", color: "Silver", swatch: "#e3e4e5" },
      { part: "MJ314LL/A", model: "16-inch MacBook Pro", config: "M5 Max, 36GB, 2TB", color: "Space Black", swatch: "#393839" },
      { part: "MJ2Y4LL/A", model: "16-inch MacBook Pro", config: "M5 Max, 48GB, 2TB", color: "Silver", swatch: "#e3e4e5" },
      { part: "MJ334LL/A", model: "16-inch MacBook Pro", config: "M5 Max, 48GB, 2TB", color: "Space Black", swatch: "#393839" },
    ],
  },
];

const byPart = new Map(catalog.flatMap((line) => line.products.map((p) => [p.part, p] as const)));

export function findProduct(part: string): Product | undefined {
  return byPart.get(part);
}

/** "14-inch MacBook Pro M5 Pro, 24GB, 1TB" — everything but the color. */
export function describeModel(product: Product): string {
  return product.config ? `${product.model} ${product.config}` : product.model;
}
