import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { CategoryThumb } from '../../components/catalogue/CategoryThumb.jsx';
import { FilterSidebar } from '../../components/catalogue/FilterSidebar.jsx';
import { ProductListCard } from '../../components/catalogue/ProductListCard.jsx';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';
import { Combobox } from '../../components/ui/Combobox.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { BadgeCheckIcon, BoxIcon, CheckIcon, ChevronRightIcon } from '../../components/ui/icons.jsx';
import { NotFound } from './NotFound.jsx';

/**
 * M2 web screen 2 — the products of one category (`/category/:slug`).
 *
 * Base layout (owner-directed, 2026-08-11, after several iterations):
 *
 *   left rail → the sub-categories as a STICKY SIDEBAR of photo rows (thumb ·
 *               name · chevron) — the approved row design, vertical. "All
 *               {top}" leads on sub pages; the current row is highlighted with
 *               a check (never colour alone). Below lg the same rows render as
 *               the 2-up grid above the products instead.
 *   header    → typographic: the category name and a muted context line.
 *   grid      → the products — the page's visual centre of gravity.
 *
 * 🔴 FILTERS ADDED 2026-08-11 (owner: "build the filter sidebar for real,
 * now" — explicitly bringing forward part of Module 3, confirmed, not
 * assumed). Real, backend-wired — `GET /public/search` + `GET /public/facets`,
 * both shipped and tested (m3-search.test.js, m3-facets.test.js). This
 * replaces the earlier "NO filters — all Module 3" stance for THIS page only;
 * `/public/products` (paging-only) is left as-is for any other surface still
 * using it.
 *
 * Scoped to what was actually asked for: verified-only, price range, and the
 * category's own filterable attributes (material, GSM, etc.). NOT built:
 * country/goods-vs-service facets (in the API, not part of this ask), a
 * full-screen filter modal (that's M3's own planned screen, a bigger UI than
 * this sidebar), enquiry/contact CTAs (M4, still not built), and no fabricated
 * content (social-proof counters, "featured" ribbons, badges) — none of that
 * is real data.
 *
 * Filter state lives in the URL (`useSearchParams`), same pattern already
 * used for `page` — shareable, back-button-safe, and it's what lets a
 * filtered view get `noindex,follow` + a clean canonical (m3-seo.md §4)
 * without a second state system to keep in sync.
 *
 * The slug may be a SUB or a TOP: the server resolves a top to its active
 * sub-categories (`resolveCategoryLeafIds`), so a top page aggregates its
 * children — identically for both `/public/products` and `/public/search`,
 * confirmed the same shared resolver.
 *
 * An unknown or deactivated slug 404s from the API and renders the shared
 * not-found page — deliberately indistinguishable from a category that never
 * existed, so the page is never an oracle for hidden rows.
 */
const PAGE_SIZE = 12;
// Vertical list (2026-08-11, owner: match the reference mockup's horizontal
// cards) — a horizontal card can't tile into columns the way the old
// photo-top grid card did, so this is a single stack, not a grid.
const LIST = 'flex flex-col gap-4';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'priceAsc', label: 'Price: Low to High' },
  { value: 'priceDesc', label: 'Price: High to Low' },
];

const FILTER_KEY_RE = /^attr\[([^\]]+)\](?:\[(min|max)\])?$/;

/** Every `attr[...]` entry in the URL, both as raw key→value pairs (to
 *  forward verbatim to the API — the URL already uses the API's own bracket
 *  syntax) and parsed into `{ [attrKey]: string[] | {min,max} }` for
 *  rendering which options/ranges are currently checked. One scan, both
 *  shapes, so they can never drift apart. */
function readAttrParams(searchParams) {
  const raw = {};
  const selections = {};
  for (const [k, v] of searchParams.entries()) {
    const m = k.match(FILTER_KEY_RE);
    if (!m) continue;
    raw[k] = v;
    const [, key, bound] = m;
    if (bound) {
      selections[key] = { ...selections[key], [bound]: v };
    } else {
      selections[key] = v.split(',').filter(Boolean);
    }
  }
  return { raw, selections };
}

function CardSkeleton() {
  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card sm:flex-row">
      <Skeleton className="aspect-[4/3] w-full rounded-none sm:aspect-auto sm:h-56 sm:w-64 md:w-72" />
      <div className="flex-1 space-y-3 p-5 sm:p-6">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
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
              <CategoryThumb image={top.image} label={top.name} size="h-9 w-9" />
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
                  <CategoryThumb image={sub.image} label={sub.name} size="h-9 w-9" />
                  <span className="truncate text-sm font-semibold text-primary-800">{sub.name}</span>
                  <CheckIcon className="h-4 w-4 text-primary-600" aria-hidden="true" />
                </span>
              ) : (
                <Link
                  to={`/category/${sub.slug}`}
                  className={`${ROW} transition-colors hover:bg-surface-subtle`}
                >
                  <CategoryThumb image={sub.image} label={sub.name} size="h-9 w-9" />
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
              <CategoryThumb image={top.image} label={top.name} />
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
              <CategoryThumb image={sub.image} label={sub.name} />
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
  const sort = params.get('sort') || 'newest';
  const verifiedOnly = params.get('verified') === '1';
  const priceMin = params.get('priceMin') ?? '';
  const priceMax = params.get('priceMax') ?? '';
  const { raw: attrRawParams, selections: attrSelections } = readAttrParams(params);

  // Every setter resets `page` — a changed filter invalidates whatever page
  // you were on, and re-fetching page 4 of a now-much-smaller result set
  // would just show an empty page instead of the new page 1.
  const updateParams = (mutate) => {
    const next = new URLSearchParams(params);
    mutate(next);
    next.delete('page');
    setParams(next);
  };

  const onToggleVerified = () =>
    updateParams((next) => (verifiedOnly ? next.delete('verified') : next.set('verified', '1')));

  const onPriceChange = (min, max) =>
    updateParams((next) => {
      min ? next.set('priceMin', min) : next.delete('priceMin');
      max ? next.set('priceMax', max) : next.delete('priceMax');
    });

  const onAttrToggle = (key, value) =>
    updateParams((next) => {
      const current = (next.get(`attr[${key}]`) ?? '').split(',').filter(Boolean);
      const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      updated.length ? next.set(`attr[${key}]`, updated.join(',')) : next.delete(`attr[${key}]`);
    });

  const onAttrRangeChange = (key, min, max) =>
    updateParams((next) => {
      min ? next.set(`attr[${key}][min]`, min) : next.delete(`attr[${key}][min]`);
      max ? next.set(`attr[${key}][max]`, max) : next.delete(`attr[${key}][max]`);
    });

  const onClearAllFilters = () =>
    updateParams((next) => {
      for (const k of [...next.keys()]) {
        if (k === 'verified' || k === 'priceMin' || k === 'priceMax' || FILTER_KEY_RE.test(k)) next.delete(k);
      }
    });

  const onSortChange = (val) => updateParams((next) => (val === 'newest' ? next.delete('sort') : next.set('sort', val)));

  const hasActiveFilters =
    verifiedOnly || priceMin || priceMax || Object.keys(attrSelections).length > 0 || sort !== 'newest';

  const filterParams = {
    category: slug,
    ...(verifiedOnly ? { verifiedOnly: 'true' } : {}),
    ...(priceMin ? { priceMin } : {}),
    ...(priceMax ? { priceMax } : {}),
    ...attrRawParams,
  };

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
    queryKey: catalogueKeys.search({ ...filterParams, sort, page, pageSize: PAGE_SIZE }),
    queryFn: () => catalogueApi.search({ ...filterParams, sort, page, pageSize: PAGE_SIZE }),
    enabled: category.isSuccess,
    // Keeps the previous PAGE's cards on screen while the next loads, so paging
    // (or a filter tweak) doesn't flash the grid back to skeletons — but ONLY
    // within the same category. Unconditional carry-over flashed the PREVIOUS
    // category's products for a frame after clicking a sibling (owner-reported),
    // which reads as showing the wrong data.
    placeholderData: (prev, prevQuery) => {
      const prevCategory = prevQuery?.queryKey?.[2]?.category;
      return prevCategory === slug ? prev : undefined;
    },
  });

  // Facets don't need paging — same filter context, live counts. Excluded
  // from `enabled` gate's category dependency the same way as `products`: no
  // point asking for facets of a category that just 404'd.
  const facets = useQuery({
    queryKey: catalogueKeys.facets(filterParams),
    queryFn: () => catalogueApi.facets(filterParams),
    enabled: category.isSuccess,
  });

  const cat = category.data;
  useEffect(() => {
    if (!cat) return undefined;
    const previous = document.title;
    document.title = `${cat.name} — MPX Global`;
    return () => { document.title = previous; };
  }, [cat]);

  // m3-seo.md §4: a filtered view (any filter, or a non-default sort) is
  // noindex,follow with a canonical back to the clean base category URL —
  // the base URL stays the one that's actually indexable.
  useEffect(() => {
    if (!cat) return undefined;
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = `${window.location.origin}/category/${cat.slug}`;
    document.head.appendChild(canonical);

    let robots;
    if (hasActiveFilters) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      robots.content = 'noindex,follow';
      document.head.appendChild(robots);
    }

    return () => {
      canonical.remove();
      robots?.remove();
    };
  }, [cat, hasActiveFilters]);

  if (category.isError) return <NotFound />;

  const top = cat?.parentId
    ? (tree.data ?? []).find((t) => t.id === cat.parentId)
    : (tree.data ?? []).find((t) => t.id === cat?.id);
  const total = products.data?.total ?? 0;
  const onSubPage = Boolean(cat?.parentId);

  const filterSidebarProps = {
    facets: facets.data?.facets,
    loading: facets.isPending,
    verifiedOnly,
    priceMin,
    priceMax,
    attrSelections,
    onToggleVerified,
    onPriceChange,
    onAttrToggle,
    onAttrRangeChange,
    onClearAll: onClearAllFilters,
  };

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
            {/* --- Left: sticky sub-category rail + filters (lg+) --- */}
            <aside className="hidden lg:block lg:space-y-4">
              {tree.isPending ? (
                <Skeleton className="h-96 w-full rounded-2xl" />
              ) : (
                <SubRail top={top} currentId={cat?.id} onSubPage={onSubPage} />
              )}
              <FilterSidebar {...filterSidebarProps} />
            </aside>

            {/* --- Right: header, (mobile subs + filters), products --- */}
            <div className="min-w-0">
              {/* Flat "N results | Category" heading (2026-08-11, owner: exact
                  match to the reference template) — supersedes the earlier
                  photo-banner header card from earlier the same day. The
                  count + trust line move here as plain text/pills rather than
                  a separate card. */}
              {cat ? (
                <div>
                  <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">
                    {products.isSuccess ? `${total} result${total === 1 ? '' : 's'}` : '…'}
                    <span className="mx-2 font-normal text-muted">|</span>
                    {cat.name}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {!onSubPage && (top?.subs?.length ?? 0) > 0 && (
                      <span className="inline-flex items-center rounded-full border border-surface-border bg-white px-3 py-1 text-xs font-medium text-ink-700">
                        {top.subs.length} specialisations
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3 py-1 text-xs font-medium text-ink-700">
                      <BadgeCheckIcon className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                      Verified Indian exporters
                    </span>
                  </div>
                </div>
              ) : (
                <Skeleton className="h-10 w-2/3 rounded-lg" />
              )}

              <div className="mt-6 lg:hidden">
                <SubGrid top={top} currentId={cat?.id} onSubPage={onSubPage} />
              </div>
              <div className="mt-6 lg:hidden">
                <FilterSidebar {...filterSidebarProps} />
              </div>

              <div className="mb-4 mt-6 flex items-center gap-2 border-t border-surface-border pt-4">
                <span className="text-sm font-medium text-ink-800">Sort By</span>
                <div className="w-52">
                  <Combobox id="sort" value={sort} options={SORT_OPTIONS} onChange={onSortChange} />
                </div>
              </div>

              {(category.isPending || products.isPending) && (
                <ul className={LIST} aria-busy="true" aria-label="Loading products">
                  {Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)}
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

              {/* Empty because the category genuinely has nothing yet, vs.
                  empty because the current filters matched nothing — two
                  different states, two different fixes to offer. */}
              {products.isSuccess && total === 0 && (
                <div className="rounded-2xl border border-surface-border bg-white shadow-card">
                  {hasActiveFilters ? (
                    <EmptyState icon={BoxIcon} title="No products match these filters">
                      Try removing a filter — the category's other listings might fit.
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={onClearAllFilters}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-ink-900 px-6 text-sm font-semibold text-white hover:bg-primary-800"
                        >
                          Clear filters
                        </button>
                      </div>
                    </EmptyState>
                  ) : (
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
                  )}
                </div>
              )}

              {products.isSuccess && total > 0 && (
                <>
                  <ul className={LIST}>
                    {products.data.products.map((product) => (
                      <ProductListCard
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
                    onPage={(n) => setParams((prev) => {
                      const next = new URLSearchParams(prev);
                      n > 1 ? next.set('page', String(n)) : next.delete('page');
                      return next;
                    })}
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
