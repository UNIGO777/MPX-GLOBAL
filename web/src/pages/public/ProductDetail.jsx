import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { EnquiryButton } from '../../components/chat/EnquiryButton.jsx';
import { SaveButton } from '../../components/saved/SaveButton.jsx';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { PriceLine } from '../../components/catalogue/PriceLine.jsx';
import { ProductCard } from '../../components/catalogue/ProductCard.jsx';
import { SpecTable } from '../../components/catalogue/SpecTable.jsx';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import {
  BoxIcon,
  ChevronRightIcon,
  ClockIcon,
  CreditCardIcon,
  ExpandIcon,
  GlobeIcon,
  MapPinIcon,
  ShieldIcon,
  TagIcon,
  UsersIcon,
} from '../../components/ui/icons.jsx';
import { countryName } from '../../lib/countries.js';
import { useCanonical } from '../../lib/seo.js';
import { formatDate } from '../../lib/format.js';
import { NotFound } from './NotFound.jsx';
import { Lightbox } from '../../components/ui/Lightbox.jsx';

/**
 * M2 web screen 3 — public product detail (`/product/:slug`).
 *
 * REDESIGNED 2026-08-11 to the converged public language: gallery left, a
 * structured BUY PANEL right (name → spec chips → highlighted price block with
 * MOQ → supplier card → trade facts), icon-chip panels for description and
 * specifications, and a "More in {category}" row of real product cards.
 *
 * REDESIGNED AGAIN 2026-08-12 against an owner-supplied reference mockup
 * ("this is the design for product page make this"):
 *  - gallery pinned (`self-start` + `sticky`, desktop only) instead of
 *    stretching to the buy panel's height and leaving dead white space below
 *    a single photo;
 *  - price block promoted to a tinted, bordered card with MOQ and supply
 *    ability as a two-column row beneath the price, instead of a flat
 *    rectangle with just the price;
 *  - trade facts became their own bordered card with a leading icon per row
 *    (was a plain label/value list folded under the seller card);
 *  - Description + Specifications go full-width stacked instead of side by
 *    side — a 2-3 row spec table in a half-width card read as very sparse.
 *  - an enquiry button sits under trade facts, in the reference's exact
 *    position. It shipped disabled on 2026-08-12 and became REAL on
 *    2026-08-17 with M4 (`EnquiryButton`) — the one door into chat.
 * Two things the reference shows that this screen deliberately does NOT
 * add, because there is no real data behind them and this is a page buyers
 * make sourcing decisions from: a view counter and a star supplier rating.
 * Neither field exists on `Product` or `Organisation` — inventing a number
 * ("2.4k views", "4.9★") would be presenting a fabrication as real signal,
 * on a platform where D3/D1-style honesty about what's real is a standing
 * rule, not a style preference.
 *
 * 🔴 THE COPY CONSTRAINTS ARE THE POINT OF THIS SCREEN:
 *  - No status word anywhere. Only `active` products are queryable, so "Live",
 *    "Available" or "In stock" would be noise at best and a leak at worst.
 *  - No negative verification text. An unverified seller's block is identical,
 *    minus the tick — there is no badge, chip or sentence in its place.
 *  - The enquiry button is the ONLY contact affordance, and it opens a
 *    THREAD (M4-4) — never an email, a phone number or a quote form. It
 *    renders nothing at all for an exporter account, or for a buyer looking at
 *    their own company's listing (the F4 self-enquiry guard would refuse it).
 *  - The gallery shows ONLY the seller's own images. Never stock filler.
 *  - Never email, phone, street address or website — `website` in particular is
 *    internal and has reached a public response once before.
 *
 * Anything unavailable (draft · inactive · archived · taken down · dead
 * category) 404s from the API and renders the shared not-found page, all
 * deliberately indistinguishable from each other.
 */

/** Goods and service listings carry different field groups; the leaf's type
 *  decided which. Each row also carries the icon its "Trade specifications"
 *  card row leads with — picked for what the field IS, not copied from the
 *  reference mockup's own (semiconductor-specific) row set. */
/** The reference component's four tabs. "Overview" is the default and is a
 *  superset of the other three — see the tablist's own note on why that
 *  matters for indexing. */
/**
 * 🔴 The 2026-09-23 mockup drops the old "Overview" tab, which was what kept
 * this page indexable: every other tab was a SUBSET of it, so a crawler saw
 * everything on first render.
 *
 * With no such tab, each panel now carries content that lives nowhere else — so
 * all four RENDER INTO THE DOM and inactive ones are hidden with CSS, never
 * mounted on click. `m3-seo.md` requires a product page to be indexable, and a
 * description that only exists after a click is not.
 */
const DETAIL_TABS = ['Trade terms', 'Attributes', 'Supplier', 'Description'];

const GOODS_FACTS = [
  ['hsCode', 'HS code', TagIcon],
  ['countryOfOrigin', 'Country of origin', GlobeIcon],
  ['supplyAbility', 'Supply ability', BoxIcon],
  ['leadTime', 'Lead time', ClockIcon],
  ['packaging', 'Packaging', BoxIcon],
  ['terms', 'Payment terms', CreditCardIcon],
];
const SERVICE_FACTS = [
  ['engagementType', 'Engagement type', TagIcon],
  ['deliveryModel', 'Delivery model', GlobeIcon],
  ['teamSize', 'Team size', UsersIcon],
  ['pricingModel', 'Pricing model', CreditCardIcon],
  ['timeline', 'Timeline', ClockIcon],
];

function Gallery({ images = [], name, productId }) {
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (images.length === 0) {
    // Publishing does not require a photo, so this is a normal listing, not a
    // broken one — one designed panel, never an empty carousel. The heart
    // overlays the panel exactly as it overlays a photo.
    return (
      <div className="relative">
        <NoImagePanel ratio="aspect-[4/3]" className="rounded-xl border border-surface-border" />
        <SaveButton targetId={productId} name={name} />
      </div>
    );
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-surface-border bg-white">
        <img src={images[active]} alt={name} className="aspect-[4/3] w-full object-cover" />
        <SaveButton targetId={productId} name={name} />
        {/* Fullscreen trigger (2026-08-12, owner's reference mockup) — real,
            working zoom, not a placeholder: it's pure client-side image
            display, nothing to wire to a backend, so unlike "Send Enquiry"
            there's no reason to hold this back. */}
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label="View full-size image"
          className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink-900/60 text-white backdrop-blur-sm transition-colors hover:bg-ink-900/80"
        >
          <ExpandIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {lightboxOpen && (
        <Lightbox
          images={images}
          active={active}
          name={name}
          onNavigate={setActive}
          onClose={() => setLightboxOpen(false)}
        />
      )}
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2.5">
          {images.slice(0, images.length > 4 ? 3 : 4).map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Image ${i + 1} of ${images.length}`}
                aria-current={i === active ? 'true' : undefined}
                className={`h-16 w-16 overflow-hidden rounded-lg transition-all ${
                  i === active
                    ? 'ring-2 ring-primary-600 ring-offset-2'
                    : 'ring-1 ring-surface-border hover:ring-primary-400'
                }`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
          {/* Design's "+2" overflow tile — advances through the hidden images. */}
          {images.length > 4 && (
            <li>
              <button
                type="button"
                onClick={() => setActive(active >= 3 && active < images.length - 1 ? active + 1 : 3)}
                aria-label={`Show ${images.length - 3} more images`}
                className={`flex h-16 w-16 items-center justify-center rounded-lg bg-surface-subtle text-sm font-semibold text-ink-600 transition-all ${
                  active >= 3 ? 'ring-2 ring-primary-600 ring-offset-2' : 'ring-1 ring-surface-border'
                }`}
              >
                +{images.length - 3}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Long prose folds behind "Read more" (design). React escapes the text by
 * default — user-generated content is never injected as HTML.
 */
function Description({ text }) {
  const [expanded, setExpanded] = useState(false);
  const foldable = text.length > 400;
  return (
    <div>
      {/* max-w-4xl, not max-w-prose (2026-08-14): at the page's full-bleed
          width a 65ch column left ~60% of the card empty — the wider measure
          with slightly larger text keeps it readable without the barren
          right side. */}
      <p
        className={`max-w-4xl whitespace-pre-line text-[15px] leading-relaxed text-ink-700 ${
          foldable && !expanded ? 'line-clamp-[8]' : ''
        }`}
      >
        {text}
      </p>
      {foldable && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm font-medium text-primary-700 hover:underline"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

/**
 * The "Trade specifications" / "Engagement details" card — its own bordered
 * panel (2026-08-12 redesign) with a leading icon per row, matching the
 * reference. Was previously a plain label/value list folded in under the
 * seller card with just a small-caps heading; that's now the seller card's
 * own space to breathe, and this stands as a clearly separate fact sheet.
 */
function Facts({ product, layout = 'list' }) {
  const isService = product.category?.type === 'service';
  const rows = (isService ? SERVICE_FACTS : GOODS_FACTS)
    .map(([key, label, Icon]) => {
      let value = product[key];
      if (value === null || value === undefined || value === '') return null;
      if (key === 'countryOfOrigin') value = countryName(value) ?? value;
      return [key, label, value, Icon];
    })
    .filter(Boolean);

  // Only filled fields render — never a wall of "—".
  if (rows.length === 0) return null;

  // The mockup's Trade-terms tab: one card per fact, three across. Same rows,
  // same "blank fields never render" rule — only the container differs.
  if (layout === 'grid') {
    return (
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([key, label, value, Icon]) => (
          <li key={key} className="rounded-2xl border border-surface-border bg-surface-panel p-5">
            <p className="flex items-center gap-2 text-[13px] text-muted">
              <Icon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
              {label}
            </p>
            <p className="mt-1 text-[15px] font-semibold text-ink-900">{value}</p>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="rounded-xl border border-surface-border bg-white p-4">
      <h2 className="mb-1 text-sm font-bold text-ink-900">
        {isService ? 'Engagement details' : 'Trade specifications'}
      </h2>
      <dl className="divide-y divide-surface-border/60">
        {rows.map(([key, label, value, Icon]) => (
          <div key={key} className="flex items-center justify-between gap-6 py-2.5">
            <dt className="flex items-center gap-2 text-sm text-muted">
              <Icon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
              {label}
            </dt>
            <dd className="text-right text-sm font-medium text-ink-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}


/** First two presentable attribute values, mirroring the product card's chips. */
function headlineChips(attributes = []) {
  return attributes
    .filter((a) => a && a.value != null && a.value !== '' && typeof a.value !== 'boolean')
    .slice(0, 3)
    .map((a) => (typeof a.value === 'number' ? `${a.value} ${a.key}` : String(a.value)));
}

/**
 * The mockup's "Key attributes" box — the first few specs as a grid, so a buyer
 * sees material/size/grade without opening a tab. The full set still lives in
 * the Attributes tab; this is a lede, not a duplicate store of truth.
 */
function KeyAttributes({ attributes = [] }) {
  const rows = attributes
    .filter((a) => a && a.value != null && a.value !== '' && typeof a.value !== 'boolean')
    .slice(0, 6);
  if (rows.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-[15px] font-bold text-ink-900">Key attributes</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl bg-surface-panel p-5 sm:grid-cols-3">
        {rows.map((a) => (
          <div key={a.key} className="min-w-0">
            <dt className="truncate text-xs text-muted">{a.key}</dt>
            <dd className="mt-0.5 truncate text-sm font-semibold text-ink-900">{String(a.value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * "Sourcing on MPX" — the mockup's trust panel.
 *
 * 🔴 Every line here is a statement about how THIS PLATFORM works, not a claim
 * about the supplier: those would need per-seller data that does not exist
 * (response time, enquiries answered, monthly capacity — all square-bracket
 * placeholders in the mockup). Each sentence below is literally true of the
 * built system, which is the only reason it can be shown on every listing.
 */
function SourcingCard() {
  const rows = [
    [ShieldIcon, 'Human-verified suppliers', 'Business documents are reviewed by our team before a supplier earns the tick.'],
    [ClockIcon, 'Every message on record', 'Your enquiry and chat history stay in your account.'],
    [GlobeIcon, 'Shipping quoted by the supplier', 'Freight terms are agreed inside the quote, not assumed here.'],
  ];
  return (
    <section className="rounded-2xl border border-surface-border bg-white p-5">
      <h2 className="text-[15px] font-bold text-ink-900">Sourcing on MPX</h2>
      <ul className="mt-3 space-y-3.5">
        {rows.map(([Icon, title, body]) => (
          <li key={title} className="flex gap-2.5">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
            <span>
              <span className="block text-[13px] font-semibold text-ink-900">{title}</span>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProductDetail() {
  const { slug } = useParams();

  const product = useQuery({
    queryKey: catalogueKeys.product(slug),
    queryFn: () => catalogueApi.product(slug),
    retry: false, // a 404 is a real answer
  });

  const p = product.data;
  const [tab, setTab] = useState(DETAIL_TABS[0]);
  // m3-seo §2 — canonical to the clean slug URL (never the current search).
  useCanonical(p?.slug ? `/product/${p.slug}` : null);

  // The product stores `{ key, value }` snapshots only — the LABELS and units
  // live on the category's attribute definitions, so the spec table needs both.
  const attrs = useQuery({
    queryKey: catalogueKeys.attributes(p?.category?.slug),
    queryFn: () => catalogueApi.attributes(p.category.slug),
    enabled: Boolean(p?.category?.slug),
  });

  // "More in this category" — the same public list the category page uses;
  // the current product is filtered out client-side.
  const related = useQuery({
    queryKey: catalogueKeys.products({ category: p?.category?.slug, page: 1, pageSize: 5 }),
    queryFn: () => catalogueApi.products({ category: p.category.slug, page: 1, pageSize: 5 }),
    enabled: Boolean(p?.category?.slug),
  });
  const relatedRows = (related.data?.products ?? []).filter((r) => r.slug !== slug).slice(0, 4);

  /**
   * Fallback (2026-08-13, owner: "if there is not same category try to
   * match with another thing... check with the [parent] category") — when
   * this product's own leaf category has no OTHER live listings (a real,
   * common state on sparse/seed data — e.g. "Denim" with exactly one
   * product), broaden to the PARENT category instead of hiding the section
   * outright. `category` on `/public/products` already resolves a TOP id to
   * every LEAF under it server-side (`resolveCategoryLeafIds` — the same
   * mechanism the category browse page's top-level pages use), so this is
   * one more real query, not a client-side reshuffle of unrelated products.
   * Only fires once the primary query has actually resolved empty — never
   * fetched speculatively alongside it — and only when a parent exists (a
   * top-level category's `parentId` is null; nothing broader to fall back to).
   */
  const needsFallback = related.isSuccess && relatedRows.length === 0 && Boolean(p?.category?.parentId);

  const relatedFallback = useQuery({
    queryKey: catalogueKeys.products({ category: p?.category?.parentId, page: 1, pageSize: 5 }),
    queryFn: () => catalogueApi.products({ category: p.category.parentId, page: 1, pageSize: 5 }),
    enabled: needsFallback,
  });
  const fallbackRows = (relatedFallback.data?.products ?? []).filter((r) => r.slug !== slug).slice(0, 4);

  // Only fetched to LABEL the fallback honestly — "More in Denim" would be
  // wrong once the row is actually showing products from "Textiles, Fabrics
  // & Yarn". Cheap: one category by id, not the whole tree.
  const parentCategory = useQuery({
    queryKey: catalogueKeys.category(p?.category?.parentId),
    queryFn: () => catalogueApi.category(p.category.parentId),
    enabled: needsFallback,
  });

  const usingFallback = needsFallback && fallbackRows.length > 0;
  const relatedSection = usingFallback
    ? { rows: fallbackRows, category: parentCategory.data }
    : { rows: relatedRows, category: p?.category };

  useEffect(() => {
    if (!p) return undefined;
    const previous = document.title;
    document.title = `${p.name} — MPX Global`;
    return () => { document.title = previous; };
  }, [p]);

  if (product.isError) return <NotFound />;

  const chips = p ? headlineChips(p.attributes) : [];

  return (
    /* 🎨 WHITE page, with `surface-panel` (#F8F8F8) for the INSET blocks —
       owner, 2026-09-23. It replaced a warm `surface-canvas` ground, which put a
       beige wash behind white cards and, next to the red price block, gave the
       page three competing tints. White + one neutral recess reads calmer and
       lets the brand red mean something again. */
    <div className="flex min-h-screen flex-col bg-white text-ink-900">
      <PublicHeader current="Categories" />

      <main className="flex-1">
        <div className="w-full px-4 py-6 sm:px-6 md:py-8 lg:px-10 xl:px-16">
          {product.isPending && (
            <div className="grid gap-5 lg:grid-cols-12">
              <Skeleton className="aspect-[4/3] w-full rounded-2xl lg:col-span-5 xl:col-span-4" />
              <div className="space-y-4 lg:col-span-7 xl:col-span-5">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
              <Skeleton className="h-64 w-full rounded-2xl lg:col-span-12 xl:col-span-3" />
            </div>
          )}

          {p && (
            <>
              <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                <Link to="/categories" className="hover:text-primary-700">Categories</Link>
                <ChevronRightIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
                {p.category && (
                  <>
                    <Link to={`/category/${p.category.slug}`} className="hover:text-primary-700">
                      {p.category.name}
                    </Link>
                    <ChevronRightIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
                  </>
                )}
                <span className="font-medium text-ink-800">{p.name}</span>
              </nav>

              {/* Three columns at xl, as the mockup draws them. Below xl the
                  quote rail spans the full width UNDER the other two rather
                  than being squeezed — a 320px card and a product summary do
                  not both fit at 1024px. */}
              <div className="grid gap-5 lg:grid-cols-12">
                {/* ───────── LEFT · gallery + who is selling ───────── */}
                <div className="space-y-4 lg:col-span-5 lg:sticky lg:top-24 lg:self-start xl:col-span-4">
                  <div className="overflow-hidden rounded-2xl border border-surface-border bg-white p-3">
                    <Gallery images={p.images} name={p.name} productId={p.id} />
                  </div>

                  {/* Seller block — the PUBLIC projection only. Never contact
                      details, never a city, never `kycStatus`.
                      🔴 The mockup also shows response time, live listings,
                      enquiries answered, monthly capacity, main markets and a
                      "How this supplier was verified" link. None of those exist
                      on `Organisation`, and the last one must not: the public
                      API deliberately returns `verified` + `verifiedAt` and
                      nothing about HOW (B7 / m3-public-projection.md). */}
                  {p.seller && (
                    <Link
                      to={`/supplier/${p.seller.slug}`}
                      className="flex items-center gap-3 rounded-2xl border border-surface-border bg-white p-4 transition-all hover:border-primary-600 hover:shadow-card"
                    >
                      {p.seller.logo ? (
                        <img src={p.seller.logo} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <NoImagePanel label={p.seller.name} monogram ratio="h-11 w-11" className="shrink-0 rounded-lg" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink-900">{p.seller.name}</span>
                          {p.seller.verified && (
                            <VerifiedTick verified compact={false} className="rounded-full bg-success-50 px-2 py-0.5" />
                          )}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                          {(countryName(p.seller.country) ?? p.seller.country) && (
                            <span className="inline-flex items-center gap-1">
                              <MapPinIcon className="h-3.5 w-3.5" aria-hidden="true" />
                              {countryName(p.seller.country) ?? p.seller.country}
                            </span>
                          )}
                          {p.seller.memberSince && (
                            <span className="inline-flex items-center gap-1">
                              <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
                              Since {p.seller.memberSince}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <UsersIcon className="h-3.5 w-3.5" aria-hidden="true" />
                            {p.seller.entityType === 'individual' ? 'Individual' : 'Business'}
                          </span>
                        </span>
                      </span>
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
                    </Link>
                  )}
                </div>

                {/* ───────── CENTRE · what the thing is ───────── */}
                <section className="rounded-2xl border border-surface-border bg-white p-5 sm:p-7 lg:col-span-7 xl:col-span-5">
                  {p.category && (
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-700">
                      {p.category.name}
                      {p.category.type && <span className="text-ink-400"> · {p.category.type}</span>}
                    </p>
                  )}
                  <h1 className="mt-1.5 font-serif text-2xl leading-tight text-ink-900 sm:text-[1.9rem]">
                    {p.name}
                  </h1>

                  {/* Mockup's meta strip. It also shows an enquiry COUNT — left
                      out deliberately: it is not in the public projection, and
                      publishing how many enquiries a listing has had exposes a
                      seller's commercial position to their competitors. */}
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                    {p.listedSince && (
                      <span className="inline-flex items-center gap-1.5">
                        <ClockIcon className="h-4 w-4" aria-hidden="true" />
                        Listed {formatDate(p.listedSince)}
                      </span>
                    )}
                    {p.hsCode && (
                      <span className="inline-flex items-center gap-1.5">
                        <TagIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        HS {p.hsCode}
                      </span>
                    )}
                  </p>

                  {chips.length > 0 && (
                    <p className="mt-3 flex flex-wrap gap-1.5">
                      {chips.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-2.5 py-1 text-xs font-medium text-ink-700"
                        >
                          <TagIcon className="h-3 w-3 shrink-0 text-ink-400" aria-hidden="true" />
                          {c}
                        </span>
                      ))}
                    </p>
                  )}

                  {/* 🔴 The mockup prices this in four QUANTITY BANDS
                      (₹520 / ₹480 / ₹430 / ₹390). `Product.price` holds
                      `{mode, min, max, currency}` and nothing else — there are no
                      tiers to render, and inventing a ladder would put prices on
                      the page that the supplier never quoted. The real range is
                      shown instead, and `PriceLine` formats the product's OWN
                      currency (the catalogue mixes INR and USD — the mockup's ₹
                      is not universal). */}
                  {/* Neutral, not the old pink `primary-50` slab: on a white page it
                      dominated every screenshot and competed with the one red
                      element that should — the enquiry button. The price is loud
                      because of its SIZE now, not its fill. */}
                  <div className="mt-5 rounded-xl border border-surface-border bg-surface-panel p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs text-muted">Indicative price</p>
                      <p className="max-w-[190px] text-right text-[11px] leading-snug text-muted">
                        Final price is confirmed in the supplier&apos;s reply
                      </p>
                    </div>
                    <div className="mt-1">
                      <PriceLine price={p.price} unit={p.unit} size="lg" />
                    </div>
                    {(p.moq != null || p.supplyAbility || p.leadTime) && (
                      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-surface-border pt-3 sm:grid-cols-3">
                        {p.moq != null && (
                          <div>
                            <p className="text-xs text-muted">Minimum order</p>
                            <p className="text-sm font-semibold text-ink-900">
                              {p.moq.toLocaleString('en-IN')}
                              {p.unit ? ` ${p.unit}` : ''}
                            </p>
                          </div>
                        )}
                        {p.supplyAbility && (
                          <div>
                            <p className="text-xs text-muted">Supply ability</p>
                            <p className="text-sm font-semibold text-ink-900">{p.supplyAbility}</p>
                          </div>
                        )}
                        {p.leadTime && (
                          <div>
                            <p className="text-xs text-muted">Lead time</p>
                            <p className="text-sm font-semibold text-ink-900">{p.leadTime}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 🔴 Between the price and this box the mockup places a
                      SAMPLE row ("₹X for 2 m swatch" + Ask for sample), a FINISH
                      variant picker (Greige / Bleached / Dyed) and a
                      CUSTOMIZATION list. None exist: `Product` has no sample
                      price, no variants, and seller-defined extra fields were
                      CANCELLED by §A17 (still an open question with the owner).
                      Rendering any of them would be a dead control
                      (`web-ui-notes.md`). */}
                  <KeyAttributes attributes={p.attributes} />
                </section>

                {/* ───────── RIGHT · the one action ───────── */}
                <div className="space-y-4 lg:col-span-12 xl:col-span-3 xl:sticky xl:top-24 xl:self-start">
                  <EnquiryButton product={p} framed />
                  <SourcingCard />
                </div>
              </div>

              {/* ───────── tabbed detail ───────── */}
              <div
                role="tablist"
                aria-label="Product details"
                className="mt-8 flex gap-8 overflow-x-auto border-b border-surface-border text-[15px]"
              >
                {DETAIL_TABS.map((t) => {
                  const id = t.replace(/\s+/g, '-').toLowerCase();
                  return (
                    <button
                      key={t}
                      role="tab"
                      type="button"
                      id={`tab-${id}`}
                      aria-controls={`panel-${id}`}
                      aria-selected={tab === t}
                      onClick={() => setTab(t)}
                      className={`-mb-px whitespace-nowrap py-3.5 transition-colors ${
                        tab === t
                          ? 'border-b-2 border-primary-600 font-semibold text-ink-900'
                          : 'text-muted hover:text-ink-900'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>

              {/* Every panel is in the DOM; `hidden` only hides it. See the
                  DETAIL_TABS note — mounting on click would hide the description
                  from crawlers. */}
              <div className="mt-6">
                <div id="panel-trade-terms" role="tabpanel" aria-labelledby="tab-trade-terms" hidden={tab !== 'Trade terms'}>
                  {/* `Facts` returns null when the seller filled in none of
                      these — an honest empty tab, not a wall of dashes. */}
                  <Facts product={p} layout="grid" />
                </div>

                <div id="panel-attributes" role="tabpanel" aria-labelledby="tab-attributes" hidden={tab !== 'Attributes'}>
                  {p.attributes?.length > 0 ? (
                    <SpecTable attributes={p.attributes} defs={attrs.data?.attributes ?? []} columns={2} />
                  ) : (
                    <p className="text-sm text-muted">The supplier has not listed specifications yet.</p>
                  )}
                </div>

                <div id="panel-supplier" role="tabpanel" aria-labelledby="tab-supplier" hidden={tab !== 'Supplier'}>
                  {p.seller && (
                    <div className="max-w-2xl">
                      {p.seller.description ? (
                        <p className="text-base leading-relaxed text-ink-700">{p.seller.description}</p>
                      ) : (
                        <p className="text-sm text-muted">
                          This supplier has not written a company description yet.
                        </p>
                      )}
                      {/* 🔴 Verified sellers only, and the wording is careful: the
                          DOCUMENTS were reviewed, never the goods. For an
                          unverified seller nothing renders in its place — there is
                          no "not verified" badge, by standing rule. */}
                      {p.seller.verified && (
                        <div className="mt-4 flex items-start gap-3 rounded-xl bg-primary-50 p-4">
                          <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" aria-hidden="true" />
                          <p className="text-sm leading-relaxed text-ink-700">
                            This supplier&apos;s business documents were reviewed by the MPX team.
                            Always confirm specs, samples and terms in the enquiry before placing an order.
                          </p>
                        </div>
                      )}
                      <Link
                        to={`/supplier/${p.seller.slug}`}
                        className="mt-4 inline-block text-sm font-semibold text-primary-700 hover:underline"
                      >
                        View full supplier profile →
                      </Link>
                    </div>
                  )}
                </div>

                <div id="panel-description" role="tabpanel" aria-labelledby="tab-description" hidden={tab !== 'Description'}>
                  {p.description ? (
                    <Description text={p.description} />
                  ) : (
                    <p className="text-sm text-muted">The supplier has not written a description yet.</p>
                  )}
                </div>
              </div>

              {relatedSection.rows.length > 0 && relatedSection.category && (
                <section className="mt-10">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-ink-900">
                      More in {relatedSection.category.name}
                    </h2>
                    <Link
                      to={`/category/${relatedSection.category.slug}`}
                      className="text-sm font-medium text-primary-700 hover:underline"
                    >
                      View category →
                    </Link>
                  </div>
                  <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
                    {relatedSection.rows.map((r) => (
                      <ProductCard key={r.id} product={r} to={`/product/${r.slug}`} />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {product.isError === false && !product.isPending && !p && (
            <ErrorState onRetry={product.refetch} />
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
