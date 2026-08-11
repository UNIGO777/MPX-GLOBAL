import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { ProductCard } from '../../components/catalogue/ProductCard.jsx';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import { BoxIcon } from '../../components/ui/icons.jsx';
import { countryName } from '../../lib/countries.js';
import { NotFound } from './NotFound.jsx';

/**
 * M2 web screen 4 — public supplier profile + catalogue (`/supplier/:slug`).
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

export function SupplierProfile() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);

  const seller = useQuery({
    queryKey: catalogueKeys.exporter(slug),
    queryFn: () => catalogueApi.exporter(slug),
    retry: false,
  });

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
    document.title = `${s.name} — MPX Global`;
    return () => { document.title = previous; };
  }, [s]);

  if (seller.isError) return <NotFound />;

  const total = products.data?.total ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle text-ink-900">
      <PublicHeader />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-12">
          {/* --- Company header: profile composition — brand cover band,
              overlapping logo, name + tick, stat chips (2026-08-11 redesign).
              The tick's ABSENCE stays the entire "not verified" signal. --- */}
          <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
            <div
              aria-hidden="true"
              className="h-24 bg-gradient-to-r from-primary-800 via-primary-700 to-primary-500 sm:h-28"
            />
            {seller.isPending ? (
              <div className="px-5 pb-6 sm:px-8">
                <Skeleton className="-mt-10 h-20 w-20 rounded-2xl" />
                <Skeleton className="mt-4 h-8 w-64" />
                <Skeleton className="mt-3 h-6 w-96 rounded-full" />
              </div>
            ) : (
              <div className="px-5 pb-6 sm:px-8">
                <div className="-mt-10">
                  {s.logo ? (
                    <img
                      src={s.logo}
                      alt=""
                      className="h-20 w-20 rounded-2xl object-cover ring-4 ring-white"
                    />
                  ) : (
                    <NoImagePanel
                      label={s.name}
                      monogram
                      ratio="h-20 w-20"
                      className="rounded-2xl ring-4 ring-white"
                    />
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{s.name}</h1>
                  <VerifiedTick verified={s.verified} verifiedAt={s.verifiedAt} />
                </div>

                <p className="mt-3 flex flex-wrap items-center gap-2">
                  {[
                    countryName(s.country) ?? s.country,
                    s.entityType === 'individual' ? 'Individual' : 'Business',
                    s.establishedYear ? `Established ${s.establishedYear}` : null,
                    s.memberSince ? `Member since ${s.memberSince}` : null,
                  ]
                    .filter(Boolean)
                    .map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center rounded-full border border-surface-border bg-white px-3 py-1 text-xs font-medium text-ink-700"
                      >
                        {item}
                      </span>
                    ))}
                  {/* BoxIcon, deliberately NOT a check/badge — a badge-shaped
                      icon here could read as verification on unverified pages. */}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                    <BoxIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {s.productCount} {s.productCount === 1 ? 'product' : 'products'}
                  </span>
                </p>

                {s.description && (
                  <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-700">
                    {s.description}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* --- Catalogue --- */}
          <section className="mt-6">
            <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-surface-border bg-white px-4 py-2.5 shadow-card">
              <h2 className="text-[15px] font-bold text-ink-900">Products</h2>
              {products.isSuccess && (
                <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
                  {total}
                </span>
              )}
              <span className="ml-auto text-xs text-muted">Sorted by newest</span>
            </div>

            {(seller.isPending || products.isPending) && (
              <ul className={GRID} aria-busy="true" aria-label="Loading products">
                {Array.from({ length: 3 }, (_, i) => (
                  <li key={i} className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
                    <Skeleton className="aspect-[4/3] w-full rounded-none" />
                    <div className="space-y-3 p-4">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-6 w-1/2" />
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
                    // showSeller={false}: every card here has the same seller,
                    // so repeating the name and tick is noise.
                    <ProductCard
                      key={product.id}
                      product={product}
                      showSeller={false}
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
