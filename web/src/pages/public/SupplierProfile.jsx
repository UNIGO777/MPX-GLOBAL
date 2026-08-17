import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
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
import { BoxIcon, BuildingIcon, CalendarIcon, ChatIcon, MapPinIcon, TagIcon } from '../../components/ui/icons.jsx';
import { countryName } from '../../lib/countries.js';
import { useCanonical } from '../../lib/seo.js';
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
        <Link to={to} className="group" tabIndex={-1}>
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

  const seller = useQuery({
    queryKey: catalogueKeys.exporter(slug),
    queryFn: () => catalogueApi.exporter(slug),
    retry: false,
  });

  // m3-seo §2 — canonical to the clean slug URL; paged views collapse to it.
  useCanonical(seller.data?.slug ? `/supplier/${seller.data.slug}` : null);

  const products = useQuery({
    queryKey: catalogueKeys.products({ seller: slug, page, pageSize: PAGE_SIZE }),
    queryFn: () => catalogueApi.products({ seller: slug, page, pageSize: PAGE_SIZE }),
    enabled: seller.isSuccess,
    placeholderData: (prev) => prev,
  });

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

  const factPills = s
    ? [
        s.country && { icon: MapPinIcon, label: countryName(s.country) ?? s.country },
        { icon: BuildingIcon, label: s.entityType === 'individual' ? 'Individual' : 'Business' },
        s.establishedYear && { icon: CalendarIcon, label: `Est. ${s.establishedYear}` },
        s.memberSince && { icon: TagIcon, label: `Member since ${s.memberSince}` },
      ].filter(Boolean)
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink-900">
      <PublicHeader />

      <main className="flex-1">
        <div className="w-full px-4 py-8 sm:px-6 md:py-12">
          {/* --- Company header: cover banner + overlapping logo + identity. ---
              The tick's ABSENCE stays the entire "not verified" signal. */}
          <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
            {seller.isPending ? (
              <Skeleton className="aspect-[4/1] max-h-[280px] min-h-[110px] w-full rounded-none sm:min-h-[140px]" />
            ) : (
              <div className="aspect-[4/1] max-h-[280px] min-h-[110px] w-full sm:min-h-[140px]">
                {s.coverImage ? (
                  <img src={s.coverImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  // No upload path exists yet for this field (see file header) —
                  // every real seller renders this today. A designed brand
                  // fill, not a placeholder: the same gradient this section
                  // used as its whole header before this redesign.
                  <div
                    aria-hidden="true"
                    className="h-full w-full bg-gradient-to-r from-primary-800 via-primary-700 to-primary-500"
                  />
                )}
              </div>
            )}

            {seller.isPending ? (
              <div className="px-5 pb-6 sm:px-8">
                <Skeleton className="-mt-10 h-20 w-20 rounded-2xl" />
                <Skeleton className="mt-4 h-8 w-64" />
                <Skeleton className="mt-3 h-6 w-96 rounded-full" />
              </div>
            ) : (
              <div className="px-5 pb-6 sm:px-8">
                {/* Seated deeper into the banner and larger (2026-08-17 UI
                    pass): at h-20 it read as a stray thumbnail against a 4:1
                    cover. The shadow separates it from busy photography. */}
                <div className="-mt-14 sm:-mt-16">
                  {s.logo ? (
                    <img
                      src={s.logo}
                      alt=""
                      className="h-24 w-24 rounded-2xl object-cover shadow-lift ring-4 ring-white sm:h-28 sm:w-28"
                    />
                  ) : (
                    <NoImagePanel
                      label={s.name}
                      monogram
                      ratio="h-24 w-24 sm:h-28 sm:w-28"
                      className="rounded-2xl shadow-lift ring-4 ring-white"
                    />
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{s.name}</h1>
                    {/* Pill wrap around the shared `VerifiedTick` — never fork
                        its own logic/copy, only the container is new. */}
                    {s.verified && (
                      <VerifiedTick
                        verified
                        verifiedAt={s.verifiedAt}
                        className="rounded-full bg-success-50 px-2.5 py-1"
                      />
                    )}
                  </div>

                  {/* "Start Conversation" — disabled placeholder, same
                      treatment as `ProductDetail.jsx`'s "Send Enquiry" and
                      `ProductListCard.jsx`'s "Inquiry": the M4 backend
                      (Inquiry/Conversation/Message, real and tested) exists,
                      but no create-conversation flow is wired on the web
                      client yet — shown, disabled, never fake-functional,
                      logged in docs/UiWebNotes.md. */}
                  <button
                    type="button"
                    disabled
                    title="Conversations are coming soon"
                    className="flex min-h-[44px] shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-full bg-ink-200 px-5 text-sm font-semibold text-ink-500"
                  >
                    <ChatIcon className="h-4 w-4" aria-hidden="true" />
                    Start Conversation
                  </button>
                </div>

                {factPills.length > 0 && (
                  <p className="mt-3 flex flex-wrap items-center gap-2">
                    {factPills.map(({ icon: Icon, label }) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3 py-1 text-xs font-medium text-ink-700"
                      >
                        <Icon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
                        {label}
                      </span>
                    ))}
                  </p>
                )}
              </div>
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
              <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
                <h2 className="border-b border-surface-border px-6 py-4 text-[15px] font-bold text-ink-900">
                  About the Company
                </h2>
                <div className="px-6 py-5">
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
          <section className="mt-8">
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
                <EmptyState icon={BoxIcon} title="No products listed yet">
                  This supplier hasn&apos;t published any listings.
                </EmptyState>
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
                  onPage={(n) => setParams(n > 1 ? { page: String(n) } : {})}
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
