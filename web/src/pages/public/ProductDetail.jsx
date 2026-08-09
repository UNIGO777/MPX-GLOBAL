import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { PriceLine } from '../../components/catalogue/PriceLine.jsx';
import { SpecTable } from '../../components/catalogue/SpecTable.jsx';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import { ChevronRightIcon } from '../../components/ui/icons.jsx';
import { countryName } from '../../lib/countries.js';
import { formatMonth } from '../../lib/format.js';
import { NotFound } from './NotFound.jsx';

/**
 * M2 web screen 3 — public product detail (`/product/:slug`).
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
  ['moq', 'Minimum order'],
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
    return <NoImagePanel ratio="aspect-[4/3]" className="rounded-lg border border-surface-border" />;
  }

  return (
    <div>
      <img
        src={images[active]}
        alt={name}
        className="aspect-[4/3] w-full rounded-lg border border-surface-border bg-white object-cover"
      />
      {images.length > 1 && (
        <ul className="mt-3 flex gap-3">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Image ${i + 1} of ${images.length}`}
                aria-current={i === active ? 'true' : undefined}
                className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${
                  i === active ? 'border-primary-600' : 'border-surface-border'
                }`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
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
      if (key === 'moq') value = `${value.toLocaleString('en-IN')}${product.unit ? ` ${product.unit}` : ''}`;
      if (key === 'countryOfOrigin') value = countryName(value) ?? value;
      return [label, value];
    })
    .filter(Boolean);

  // Only filled fields render — never a wall of "—".
  if (rows.length === 0) return null;

  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 border-b border-surface-border pb-3">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="text-right text-sm font-medium text-ink-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-lg border border-surface-border bg-white p-6 shadow-card">
      {title && <h2 className="mb-4 text-lg font-bold text-ink-900">{title}</h2>}
      {children}
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

  // The product stores `{ key, value }` snapshots only — the LABELS and units
  // live on the category's attribute definitions, so the spec table needs both.
  const attrs = useQuery({
    queryKey: catalogueKeys.attributes(p?.category?.slug),
    queryFn: () => catalogueApi.attributes(p.category.slug),
    enabled: Boolean(p?.category?.slug),
  });

  useEffect(() => {
    if (!p) return undefined;
    const previous = document.title;
    document.title = `${p.name} — MPX Global`;
    return () => { document.title = previous; };
  }, [p]);

  if (product.isError) return <NotFound />;

  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle text-ink-900">
      <PublicHeader current="Categories" />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-12">
          {product.isPending && (
            <div className="grid gap-10 lg:grid-cols-2">
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-24 w-full" />
              </div>
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

              <div className="grid gap-10 lg:grid-cols-2">
                <Gallery images={p.images} name={p.name} />

                <div>
                  <h1 className="text-2xl font-bold leading-tight text-ink-900 sm:text-3xl">{p.name}</h1>
                  {p.listedSince && (
                    <p className="mt-1.5 text-sm text-muted">Listed {formatMonth(p.listedSince)}</p>
                  )}

                  <div className="mt-5">
                    <PriceLine price={p.price} unit={p.unit} size="lg" />
                  </div>

                  {/* Seller block — the public projection only. Never contact
                      details, never verification status, never `website`. */}
                  {p.seller && (
                    <Link
                      to={`/supplier/${p.seller.slug}`}
                      className="mt-6 flex items-start gap-3 rounded-lg border border-surface-border bg-white p-4 transition-colors hover:border-primary-600"
                    >
                      {p.seller.logo ? (
                        <img src={p.seller.logo} alt="" className="h-11 w-11 rounded-lg object-cover" />
                      ) : (
                        <NoImagePanel
                          label={p.seller.name}
                          monogram
                          ratio="h-11 w-11"
                          className="shrink-0 rounded-lg"
                        />
                      )}
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink-900">{p.seller.name}</span>
                          <VerifiedTick verified={p.seller.verified} />
                        </span>
                        <span className="mt-0.5 block text-sm text-muted">
                          {[countryName(p.seller.country) ?? p.seller.country,
                            p.seller.entityType === 'individual' ? 'Individual' : 'Business']
                            .filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </Link>
                  )}

                  <div className="mt-6">
                    <Facts product={p} />
                  </div>
                </div>
              </div>

              <div className="mt-10 grid gap-6 lg:grid-cols-2">
                {p.description && (
                  <Panel title="Description">
                    {/* React escapes this by default — user-generated text is
                        never injected as HTML (dangerouslySetInnerHTML is banned). */}
                    <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink-700">
                      {p.description}
                    </p>
                  </Panel>
                )}
                {p.attributes?.length > 0 && (
                  <Panel title="Specifications">
                    <SpecTable attributes={p.attributes} defs={attrs.data?.attributes ?? []} />
                  </Panel>
                )}
              </div>
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
