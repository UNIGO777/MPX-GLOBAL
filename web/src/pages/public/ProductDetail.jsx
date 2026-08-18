import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CreditCardIcon,
  DocIcon,
  ExpandIcon,
  GlobeIcon,
  ListIcon,
  MapPinIcon,
  TagIcon,
  UsersIcon,
  XIcon,
} from '../../components/ui/icons.jsx';
import { countryName } from '../../lib/countries.js';
import { useCanonical } from '../../lib/seo.js';
import { formatDate } from '../../lib/format.js';
import { NotFound } from './NotFound.jsx';

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
 * Fullscreen image view, triggered by `Gallery`'s expand button. A real
 * modal (web-design.md: "modals trap focus and close on Esc"), not a bare
 * `<img>` swapped to `position: fixed` — focus moves to the close button on
 * open and back to whatever triggered it on close, Tab cycles only within
 * the modal's own controls, Escape and a backdrop click both close it.
 */
function Lightbox({ images, active, name, onNavigate, onClose }) {
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        onNavigate((active + 1) % images.length);
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        onNavigate((active - 1 + images.length) % images.length);
      } else if (e.key === 'Tab') {
        // Lightweight focus trap — the modal only ever has 1-3 buttons
        // (close, and prev/next when there's more than one image).
        const focusable = document.querySelectorAll('[data-lightbox] button');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    document.querySelector('[data-lightbox-close]')?.focus();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Portalled to `document.body` (2026-08-12 bugfix, found while testing this
  // exact modal) — rendered in place, this modal's `fixed` + `z-50` was
  // trapped inside the gallery's own `sticky` wrapper (added earlier for the
  // dead-space fix), which unconditionally opens its own stacking context.
  // The header's `z-40` then painted OVER the modal despite the lower
  // number, because the two were never actually competing in the same
  // stacking context — the close button rendered correctly but was
  // genuinely unclickable. A portal escapes every ancestor's stacking
  // context, so z-50 now competes for real at the document root.
  return createPortal(
    <div
      data-lightbox
      role="dialog"
      aria-modal="true"
      aria-label={`${name} — full-size image`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/90 p-6"
      onClick={onClose}
    >
      <button
        type="button"
        data-lightbox-close
        onClick={onClose}
        aria-label="Close full-size image"
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <XIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((active - 1 + images.length) % images.length);
          }}
          aria-label="Previous image"
          className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <ChevronLeftIcon className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      <img
        src={images[active]}
        alt={name}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
      />

      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((active + 1) % images.length);
          }}
          aria-label="Next image"
          className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <ChevronRightIcon className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      {images.length > 1 && (
        <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-sm font-medium text-white/80">
          {active + 1} / {images.length}
        </p>
      )}
    </div>,
    document.body,
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
function Facts({ product }) {
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

/** Icon-chip panel — same grammar as the console's section cards. */
function Panel({ icon: Icon, title, children }) {
  return (
    <section className="rounded-2xl border border-surface-border bg-white shadow-card">
      <header className="flex items-center gap-3 border-b border-ink-100 px-6 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <h2 className="text-[15px] font-bold text-ink-900">{title}</h2>
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

/** First two presentable attribute values, mirroring the product card's chips. */
function headlineChips(attributes = []) {
  return attributes
    .filter((a) => a && a.value != null && a.value !== '' && typeof a.value !== 'boolean')
    .slice(0, 3)
    .map((a) => (typeof a.value === 'number' ? `${a.value} ${a.key}` : String(a.value)));
}

export function ProductDetail() {
  const { slug } = useParams();

  const product = useQuery({
    queryKey: catalogueKeys.product(slug),
    queryFn: () => catalogueApi.product(slug),
    retry: false, // a 404 is a real answer
  });

  const p = product.data;
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
    <div className="flex min-h-screen flex-col bg-white text-ink-900">
      <PublicHeader current="Categories" />

      <main className="flex-1">
        <div className="w-full px-4 py-8 sm:px-6 md:py-10">
          {product.isPending && (
            <div className="grid gap-10 lg:grid-cols-2">
              <Skeleton className="aspect-[4/3] w-full rounded-xl" />
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            </div>
          )}

          {p && (
            <>
              <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
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

              <section className="rounded-2xl border border-surface-border bg-white p-5 shadow-card sm:p-8">
                <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
                  {/* `self-start` + `sticky`: the buy panel (badges, price,
                      seller card, trade facts) usually runs taller than a
                      single 4:3 photo. Without this, the grid's default
                      row-stretch left the gallery's own box exactly as tall
                      as the buy panel with nothing to fill it — a slab of
                      dead white space under the image. `self-start` lets the
                      gallery size to its own content instead of stretching;
                      `sticky` (desktop only) then keeps the photo in view as
                      the taller column scrolls past, the standard pattern on
                      product-detail pages for exactly this height mismatch. */}
                  <div className="lg:sticky lg:top-24 lg:self-start">
                    <Gallery images={p.images} name={p.name} productId={p.id} />
                  </div>

                  {/* ---- the buy panel ---- */}
                  <div>
                    {p.category && (
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-700">
                        {p.category.name}
                      </p>
                    )}
                    <h1 className="mt-1.5 text-2xl font-bold leading-tight text-ink-900 sm:text-3xl">
                      {p.name}
                    </h1>
                    {p.listedSince && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
                        <ClockIcon className="h-4 w-4" aria-hidden="true" />
                        Listed {formatDate(p.listedSince)}
                      </p>
                    )}

                    {chips.length > 0 && (
                      <p className="mt-3 flex flex-wrap gap-1.5">
                        {chips.map((c) => (
                          <span
                            key={c}
                            className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-2.5 py-1 text-xs font-medium text-ink-700"
                          >
                            {/* One generic glyph for every chip, not a
                                per-chip icon (2026-08-12 fidelity pass) — a
                                chip is just the top few attribute values in
                                whatever order the category defines, so there
                                is no reliable "this one is architecture, that
                                one is frequency" to hang a specific icon on
                                without guessing. */}
                            <TagIcon className="h-3 w-3 shrink-0 text-ink-400" aria-hidden="true" />
                            {c}
                          </span>
                        ))}
                      </p>
                    )}

                    {/* Price block — the panel's anchor. Promoted 2026-08-12
                        from a flat neutral rectangle to a tinted, bordered
                        card, with MOQ and supply ability as a two-column row
                        underneath — this is the single number a buyer is on
                        the page to find, so it should read as more than
                        just larger text. Labels are neutral muted gray, not
                        brand-blue caps (2026-08-12 fidelity pass against the
                        reference) — the price itself is the loud element. */}
                    <div className="mt-5 rounded-xl border border-primary-100 bg-primary-50 p-4">
                      <p className="text-xs text-muted">Unit price</p>
                      <div className="mt-1">
                        <PriceLine price={p.price} unit={p.unit} size="lg" />
                      </div>
                      {(p.moq != null || p.supplyAbility) && (
                        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-primary-100 pt-3">
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
                        </div>
                      )}
                    </div>

                    {/* Seller block — the public projection only. Never contact
                        details, never verification status, never `website`. */}
                    {p.seller && (
                      <Link
                        to={`/supplier/${p.seller.slug}`}
                        className="mt-5 flex items-center gap-3 rounded-xl border border-surface-border bg-white p-4 transition-all hover:border-primary-600 hover:shadow-card"
                      >
                        {p.seller.logo ? (
                          <img src={p.seller.logo} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <NoImagePanel
                            label={p.seller.name}
                            monogram
                            ratio="h-11 w-11"
                            className="shrink-0 rounded-lg"
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-ink-900">{p.seller.name}</span>
                            {/* Pill wrap around the shared `VerifiedTick` —
                                never fork its own logic/copy, that component
                                is THE single verified-state convention (its
                                own §1.1 comment). Only the container here is
                                new. */}
                            {p.seller.verified && (
                              <VerifiedTick verified compact={false} className="rounded-full bg-success-50 px-2 py-0.5" />
                            )}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                            {p.seller.memberSince && (
                              <span className="inline-flex items-center gap-1">
                                <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                Member since {p.seller.memberSince}
                              </span>
                            )}
                            {(countryName(p.seller.country) ?? p.seller.country) && (
                              <span className="inline-flex items-center gap-1">
                                <MapPinIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                {countryName(p.seller.country) ?? p.seller.country}
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

                    <div className="mt-5">
                      <Facts product={p} />
                    </div>

                    {/* M4 (2026-08-17): the disabled "Send Enquiry" placeholder
                        that sat here is now the REAL entry point — the one door
                        into chat (M4-4), in the same position. It decides its
                        own label ("Create enquiry" vs "Open chat") and renders
                        nothing at all for an exporter account or for a buyer
                        looking at their own company's listing. */}
                    <EnquiryButton product={p} />
                  </div>
                </div>
              </section>

              {/* Side by side at lg+ when BOTH exist (owner, 2026-08-14 —
                  reverses the 2026-08-12 full-width stacking); a lone panel
                  still gets the full width. Below lg they stack. */}
              <div
                className={`mt-6 grid gap-6 ${
                  p.description && p.attributes?.length > 0 ? 'lg:grid-cols-2 lg:items-start' : ''
                }`}
              >
                {p.description && (
                  <Panel icon={DocIcon} title="Description">
                    <Description text={p.description} />
                  </Panel>
                )}
                {p.attributes?.length > 0 && (
                  <Panel icon={ListIcon} title="Specifications">
                    <SpecTable attributes={p.attributes} defs={attrs.data?.attributes ?? []} columns={1} />
                  </Panel>
                )}
              </div>

              {/* ---- more from this category (or its parent — see
                  `relatedSection` above) ---- */}
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
                      View Category →
                    </Link>
                  </div>
                  <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
                    {/* The SHARED merchandising card (owner, 2026-08-14: "fix
                        below cards") — the page-local skinny variant showed a
                        category line that always duplicated the section title
                        plus a bare price; this one carries chips, MOQ and the
                        seller row, same as the category page. */}
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
