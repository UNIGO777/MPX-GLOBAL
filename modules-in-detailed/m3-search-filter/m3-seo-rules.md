# MPX Global — SEO Rules (for Claude Code)

> Merge these into the Claude Code project rules. When generating or editing frontend/backend code for public discovery pages (products, sellers, categories, search), Claude Code MUST follow these rules. Stack is React (SPA) for now — apply what is possible in a client-rendered app; SSR/prerender items are marked as deferred but should be kept in mind so they aren't blocked later.

---

## 1. URL structure (slug-based, readable)

- Use readable, slug-based URLs for all public pages — never raw Mongo ObjectIds in the visible path.
  - Product:      `/product/:slug`            e.g. `/product/cotton-fabric-roll-a1b2`
  - Seller:       `/supplier/:slug`           e.g. `/supplier/textilehub`
  - Category:     `/category/:slug`           e.g. `/category/textiles-fabrics-yarn`
  - Sub-category: `/category/:parentSlug/:childSlug`
  - Search:       `/search?q=...&type=product`  (query params, not path)
- Slug generation: lowercase, trim, spaces → hyphens, strip non-alphanumeric (keep hyphens), collapse repeats.
  - "Cotton Fabric Roll" → `cotton-fabric-roll`
- Uniqueness: if a slug already exists, append a short unique suffix (`-a1b2`, 4 chars from the id). Store the final slug on the document.
- Slug immutability: once set, do NOT change a slug when the name changes. If a slug must change, keep the old one and 301-redirect it to the new URL. Never break existing indexed links.
- Store `slug` as an indexed, unique field on Product, Category, and Organisation (seller).

## 2. On-page SEO (every public page)

For product, seller, and category pages, render/emit:
- `<title>`: concise, keyword-first. Examples:
  - Product: `"{productName} — {sellerName} | MPX Global"`
  - Seller:  `"{companyName} — {mainCategory} Supplier | MPX Global"`
  - Category:`"{categoryName} Suppliers & Products | MPX Global"`
- `<meta name="description">`: 150–160 chars, from the entity's description (fallback to a templated line). No keyword stuffing.
- One `<h1>` per page = the entity name. Use `<h2>/<h3>` for sub-sections.
- Canonical: every page emits `<link rel="canonical" href="{absolute-clean-url}">`.
- Open Graph + Twitter tags: `og:title`, `og:description`, `og:image` (product/seller image), `og:type`, `og:url`, `twitter:card=summary_large_image`.
- Image `alt` text: derive from product/seller/category name; never leave alt empty on content images.
- Language + charset meta set; mobile viewport meta present.

## 3. Structured data (JSON-LD)

Emit JSON-LD `<script type="application/ld+json">` on:
- Product pages → `Product` schema (name, image, description, category; `offers` with price/priceCurrency/availability; `brand`/`seller` = organisation).
- Seller pages → `Organization` schema (name, logo, url, address at city level only — never expose private/exact address).
- Category pages → `BreadcrumbList` + `ItemList` of products.
- Keep JSON-LD in sync with visible content (Google penalises mismatch). Never inject private data (KYC, contact, exact address) into JSON-LD.

## 4. Canonical & indexing rules for filters/search

- Base pages (product, seller, category) → indexable.
- Filtered category URLs (`?material=cotton&price=...`) → add `<meta name="robots" content="noindex,follow">` AND canonical pointing to the clean base category URL. Prevents duplicate-content + crawl-budget waste.
- Search results pages (`/search?q=...`) → `noindex,follow`.
- Pagination: use `rel="next"/"prev"` or a canonical to page 1 for SEO; keep page params out of the canonical for filtered views.

## 5. Sitemap & robots

- Generate a dynamic `sitemap.xml` listing all **active** products, **active** sellers, and **active** categories (public URLs only). Exclude drafts, inactive, archived, taken-down, and filtered/search URLs.
- Split into sitemap index if > 50k URLs (products sitemap, sellers sitemap, categories sitemap).
- Update the sitemap when an entity is published/unpublished (or regenerate on a schedule).
- `robots.txt`: allow base public pages; `Disallow: /search`; disallow filter query patterns; reference the sitemap URL.

## 6. Content visibility rules (SEO + privacy together)

- Only publicly-projected fields appear on public pages / in JSON-LD / in meta (see M3 public-vs-private rules).
- Never expose in HTML, meta, or JSON-LD: KYC docs, direct contact (phone/email), exact street address, owner/internal IDs, takedown reason, draft/archived data.
- Only `status: active` entities get indexable pages and sitemap entries. When an entity is deactivated/archived/taken-down, its page should return 404/410 (or 301 to category) and drop from the sitemap.

## 7. Performance (SEO ranking factor)

- Lazy-load images below the fold; set explicit width/height to avoid layout shift (CLS).
- Serve appropriately sized images (Cloudinary transformations); prefer WebP.
- Avoid render-blocking; keep Core Web Vitals healthy (LCP, CLS, INP).

## 8. Deferred (React SPA note — do later, don't block)

- Public discovery pages ideally need SSR or prerendering for full SEO (client-only React can index poorly). For now we stay on React SPA per decision. When SEO becomes a priority, revisit SSR/prerender (e.g. Next.js public site or a prerender layer) for `/product`, `/supplier`, `/category` routes.
- Until then: still emit correct titles/meta/canonical/JSON-LD client-side, keep slugs and sitemap ready, so the migration later is smooth and no URLs break.

## 9. Hard rules (do / don't) for Claude Code

- DO put a unique, immutable, indexed `slug` on Product, Category, Organisation.
- DO 301-redirect old slugs; never hard-break an indexed URL.
- DO emit title, meta description, canonical, OG tags, and JSON-LD on every public page.
- DO noindex search + filtered URLs; canonical them to the base page.
- DO keep sitemap to active/public entities only.
- DON'T put raw ObjectIds in public URLs.
- DON'T expose any private field (KYC, contact, exact address, internal IDs, takedown reason) in HTML/meta/JSON-LD.
- DON'T index draft/inactive/archived/taken-down pages.
- DON'T change a slug silently on rename.