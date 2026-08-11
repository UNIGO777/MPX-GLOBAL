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
import { BadgeCheckIcon, BoxIcon, CheckIcon, ChevronRightIcon } from '../../components/ui/icons.jsx';
import { NotFound } from './NotFound.jsx';

/**
 * M2 web screen 2 — the products of one category (`/category/:slug`).
 *
 * FINAL SHAPE (owner-directed, 2026-08-11, after several iterations):
 *
 *   left rail → the sub-categories as a STICKY SIDEBAR of photo rows (thumb ·
 *               name · chevron) — the approved row design, vertical. "All
 *               {top}" leads on sub pages; the current row is highlighted with
 *               a check (never colour alone). Below lg the same rows render as
 *               the 2-up grid above the products instead.
 *   header    → typographic: the category name and a muted context line.
 *   grid      → the products — the page's visual centre of gravity.
 *
 * The slug may be a SUB or a TOP: the server resolves a top to its active
 * sub-categories (`resolveCategoryLeafIds`), so a top page aggregates its
 * children.
 *
 * 🔴 NO search box, filter facets or sort control — all Module 3 ("Newest
 * first" is stated, not implied). The rail is category NAVIGATION, not a
 * filter rail; M3 can extend this column with facets later.
 *
 * An unknown or deactivated slug 404s from the API and renders the shared
 * not-found page — deliberately indistinguishable from a category that never
 * existed, so the page is never an oracle for hidden rows.
 */
const PAGE_SIZE = 12;
const GRID = 'grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4';

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

/** One sub-category thumbnail: photo or the neutral monogram. */
function SubThumb({ image, label, size = 'h-12 w-12' }) {
  return image ? (
    <img
      src={image}
      alt=""
      loading="lazy"
      width={48}
      height={48}
      className={`${size} shrink-0 rounded-lg object-cover`}
    />
  ) : (
    <NoImagePanel label={label} monogram ratio={size} className="shrink-0 rounded-lg" />
  );
}

/**
 * Desktop: the sticky left rail. Refined 2026-08-11 (owner: "too plain,
 * selection misaligned"):
 *  - a TINTED HEADER BAND gives the card identity;
 *  - every row is the same 3-column grid (thumb · name · marker), so thumbs,
 *    names and trailing icons align to the pixel in every state;
 *  - the current row = soft tint + a LEFT ACCENT BAR + check, which highlights
 *    without the heavy solid fill that fought the photos.
 */
function SubRail({ top, currentId, onSubPage }) {
  if (!top) return null;
  const subs = top.subs ?? [];
  if (!subs.length) return null;

  const ROW = 'relative grid h-12 grid-cols-[36px_minmax(0,1fr)_16px] items-center gap-3 rounded-xl px-3';

  return (
    <div className="sticky top-20 overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
      <h2 className="flex items-center justify-between gap-2 border-b border-primary-100 bg-primary-50/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-primary-800">
        Specialisations
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-primary-700">
          {subs.length}
        </span>
      </h2>

      <ul className="max-h-[68vh] space-y-0.5 overflow-y-auto p-2">
        {onSubPage && (
          <li className="mb-1.5 border-b border-ink-100 pb-1.5">
            <Link to={`/category/${top.slug}`} className={`${ROW} transition-colors hover:bg-surface-subtle`}>
              <SubThumb image={top.image} label={top.name} size="h-9 w-9" />
              <span className="truncate text-sm font-semibold text-ink-900">All {top.name}</span>
              <ChevronRightIcon className="h-4 w-4 text-ink-300" aria-hidden="true" />
            </Link>
          </li>
        )}
        {subs.map((sub) => {
          const current = sub.id === currentId;
          return (
            <li key={sub.id}>
              {current ? (
                <span aria-current="page" className={`${ROW} bg-primary-50`}>
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-primary-600"
                  />
                  <SubThumb image={sub.image} label={sub.name} size="h-9 w-9" />
                  <span className="truncate text-sm font-semibold text-primary-800">{sub.name}</span>
                  <CheckIcon className="h-4 w-4 text-primary-600" aria-hidden="true" />
                </span>
              ) : (
                <Link
                  to={`/category/${sub.slug}`}
                  className={`${ROW} transition-colors hover:bg-surface-subtle`}
                >
                  <SubThumb image={sub.image} label={sub.name} size="h-9 w-9" />
                  <span className="truncate text-sm font-medium text-ink-800">{sub.name}</span>
                  <ChevronRightIcon className="h-4 w-4 text-ink-300" aria-hidden="true" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Below lg: the approved photo-row grid, above the products. */
function SubGrid({ top, currentId, onSubPage }) {
  if (!top) return null;
  const subs = top.subs ?? [];
  if (!subs.length) return null;

  const shell = (current) =>
    `flex items-center gap-3 rounded-xl border bg-white p-2 pr-3 transition-all ${
      current
        ? 'border-primary-600 ring-1 ring-primary-600'
        : 'border-surface-border hover:border-primary-500 hover:shadow-card'
    }`;

  return (
    <section className="mb-7">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Specialisations
      </h2>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {onSubPage && (
          <li>
            <Link to={`/category/${top.slug}`} className={shell(false)}>
              <SubThumb image={top.image} label={top.name} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">
                All {top.name}
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
            </Link>
          </li>
        )}
        {subs.map((sub) => {
          const current = sub.id === currentId;
          const inner = (
            <>
              <SubThumb image={sub.image} label={sub.name} />
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  current ? 'font-semibold text-primary-700' : 'font-medium text-ink-800'
                }`}
              >
                {sub.name}
              </span>
              {current ? (
                <CheckIcon className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
              )}
            </>
          );
          return (
            <li key={sub.id}>
              {current ? (
                <span aria-current="page" className={shell(true)}>{inner}</span>
              ) : (
                <Link to={`/category/${sub.slug}`} className={shell(false)}>{inner}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
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

  // The tree is already cached by the browse page; it supplies the parent's
  // name for the breadcrumb and the rail, neither of which is a field on a
  // category (the public projection is name/slug/image/parentId/type).
  const tree = useQuery({ queryKey: catalogueKeys.tree, queryFn: catalogueApi.tree });

  const products = useQuery({
    queryKey: catalogueKeys.products({ category: slug, page, pageSize: PAGE_SIZE }),
    queryFn: () => catalogueApi.products({ category: slug, page, pageSize: PAGE_SIZE }),
    enabled: category.isSuccess,
    // Keeps the previous PAGE's cards on screen while the next loads, so paging
    // doesn't flash the grid back to skeletons — but ONLY within the same
    // category. Unconditional carry-over flashed the PREVIOUS category's
    // products for a frame after clicking a sibling (owner-reported), which
    // reads as showing the wrong data.
    placeholderData: (prev, prevQuery) => {
      const prevCategory = prevQuery?.queryKey?.[2]?.category;
      return prevCategory === slug ? prev : undefined;
    },
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
  const total = products.data?.total ?? 0;
  const onSubPage = Boolean(cat?.parentId);

  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle text-ink-900">
      <PublicHeader current="Categories" />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-10">
          <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <Crumb to="/categories">Categories</Crumb>
            {onSubPage && top && <Crumb to={`/category/${top.slug}`}>{top.name}</Crumb>}
            <Crumb last>{cat?.name ?? '…'}</Crumb>
          </nav>

          <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
            {/* --- Left: sticky sub-category rail (lg+) --- */}
            <aside className="hidden lg:block">
              {tree.isPending ? (
                <Skeleton className="h-96 w-full rounded-2xl" />
              ) : (
                <SubRail top={top} currentId={cat?.id} onSubPage={onSubPage} />
              )}
            </aside>

            {/* --- Right: header, (mobile subs), products --- */}
            <div className="min-w-0">
              {cat ? (
                /* Banner header (owner, 2026-08-11): the same typography, now
                   on a card with the category photo dissolving in from the
                   right — present, never shouting. Photo hides below sm. */
                <section className="relative overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
                  <div className="relative z-10 max-w-xl p-5 sm:p-7">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-700">
                      {onSubPage ? top?.name ?? 'Specialisation' : 'Category'}
                    </p>
                    <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
                      {cat.name}
                    </h1>
                    <p className="mt-4 flex flex-wrap items-center gap-2">
                      {products.isSuccess && (
                        <span className="inline-flex items-center rounded-full border border-surface-border bg-white px-3 py-1 text-xs font-medium text-ink-700">
                          {total} {total === 1 ? 'product' : 'products'}
                        </span>
                      )}
                      {!onSubPage && (top?.subs?.length ?? 0) > 0 && (
                        <span className="inline-flex items-center rounded-full border border-surface-border bg-white px-3 py-1 text-xs font-medium text-ink-700">
                          {top.subs.length} specialisations
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3 py-1 text-xs font-medium text-ink-700">
                        <BadgeCheckIcon className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                        Verified Indian exporters
                      </span>
                    </p>
                  </div>
                  {cat.image && (
                    <div aria-hidden="true" className="absolute inset-y-0 right-0 hidden w-64 sm:block md:w-80">
                      <img src={cat.image} alt="" className="h-full w-full object-cover" />
                      {/* The photo dissolves INTO the card — a soft white fade
                          on its leading edge, no scrim, no overlay text. */}
                      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/45 to-transparent" />
                    </div>
                  )}
                </section>
              ) : (
                <Skeleton className="h-40 w-full rounded-2xl" />
              )}

              <div className="mt-6 lg:hidden">
                <SubGrid top={top} currentId={cat?.id} onSubPage={onSubPage} />
              </div>

              <div className="mb-4 mt-7 flex flex-wrap items-center gap-2.5 rounded-xl border border-surface-border bg-white px-4 py-2.5 shadow-card">
                <h2 className="text-[15px] font-bold text-ink-900">Products</h2>
                {products.isSuccess && (
                  <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
                    {total}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted">Sorted by newest</span>
              </div>

              {(category.isPending || products.isPending) && (
                <ul className={GRID} aria-busy="true" aria-label="Loading products">
                  {Array.from({ length: 8 }, (_, i) => <CardSkeleton key={i} />)}
                </ul>
              )}

              {products.isError && (
                <div className="rounded-2xl border border-surface-border bg-white shadow-card">
                  <ErrorState
                    title="We couldn't load these products"
                    requestId={products.error?.response?.data?.error?.requestId}
                    onRetry={products.refetch}
                  />
                </div>
              )}

              {/* The empty category is a COMMON state at launch, not a rare
                  one — most sub-categories have no listings yet. */}
              {products.isSuccess && total === 0 && (
                <div className="rounded-2xl border border-surface-border bg-white shadow-card">
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
