/**
 * 🔴🔴 PLACEHOLDER SUPPLIERS FOR A CLIENT DEMO — NOT REAL COMPANIES.
 *
 * The owner asked for these on 2026-09-27 ("do it for now its client request")
 * after a red alert. Recording the alert and the safeguard, because the risk is
 * real and the next person to touch this must see it:
 *
 * 🔴 **This page's standing rule is that it states nothing it cannot back.** It
 * is why the design's six invented testimonials were never built
 * (`docs/Client-Requests.md` §4.2). Fabricated COMPANIES are that same problem
 * one step further: a visitor reading these would believe they are verified
 * businesses on this platform. On a marketplace whose entire product is trust,
 * shipping them to real buyers would be the worst thing this page could do.
 *
 * 🔴 **THE SAFEGUARD — do not remove it.** Three things must ALL be true before
 * any of this renders:
 *   1. `VITE_DEMO_SUPPLIERS` is exactly `'true'` — it is unset everywhere by
 *      default, so a production build shows none of this;
 *   2. the real featured-suppliers list came back EMPTY — real data always wins;
 *   3. the caller asked for the fallback (`demoSuppliers()` is not imported
 *      anywhere else).
 *
 * 🔴 **Before launch this file and its flag must be deleted**, along with the
 * `?? demoSuppliers()` in `Landing.jsx`. Logged in `docs/UiWebNotes.md`.
 *
 * The names are deliberately generic sector names rather than anything that
 * could collide with a real Indian exporter's trading name.
 */
export const DEMO_SUPPLIERS_ON = import.meta.env.VITE_DEMO_SUPPLIERS === 'true';

const DEMO = [
  {
    id: 'demo-1',
    slug: 'demo-northfield-spice-exports',
    name: 'Northfield Spice Exports',
    country: 'IN',
    entityType: 'business',
    description:
      'Turmeric, cumin and chilli in bulk, graded and packed to order. Ships from Kochi with certificates of origin on every consignment.',
    logo: null,
    verified: true,
    productCount: 42,
    establishedYear: 2014,
  },
  {
    id: 'demo-2',
    slug: 'demo-mehta-textile-mills',
    name: 'Mehta Textile Mills',
    country: 'IN',
    entityType: 'business',
    description:
      'Woven cotton and blended fabric by the roll — 90 to 320 GSM, widths to 120 inches, dyed to a reference swatch.',
    logo: null,
    verified: true,
    productCount: 67,
    establishedYear: 2009,
  },
  {
    id: 'demo-3',
    slug: 'demo-sanghvi-apparel-works',
    name: 'Sanghvi Apparel Works',
    country: 'IN',
    entityType: 'business',
    description:
      'Ready-made knitwear and shirting, cut and stitched in house. Minimum runs from 500 pieces per size break.',
    logo: null,
    verified: true,
    productCount: 28,
    establishedYear: 2017,
  },
  {
    id: 'demo-4',
    slug: 'demo-coastal-marine-foods',
    name: 'Coastal Marine Foods',
    country: 'IN',
    entityType: 'business',
    description:
      'Frozen shrimp and fish, IQF and block, packed to buyer specification with cold-chain documentation.',
    logo: null,
    verified: true,
    productCount: 19,
    establishedYear: 2012,
  },
];

/** The demo list, or an empty array when the flag is not explicitly on. */
export function demoSuppliers() {
  return DEMO_SUPPLIERS_ON ? DEMO : [];
}
