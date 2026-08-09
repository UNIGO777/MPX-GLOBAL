import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { ProductCard } from '../../components/catalogue/ProductCard.jsx';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { BoxIcon, ChevronRightIcon } from '../../components/ui/icons.jsx';
import { NotFound } from './NotFound.jsx';

/**
 * M2 web screen 2 — the products of one category (`/category/:slug`).
 *
 * The slug may be a SUB or a TOP: the server resolves a top to its active
 * sub-categories (`resolveCategoryLeafIds`), so a top page aggregates its
 * children. That is why the sibling column below reads differently for each —
 * a sub shows its siblings, a top shows its own children.
 *
 * 🔴 NO search box, filter rail, facets or sort control — all Module 3. Newest
 * first is the only order M2 has. The left column is deliberately full-width
 * NOW so M3's filter rail can move in without a re-layout, but nothing
 * filter-shaped is drawn today.
 *
 * An unknown or deactivated slug 404s from the API and renders the shared
 * not-found page — deliberately indistinguishable from a category that never
 * existed, so the page is never an oracle for hidden rows.
 */
const PAGE_SIZE = 12;
const GRID = 'grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3';

function CardSkeleton() {
  return (
    <li className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </li>
  );
}

function Crumb({ to, children, last }) {
  return (
    <>
      {to && !last ? (
        <Link to={to} className="hover:text-primary-700">{children}</Link>
      ) : (
        <span className={last ? 'font-medium text-ink-800' : undefined}>{children}</span>
      )}
      {!last && <ChevronRightIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />}
    </>
  );
}

export function CategoryListing() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);

  const category = useQuery({
    queryKey: catalogueKeys.category(slug),
    queryFn: () => catalogueApi.category(slug),
    retry: false, // a 404 here is a real answer, not a blip
  });

  // The tree is already cached by the browse page; it supplies the parent's name
  // for the breadcrumb and the sibling list, neither of which is a field on a
  // category (the public projection is name/slug/image/parentId/type).
  const tree = useQuery({ queryKey: catalogueKeys.tree, queryFn: catalogueApi.tree });

  const products = useQuery({
    queryKey: catalogueKeys.products({ category: slug, page, pageSize: PAGE_SIZE }),
    queryFn: () => catalogueApi.products({ category: slug, page, pageSize: PAGE_SIZE }),
    enabled: category.isSuccess,
    // Keeps the previous page's cards on screen while the next loads, so paging
    // does not flash the whole grid back to skeletons.
    placeholderData: (prev) => prev,
  });

  const cat = category.data;
  useEffect(() => {
    if (!cat) return undefined;
    const previous = document.title;
    document.title = `${cat.name} — MPX Global`;
    return () => { document.title = previous; };
  }, [cat]);

  if (category.isError) return <NotFound />;

  const top = cat?.parentId
    ? (tree.data ?? []).find((t) => t.id === cat.parentId)
    : (tree.data ?? []).find((t) => t.id === cat?.id);
  // A sub lists its siblings; a top lists its own children.
  const siblings = top?.subs ?? [];
  const total = products.data?.total ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle text-ink-900">
      <PublicHeader current="Categories" />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-12">
          <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <Crumb to="/categories">Categories</Crumb>
            {cat?.parentId && top && <Crumb to={`/category/${top.slug}`}>{top.name}</Crumb>}
            <Crumb last>{cat?.name ?? '…'}</Crumb>
          </nav>

          <header className="mb-8 flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-primary-800 sm:text-4xl">
              {cat?.name ?? <Skeleton className="h-9 w-64" />}
            </h1>
            {products.isSuccess && (
              <p className="text-sm text-muted">
                {total} {total === 1 ? 'product' : 'products'}
              </p>
            )}
          </header>

          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Left column — siblings today, M3's filter rail tomorrow. */}
            <aside className="lg:w-60 lg:shrink-0">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                {cat?.parentId ? 'Related categories' : 'Sub-categories'}
              </h2>
              {tree.isPending ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
              ) : (
                // Horizontally scrolling chips on mobile, a stacked list from lg.
                <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
                  {siblings.map((sub) => {
                    const current = sub.id === cat?.id;
                    return (
                      <li key={sub.id} className="shrink-0 lg:shrink">
                        <Link
                          to={`/category/${sub.slug}`}
                          aria-current={current ? 'page' : undefined}
                          className={`flex min-h-[44px] items-center whitespace-nowrap rounded-full px-4 text-sm lg:whitespace-normal lg:rounded-lg ${
                            current
                              ? 'bg-primary-600 font-semibold text-white'
                              : 'bg-white text-ink-700 hover:bg-primary-50 lg:bg-transparent'
                          }`}
                        >
                          {sub.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>

            <div className="min-w-0 flex-1">
              {(category.isPending || products.isPending) && (
                <ul className={GRID} aria-busy="true" aria-label="Loading products">
                  {Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}
                </ul>
              )}

              {products.isError && (
                <div className="rounded-lg border border-surface-border bg-white shadow-card">
                  <ErrorState
                    title="We couldn't load these products"
                    requestId={products.error?.response?.data?.error?.requestId}
                    onRetry={products.refetch}
                  />
                </div>
              )}

              {/* The empty category is a COMMON state at launch, not a rare one —
                  most of the 261 sub-categories have no listings yet. */}
              {products.isSuccess && total === 0 && (
                <div className="rounded-lg border border-surface-border bg-white shadow-card">
                  <EmptyState
                    icon={BoxIcon}
                    title="No products in this category yet"
                    action={
                      <Link
                        to="/categories"
                        className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-ink-900 px-6 text-sm font-semibold text-white hover:bg-primary-800"
                      >
                        Browse all categories
                      </Link>
                    }
                  >
                    We&apos;re still sourcing suppliers here. Try another category in the meantime.
                  </EmptyState>
                </div>
              )}

              {products.isSuccess && total > 0 && (
                <>
                  <ul className={GRID}>
                    {products.data.products.map((product) => (
                      <ProductCard
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
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
