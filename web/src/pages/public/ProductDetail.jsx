import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { PriceLine } from '../../components/catalogue/PriceLine.jsx';
import { ProductCard } from '../../components/catalogue/ProductCard.jsx';
import { SpecTable } from '../../components/catalogue/SpecTable.jsx';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import { ChevronRightIcon, DocIcon, ListIcon } from '../../components/ui/icons.jsx';
import { countryName } from '../../lib/countries.js';
import { formatMonth } from '../../lib/format.js';
import { NotFound } from './NotFound.jsx';

/**
 * M2 web screen 3 — public product detail (`/product/:slug`).
 *
 * REDESIGNED 2026-08-11 to the converged public language: gallery left, a
 * structured BUY PANEL right (name → spec chips → highlighted price block with
 * MOQ → supplier card → trade facts), icon-chip panels for description and
 * specifications, and a "More in {category}" row of real product cards.
 *
 * 🔴 THE COPY CONSTRAINTS ARE THE POINT OF THIS SCREEN:
 *  - No status word anywhere. Only `active` products are queryable, so "Live",
 *    "Available" or "In stock" would be noise at best and a leak at worst.
 *  - No negative verification text. An unverified seller's block is identical,
 *    minus the tick — there is no badge, chip or sentence in its place.
 *  - No enquiry / contact / quote button. That is Module 4; a placeholder here
 *    would promise a path that does not exist.
 *  - The gallery shows ONLY the seller's own images. Never stock filler.
 *  - Never email, phone, street address or website — `website` in particular is
 *    internal and has reached a public response once before.
 *
 * Anything unavailable (draft · inactive · archived · taken down · dead
 * category) 404s from the API and renders the shared not-found page, all
 * deliberately indistinguishable from each other.
 */

/** Goods and service listings carry different field groups; the leaf's type decided which. */
const GOODS_FACTS = [
  ['hsCode', 'HS code'],
  ['countryOfOrigin', 'Country of origin'],
  ['supplyAbility', 'Supply ability'],
  ['leadTime', 'Lead time'],
  ['packaging', 'Packaging'],
  ['terms', 'Payment terms'],
];
const SERVICE_FACTS = [
  ['engagementType', 'Engagement type'],
  ['deliveryModel', 'Delivery model'],
  ['teamSize', 'Team size'],
  ['pricingModel', 'Pricing model'],
  ['timeline', 'Timeline'],
];

function Gallery({ images = [], name }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    // Publishing does not require a photo, so this is a normal listing, not a
    // broken one — one designed panel, never an empty carousel.
    return <NoImagePanel ratio="aspect-[4/3]" className="rounded-xl border border-surface-border" />;
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-surface-border bg-white">
        <img src={images[active]} alt={name} className="aspect-[4/3] w-full object-cover" />
      </div>
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
      <p
        className={`max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink-700 ${
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

function Facts({ product }) {
  const isService = product.category?.type === 'service';
  const rows = (isService ? SERVICE_FACTS : GOODS_FACTS)
    .map(([key, label]) => {
      let value = product[key];
      if (value === null || value === undefined || value === '') return null;
      if (key === 'countryOfOrigin') value = countryName(value) ?? value;
      return [label, value];
    })
    .filter(Boolean);

  // Only filled fields render — never a wall of "—".
  if (rows.length === 0) return null;

  return (
    <div>
      <h2 className="mb-2 border-t border-surface-border pt-4 text-xs font-semibold uppercase tracking-wider text-muted">
        {isService ? 'Engagement details' : 'Trade facts'}
      </h2>
      <dl className="divide-y divide-surface-border/60">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-6 py-2">
            <dt className="text-sm text-muted">{label}</dt>
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

  useEffect(() => {
    if (!p) return undefined;
    const previous = document.title;
    document.title = `${p.name} — MPX Global`;
    return () => { document.title = previous; };
  }, [p]);

  if (product.isError) return <NotFound />;

  const chips = p ? headlineChips(p.attributes) : [];

  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle text-ink-900">
      <PublicHeader current="Categories" />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-10">
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
                  <Gallery images={p.images} name={p.name} />

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
                      <p className="mt-1.5 text-sm text-muted">Listed {formatMonth(p.listedSince)}</p>
                    )}

                    {chips.length > 0 && (
                      <p className="mt-3 flex flex-wrap gap-1.5">
                        {chips.map((c) => (
                          <span
                            key={c}
                            className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-700"
                          >
                            {c}
                          </span>
                        ))}
                      </p>
                    )}

                    {/* Price block — the panel's anchor, MOQ beside it, exactly
                        like the card promises in the grid. */}
                    <div className="mt-5 rounded-xl bg-surface-subtle p-4">
                      <PriceLine price={p.price} unit={p.unit} size="lg" />
                      {p.moq != null && (
                        <p className="mt-1 text-sm text-muted">
                          Minimum order {p.moq.toLocaleString('en-IN')}
                          {p.unit ? ` ${p.unit}` : ''}
                        </p>
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
                            <VerifiedTick verified={p.seller.verified} />
                          </span>
                          <span className="mt-0.5 block text-sm text-muted">
                            {[countryName(p.seller.country) ?? p.seller.country,
                              p.seller.entityType === 'individual' ? 'Individual' : 'Business',
                              p.seller.memberSince ? `Member since ${p.seller.memberSince}` : null]
                              .filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
                      </Link>
                    )}

                    <div className="mt-5">
                      <Facts product={p} />
                    </div>
                  </div>
                </div>
              </section>

              <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
                {p.description && (
                  <Panel icon={DocIcon} title="Description">
                    <Description text={p.description} />
                  </Panel>
                )}
                {p.attributes?.length > 0 && (
                  <Panel icon={ListIcon} title="Specifications">
                    <SpecTable attributes={p.attributes} defs={attrs.data?.attributes ?? []} />
                  </Panel>
                )}
              </div>

              {/* ---- more from this category ---- */}
              {relatedRows.length > 0 && p.category && (
                <section className="mt-10">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-ink-900">More in {p.category.name}</h2>
                    <Link
                      to={`/category/${p.category.slug}`}
                      className="text-sm font-medium text-primary-700 hover:underline"
                    >
                      View all →
                    </Link>
                  </div>
                  <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
                    {relatedRows.map((r) => (
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
