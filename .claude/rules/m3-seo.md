---
paths:
  - "**/*[Ss]itemap*.{js,jsx,ts,tsx}"
  - "**/*[Rr]obots*.{js,jsx,ts,tsx}"
  - "**/*[Ss]lug*.{js,jsx,ts,tsx}"
  - "**/*[Ss]eo*.{js,jsx,ts,tsx}"
  - "**/*[Mm]eta[Tt]ags*.{js,jsx,ts,tsx}"
  - "**/*{JsonLd,Jsonld,StructuredData}*.{js,jsx,ts,tsx}"
  - "**/pages/**/*{Product,Supplier,Seller,Category,Search}*.{jsx,tsx}"
  - "**/*{Product,Supplier,Seller,Category,Search}{Detail,Page,Profile,Browse,Results}*.{jsx,tsx}"
  - "**/[Mm]odels/{Product,Category,Organisation,Organization}.{js,ts}"
  - "**/*{exporter,supplier,seller,product,category,search,public}*[Cc]ontroller*.{js,jsx,ts,tsx}"
---

# 🔎 M3 · SEO rules (public discovery pages)

Loaded when working on public product / seller / category / search pages, or on slug / sitemap
/ robots / JSON-LD code. Applies to M3 discovery, web + backend. Source:
`modules-in-detailed/m3-search-filter/m3-seo-rules.md`. Stack is **React SPA for now** — do the
client-renderable parts; SSR/prerender items are deferred (§8) but kept unblocked.

**Privacy first:** these rules never override the public whitelist projection — see
`.claude/rules/m3-public-projection.md`. Nothing private (KYC, contact, exact address, internal
IDs, takedown reason, draft/archived data) may appear in HTML, meta, JSON-LD, or the sitemap.

## 1 · Slugs (readable URLs)

- Public URLs use readable slugs, **never raw ObjectIds** in the visible path:
  - Product `/product/:slug` · Seller `/supplier/:slug` · Category `/category/:slug` ·
    Sub-category `/category/:parentSlug/:childSlug` · Search `/search?q=...&type=product`
    (query params, not path).
- Generate: lowercase, trim, spaces→hyphens, strip non-alphanumeric (keep hyphens), collapse
  repeats. On collision, append a short suffix (`-a1b2`, 4 chars from the id). Store the final
  slug on the document.
- **Immutable:** never change a slug on rename. If it must change, keep the old one and
  **301-redirect** old→new. Never hard-break an indexed URL.
- **Archive exception (Part A §A6):** on archive, append an archive marker to the product slug
  (e.g. `cotton-fabric-roll` → `cotton-fabric-roll--archived-a1b2`) to free the clean slug for
  re-listing. Safe because archived products have no public page (they 404/410 and drop from the
  sitemap), so no indexed URL breaks.
- Store `slug` as an **indexed, unique** field on `Product`, `Category`, `Organisation`.

## 2 · On-page SEO (every public page)

Emit: keyword-first `<title>` (`"{name} — {context} | MPX Global"`); `<meta description>`
150–160 chars from the entity description (templated fallback, no stuffing); exactly one `<h1>`
= entity name (`h2/h3` for sub-sections); `<link rel="canonical">` to the absolute clean URL;
Open Graph + Twitter tags (`og:title/description/image/type/url`,
`twitter:card=summary_large_image`); non-empty `alt` on content images derived from the name;
charset, language, and mobile viewport meta.

## 3 · Structured data (JSON-LD)

- Product → `Product` schema (name, image, description, category; `offers` with
  price/priceCurrency/availability; `seller`/`brand` = organisation).
- Seller → `Organization` schema (name, logo, url; address at **city level only**).
- Category → `BreadcrumbList` + `ItemList` of products.
- Keep JSON-LD in sync with visible content. **Never inject private data** into JSON-LD.

## 4 · Canonical & indexing (filters / search)

- Base product/seller/category pages → indexable.
- Filtered category URLs (`?material=cotton&...`) → `<meta robots="noindex,follow">` **and**
  canonical to the clean base category URL.
- Search results (`/search?q=...`) → `noindex,follow`.
- Pagination → `rel="next"/"prev"` or canonical to page 1; keep page/filter params out of the
  canonical for filtered views.

## 5 · Sitemap & robots

- Dynamic `sitemap.xml` listing **active** products, sellers, categories (public URLs only).
  Exclude draft / inactive / archived / taken-down and all filter/search URLs.
- Split into a sitemap index if > 50k URLs.
- Regenerate on publish/unpublish (or on schedule).
- `robots.txt`: allow base public pages; `Disallow: /search`; disallow filter query patterns;
  reference the sitemap URL.

## 6 · Visibility (SEO + privacy together)

- Only **publicly-projected** fields appear on pages / meta / JSON-LD.
- Only `status: active` entities get indexable pages and sitemap entries. On
  deactivate/archive/takedown, the page returns **404/410 (or 301 to category)** and drops from
  the sitemap.

## 7 · Performance (ranking factor)

- Lazy-load below-the-fold images; set explicit width/height (avoid CLS).
- Serve right-sized images via Cloudinary transforms; prefer WebP.
- Avoid render-blocking; keep Core Web Vitals (LCP, CLS, INP) healthy.

## 8 · Deferred (React SPA)

SSR/prerender for `/product`, `/supplier`, `/category` is deferred (SPA per current decision).
Until then still emit correct title/meta/canonical/JSON-LD client-side and keep slugs + sitemap
ready so a later SSR/prerender migration breaks no URLs.

## Hard do / don't

- **DO** put a unique, immutable, indexed `slug` on Product, Category, Organisation;
  301-redirect old slugs; emit title/meta/canonical/OG/JSON-LD on every public page; noindex
  search + filtered URLs (canonical to base); keep the sitemap to active/public entities only.
- **DON'T** put raw ObjectIds in public URLs; expose any private field in HTML/meta/JSON-LD;
  index draft/inactive/archived/taken-down pages; change a slug silently on rename.
