import { useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { PriceLine } from '../../components/catalogue/PriceLine.jsx';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import { BoxIcon, BuildingIcon, CalendarIcon, ChatIcon, GridIcon, MapPinIcon, TagIcon } from '../../components/ui/icons.jsx';
import { countryName } from '../../lib/countries.js';
import { useCanonical, useNoIndex } from '../../lib/seo.js';
import { NotFound } from './NotFound.jsx';

/**
 * M2 web screen 4 — public supplier profile + catalogue (`/supplier/:slug`).
 *
 * REDESIGNED 2026-08-13 against an owner-supplied reference mockup: a
 * Facebook/LinkedIn-style cover banner behind the identity block, icon fact
 * pills, a plain "About the Company" card, and a dedicated catalogue-card
 * style (`SupplierCatalogueCard` below — a deliberate fork of the shared
 * `ProductCard`, matching the reference's own card layout, same reasoning as
 * `ProductDetail.jsx`'s "More in category" fork: the owner asked for this
 * page's cards to match a specific reference, not to stay pixel-identical to
 * every other product-card surface on the site).
 *
 * 🔴 THE COVER IMAGE IS A NEW FIELD — READ BEFORE ASSUMING IT WORKS END TO END.
 * `Organisation.coverImage` and its public-whitelist entry were added
 * alongside this redesign specifically so this page would have real data to
 * render (`m3-public-projection.md` updated to match — never widen a public
 * projection without updating that doc in the same pass). What was
 * ✅ BUILT 2026-08-17 (owner): the seller CAN now set this — `setMyCover` /
 * `removeMyCover` in `organisation.service.js`, `POST/DELETE
 * /me/organisation/cover`, with the dropzone on the company-profile screen
 * beside the logo. The paragraph below described the gap before that. Until
 * follow-up ships, every real seller on the platform renders the fallback
 * fill below, not a photo. Told to the owner directly, not just here.
 *
 * One deviation from the reference worth flagging: its catalogue cards show
 * a domain spec (e.g. "Purity 99.8%") + MOQ, with no price. This page's
 * cards show PRICE + MOQ instead — every other product card on this site
 * treats price as the primary buying signal ("the first question every B2B
 * buyer asks" — see `ProductListCard.jsx`'s own header comment), and unlike
 * a category-specific spec, price exists on every product. Not a silent
 * change — flagged to the owner alongside this file.
 *
 * 🔴 "Start Conversation" (2026-08-13, owner-requested) is a DISABLED
 * placeholder — same treatment as `ProductDetail.jsx`'s "Send Enquiry" and
 * `ProductListCard.jsx`'s "Inquiry": the M4 backend (Inquiry/Conversation/
 * Message) is real and tested, but no create-conversation flow is wired on
 * the web client yet. Shown, disabled, never fake-functional, logged in
 * docs/UiWebNotes.md.
 *
 * 🔴 A SELLER IS PUBLIC FROM SIGNUP (B7). Verification is never a gate on
 * visibility — an unverified company's page renders in full, identically, minus
 * the tick. There is no badge, chip or sentence in its place, and no
 * verification status or history anywhere on the page.
 *
 * 🔴 NEVER contact details. No phone, no email, no street address, and
 * specifically **no `website`** — that field is internal (held for our own
 * verification use) and has reached a public response once before. It is not in
 * the public projection, so the only way it could appear here is if someone
 * added it deliberately.
 *
 * `productCount` counts LIVE listings only (taken-down excluded, server-side),
 * which is the same rule the grid below is filtered by — so the number and the
 * visible cards always agree.
 */
const PAGE_SIZE = 12;

/* Keyed by how many stats survived the `.filter(Boolean)` below, so the strip
   never leaves a dangling empty column on desktop. */
const STAT_COLUMNS = {
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
};
const GRID = 'grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4';

/**
 * Catalogue card — see the file header for why this is a fork of the shared
 * `ProductCard` rather than a reuse. Image → category eyebrow → name → price
 * + MOQ (two label/value rows, matching the reference's stat-row layout) →
 * an explicit "View Specifications" button (a real, honest label: the
 * product detail page it links to does show full specifications, alongside
 * everything else).
 */
function SupplierCatalogueCard({ product, to }) {
  const cover = product.images?.[0];
  return (
    <li className="h-full">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card transition-all hover:border-primary-600 hover:shadow-lift">
        <Link to={to} className="group" tabIndex={-1} aria-hidden="true">
          {cover ? (
            <img
              src={cover}
              alt=""
              loading="lazy"
              width={640}
              height={480}
              className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <NoImagePanel ratio="aspect-[4/3]" />
          )}
        </Link>
        <div className="flex flex-1 flex-col p-4">
          {product.category?.name && (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {product.category.name}
            </p>
          )}
          <Link to={to} className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-ink-900 hover:text-primary-700">
            {product.name}
          </Link>

          <div className="mt-3 space-y-2 border-t border-surface-border pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted">Price</span>
              <PriceLine price={product.price} unit={product.unit} size="sm" />
            </div>
            {product.moq != null && (
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted">Min. Order</span>
                <span className="font-semibold text-ink-900">
                  {product.moq.toLocaleString('en-IN')}
                  {product.unit ? ` ${product.unit}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* text-xs on mobile (2-up grid leaves ~130-150px per card at
              common phone widths) — "View Specifications" was wrapping to
              two lines there, which also broke the 44px min touch-target
              rule since the button's own height was set below it (40px,
              fixed alongside this). sm+ (2-up wider, then 3/4-up desktop)
              has plenty of room, back to text-sm. */}
          <Link
            to={to}
            className="mt-4 flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-lg border border-primary-200 bg-primary-50 px-3 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 sm:px-4 sm:text-sm"
          >
            View Specifications
          </Link>
        </div>
      </div>
    </li>
  );
}

export function SupplierProfile() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  // Which catalogue section is open. In the URL so a tab is shareable and Back
  // works; `cat` rather than `category` to keep it distinct from the global
  // search page's own parameter.
  const cat = params.get('cat') || '';

  /* Moving between tabs/pages must not drop the other parameter, and changing
     the tab must reset to page 1 — a visitor on page 3 of a 40-product section
     would otherwise land on an empty page 3 of a 6-product one. */
  const setView = (next) => {
    const merged = { ...(cat ? { cat } : {}), ...(page > 1 ? { page: String(page) } : {}), ...next };
    setParams(Object.fromEntries(Object.entries(merged).filter(([, v]) => v)));
  };

  const seller = useQuery({
    queryKey: catalogueKeys.exporter(slug),
    queryFn: () => catalogueApi.exporter(slug),
    retry: false,
  });

  // m3-seo §2 — canonical to the clean slug URL; paged views collapse to it.
  // This already pointed at the SERVER's slug rather than the typed one, so a
  // retired slug emitted the right canonical even before redirects existed.
  useCanonical(seller.data?.slug ? `/supplier/${seller.data.slug}` : null);
  // m3-seo §4 — a category-filtered view of the catalogue is `noindex,follow`
  // and canonicals to the clean supplier URL above. The unfiltered page stays
  // indexable exactly as before.
  useNoIndex(Boolean(cat));

  /**
   * 🔴 Renaming a company moves its public URL (2026-09-22), and the old URL
   * keeps resolving server-side. This is the other half of that promise: land
   * the visitor on the canonical address instead of leaving them on a URL that
   * works but no longer matches the company.
   *
   * `replace`, never push — the retired slug must not sit in history, or Back
   * bounces the visitor straight into another redirect.
   *
   * The query string rides along so a shared `?page=3` link survives the move.
   */
  const canonicalSlug = seller.data?.slug ?? slug;
  const navigate = useNavigate();
  useEffect(() => {
    if (!seller.data?.slug || seller.data.slug === slug) return;
    const search = params.toString();
    navigate(`/supplier/${seller.data.slug}${search ? `?${search}` : ''}`, { replace: true });
  }, [seller.data?.slug, slug, params, navigate]);

  const listQuery = { seller: canonicalSlug, page, pageSize: PAGE_SIZE, ...(cat ? { category: cat } : {}) };
  const products = useQuery({
    // Keyed on the CANONICAL slug, not the typed one: a retired slug would
    // otherwise fetch a catalogue the API cannot resolve, flash an error, and
    // then refetch after the redirect. This way the list loads once, correctly.
    queryKey: catalogueKeys.products(listQuery),
    queryFn: () => catalogueApi.products(listQuery),
    enabled: seller.isSuccess,
    placeholderData: (prev) => prev,
  });

  /* The category strip comes from the FACETS endpoint, not from counting the
     products on screen: the catalogue is paginated, so a page of twelve can
     only ever reveal twelve products' worth of categories. Facets are computed
     over the seller's whole live catalogue server-side and already carry the
     per-category counts. */
  const facets = useQuery({
    queryKey: catalogueKeys.facets({ seller: canonicalSlug, type: 'product' }),
    queryFn: () => catalogueApi.facets({ seller: canonicalSlug, type: 'product' }),
    enabled: seller.isSuccess,
    staleTime: 5 * 60 * 1000,
  });
  const sections = facets.data?.facets?.subCategory ?? [];

  const s = seller.data;
  useEffect(() => {
    if (!s) return undefined;
    const previous = document.title;
    // SEO title per m3 brief screen 7 — "Supplier" is the search keyword; the
    // old SEO doc's "{mainCategory} Supplier" form references cancelled data.
    document.title = `${s.name} — Supplier | MPX Global`;
    return () => { document.title = previous; };
  }, [s]);

  if (seller.isError) return <NotFound />;

  const total = products.data?.total ?? 0;

  /* The stat strip, in the reference's "15 YEARS / 300+ EMPLOYEES" spirit but
     built ONLY from fields that are already in the public whitelist. The
     reference's factory area, production lines, headcount, capacity and
     turnover have no field on `Organisation` and are deliberately absent —
     inventing them would put numbers on a real company's page that it never
     gave us. "Years in business" is arithmetic on `establishedYear`, not a
     new claim. */
  const stats = s
    ? [
        s.establishedYear && {
          icon: CalendarIcon,
          value: `${Math.max(0, new Date().getFullYear() - s.establishedYear)} yrs`,
          label: `In business · est. ${s.establishedYear}`,
        },
        { icon: BoxIcon, value: String(s.productCount ?? 0), label: 'Products listed' },
        sections.length > 0 && {
          icon: GridIcon,
          value: String(sections.length),
          label: sections.length === 1 ? 'Product category' : 'Product categories',
        },
        s.country && { icon: MapPinIcon, value: countryName(s.country) ?? s.country, label: 'Based in' },
        {
          icon: BuildingIcon,
          value: s.entityType === 'individual' ? 'Individual' : 'Business',
          label: 'Entity type',
        },
        s.memberSince && { icon: TagIcon, value: String(s.memberSince), label: 'Member since' },
      ].filter(Boolean)
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle text-ink-900">
      <PublicHeader />

      <main className="flex-1">
        <div className="w-full px-4 py-8 sm:px-6 md:py-12 lg:px-10 xl:px-16">
          {/* --- Company header. Reworked 2026-10-28 against an owner-supplied
              Alibaba storefront reference: the cover becomes a full banner with
              the identity sitting ON it, and a stat strip runs underneath.
              🔴 ONLY whitelisted fields are shown. The reference's factory
              area / production lines / employee count / capacity / turnover /
              certifications / exhibition and team photos are NOT here — no
              field on `Organisation` holds them, and the owner's instruction
              was profile + products only for now.
              The tick's ABSENCE stays the entire "not verified" signal. --- */}
          <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
            {seller.isPending ? (
              <Skeleton className="h-64 w-full rounded-none sm:h-72" />
            ) : (
              <div className="relative h-64 w-full sm:h-72">
                {s.coverImage ? (
                  <img src={s.coverImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  // A designed brand fill, not a placeholder — a company that
                  // has not set a cover still gets a finished-looking header.
                  <div
                    aria-hidden="true"
                    className="h-full w-full bg-gradient-to-r from-primary-800 via-primary-700 to-primary-500"
                  />
                )}
                {/* The scrim is what makes white text legible over arbitrary
                    photography — without it the name disappears on a bright
                    cover. Opaque at the bottom where the text sits. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/5"
                />

                <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end gap-4 p-5 sm:p-7">
                  {s.logo ? (
                    <img
                      src={s.logo}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-lift ring-4 ring-white/90 sm:h-24 sm:w-24"
                    />
                  ) : (
                    <NoImagePanel
                      label={s.name}
                      monogram
                      ratio="h-20 w-20 sm:h-24 sm:w-24"
                      className="shrink-0 rounded-2xl shadow-lift ring-4 ring-white/90"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="text-2xl font-bold text-white drop-shadow-sm sm:text-3xl">{s.name}</h1>
                      {/* Pill wrap around the shared `VerifiedTick` — never fork
                          its own logic/copy, only the container is new. */}
                      {s.verified && (
                        <VerifiedTick
                          verified
                          verifiedAt={s.verifiedAt}
                          className="rounded-full bg-white/95 px-2.5 py-1"
                        />
                      )}
                    </div>
                    {s.country && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-white/90">
                        <MapPinIcon className="h-4 w-4" aria-hidden="true" />
                        {countryName(s.country) ?? s.country}
                      </p>
                    )}
                  </div>

                  {/* "Start Conversation" — REAL since 2026-08-17 (M4).
                      🔴 It cannot open a thread directly: every conversation is
                      anchored to exactly one product (M4-4), and a company-level
                      thread does not exist in the model. The owner's resolution
                      (2026-08-17) is a product picker — this jumps to the
                      supplier's catalogue below, where each product carries the
                      real enquiry button. The company-level entry survives
                      without inventing a product-less thread. */}
                  <a
                    href="#products"
                    className="flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-full bg-primary-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:w-auto"
                  >
                    <ChatIcon className="h-4 w-4" aria-hidden="true" />
                    Start Conversation
                  </a>
                </div>
              </div>
            )}

            {stats.length > 0 && (
              <dl
                className={`grid grid-cols-2 divide-x divide-y divide-surface-border border-t border-surface-border sm:grid-cols-3 lg:divide-y-0 ${
                  // Full class strings, never an interpolated `lg:grid-cols-${n}`:
                  // Tailwind scans source text, so a built-up class name is not
                  // emitted and the row would silently fall back to 3 columns.
                  // `establishedYear` is optional, so the count really does vary.
                  STAT_COLUMNS[stats.length] ?? 'lg:grid-cols-6'
                }`}
              >
                {stats.map(({ icon: Icon, value, label }) => (
                  <div key={label} className="px-4 py-4 text-center">
                    <Icon className="mx-auto h-4 w-4 text-ink-400" aria-hidden="true" />
                    <dd className="mt-1.5 text-lg font-bold leading-tight text-ink-900">{value}</dd>
                    <dt className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">{label}</dt>
                  </div>
                ))}
              </dl>
            )}
          </section>

          {/* --- About the Company — a designed empty state when the seller
              hasn't written a description, never a silent gap. --- */}
          {!seller.isPending && (
            <section className="mt-8">
              {/* Header lives INSIDE the card (2026-08-17 UI pass) — a floating
                  h2 over a card holding two lines of prose left a sparse,
                  unanchored block. Same header-on-a-divider anatomy the filter
                  and category cards use. */}
              <div className="rounded-2xl border border-surface-border bg-white px-6 py-5 shadow-card sm:flex sm:gap-10 sm:px-8 sm:py-6">
                <h2 className="shrink-0 text-[15px] font-bold text-ink-900 sm:w-48">About the Company</h2>
                <div className="mt-3 sm:mt-0">
                  {s.description ? (
                    <p className="max-w-prose text-sm leading-relaxed text-ink-700">{s.description}</p>
                  ) : (
                    <p className="text-sm italic text-muted">
                      This supplier hasn&apos;t added a company description yet.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* --- Catalogue --- */}
          <section id="products" className="mt-8 scroll-mt-24">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-ink-900 sm:text-2xl">Product Catalogue</h2>
              {products.isSuccess && (
                <span className="rounded-full border border-surface-border bg-white px-3 py-1 text-xs font-semibold text-ink-700">
                  {/* "Listings", not "Active Listings" (owner, 2026-08-14 —
                      F4): only active products are ever queryable, so "Active"
                      is exactly the status-word family the copy rule bans. */}
                  {total} {total === 1 ? 'Listing' : 'Listings'}
                </span>
              )}
            </div>

            {/* Product navigation — the reference's category strip. Real
                filtering, not decoration: each tab re-queries `/public/products`
                with `category` + `seller`, so paging inside a section works and
                the URL is shareable. Counts come from the facets call, which
                sees the whole catalogue rather than the current page. */}
            {sections.length > 1 && (
              <nav aria-label="Product categories" className="mb-5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
                  {[{ slug: '', name: 'All products', count: s.productCount }, ...sections].map((c) => {
                    const active = cat === c.slug;
                    return (
                      <li key={c.slug || 'all'}>
                        <button
                          type="button"
                          aria-current={active ? 'true' : undefined}
                          onClick={() => setView({ cat: c.slug, page: '' })}
                          className={`flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${
                            active
                              ? 'border-primary-600 bg-primary-600 text-white'
                              : 'border-surface-border bg-white text-ink-700 hover:border-primary-300 hover:text-primary-700'
                          }`}
                        >
                          {c.name}
                          {c.count != null && (
                            <span className={active ? 'text-white/80' : 'text-muted'}>{c.count}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            )}

            {(seller.isPending || products.isPending) && (
              <ul className={GRID} aria-busy="true" aria-label="Loading products">
                {Array.from({ length: 4 }, (_, i) => (
                  <li key={i} className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
                    <Skeleton className="aspect-[4/3] w-full rounded-none" />
                    <div className="space-y-3 p-4">
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-9 w-full rounded-lg" />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {products.isError && (
              <div className="rounded-2xl border border-surface-border bg-white shadow-card">
                <ErrorState
                  title="We couldn't load this catalogue"
                  requestId={products.error?.response?.data?.error?.requestId}
                  onRetry={products.refetch}
                />
              </div>
            )}

            {/* Zero products is NORMAL — a profile is public from the day the
                company signs up, so the header above still renders in full and
                only this area is empty. Never an error, never "inactive". */}
            {products.isSuccess && total === 0 && (
              <div className="rounded-2xl border border-surface-border bg-white shadow-card">
                {cat ? (
                  // A section can be empty while the company is not — never
                  // report an empty filter as an empty catalogue.
                  <EmptyState icon={BoxIcon} title="Nothing in this category">
                    This supplier has no live listings here right now.
                  </EmptyState>
                ) : (
                  <EmptyState icon={BoxIcon} title="No products listed yet">
                    This supplier hasn&apos;t published any listings.
                  </EmptyState>
                )}
              </div>
            )}

            {products.isSuccess && total > 0 && (
              <>
                <ul className={GRID}>
                  {products.data.products.map((product) => (
                    <SupplierCatalogueCard
                      key={product.id}
                      product={product}
                      to={`/product/${product.slug}`}
                    />
                  ))}
                </ul>
                <Pagination
                  compact
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={total}
                  onPage={(n) => setView({ page: n > 1 ? String(n) : '' })}
                />
              </>
            )}
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
