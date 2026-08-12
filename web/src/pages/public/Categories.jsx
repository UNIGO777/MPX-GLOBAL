import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { BoxIcon, ChevronRightIcon, SearchIcon, SearchOffIcon, XIcon } from '../../components/ui/icons.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

/**
 * M2 web screen 1 — public category browse (`/categories`).
 *
 * REDESIGNED 2026-08-11 (round 2) to a directory layout, built from a mockup the
 * owner generated with an external design tool and asked to be matched (not
 * copied literally — that mockup's content was placeholder: invented category
 * names, a header with "Analytics"/"Inventory" nav items that don't exist, and
 * a bottom app-tab-bar on its phone frame). What's real here:
 *
 * - **Content is the live 40-category tree** — nothing hardcoded. Per-category
 *   icon is the category's own Cloudinary photo (all 40 are photographed), not
 *   an invented glyph-per-industry — we have no such icon set and guessing one
 *   risks a wrong pairing. Falls back to the standard neutral `NoImagePanel`.
 * - **Sub-categories are now real links** (`slug` was always in the public
 *   payload; the previous build only rendered subs as inert teaser chips).
 * - **Header/footer are the shared `PublicHeader`/`PublicFooter`** — every
 *   public page uses the one chrome (see that component's own header comment);
 *   this page does not get a bespoke nav. No Analytics/Inventory link was
 *   added — neither is a real, built surface (Analytics-style reporting is
 *   Phase-2/Bucket-B), and a live-looking link to nothing is exactly the dead
 *   control this project's rules forbid.
 * - **No bottom app-tab-bar** — that mockup frame's bottom nav is native-app
 *   chrome, not a pattern this site uses anywhere; adding one would be a
 *   site-wide navigation change, not a one-page redesign, so it's left out.
 *   Flagged to the owner rather than silently built.
 *
 * Two markups (card grid ≥md, grouped chip list <md) sit in the SAME render —
 * toggled by Tailwind breakpoint classes, not JS — so both are in the DOM for
 * crawlers regardless of viewport (m3-seo.md: content must never be
 * click-to-reveal). Public and indexable: real links, one h1.
 *
 * Ordering is the server's (`order`, pre-sorted). Never re-sort client-side:
 * the sequence is an admin decision, and alphabetising it silently would bury
 * the categories the owner chose to lead with. The filter preserves that order.
 */

/** Sub-links shown on a desktop card before it hands off to "Explore category". */
const DESKTOP_SUB_LIMIT = 6;

function CategoryThumb({ category, className }) {
  return category.image ? (
    <img
      src={category.image}
      alt=""
      loading="lazy"
      width={96}
      height={96}
      className={`aspect-square object-cover ${className}`}
    />
  ) : (
    <NoImagePanel label={category.name} ratio="aspect-square" className={className} />
  );
}

/** Desktop/tablet card — icon + name header, then real sub-category links. */
function CategoryCard({ category }) {
  const subs = category.subs ?? [];
  const shownSubs = subs.slice(0, DESKTOP_SUB_LIMIT);
  const hiddenCount = subs.length - shownSubs.length;

  return (
    <li className="h-full">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-surface-border bg-white shadow-card transition-shadow hover:shadow-lift">
        <div className="flex items-center gap-3 p-4 sm:p-5">
          <Link
            to={`/category/${category.slug}`}
            className="shrink-0 overflow-hidden rounded-lg ring-1 ring-surface-border"
          >
            <CategoryThumb category={category} className="h-11 w-11 sm:h-12 sm:w-12" />
          </Link>
          <Link
            to={`/category/${category.slug}`}
            className="min-w-0 text-base font-bold leading-snug text-ink-900 hover:text-primary-700 sm:text-lg"
          >
            {category.name}
          </Link>
        </div>

        {shownSubs.length > 0 ? (
          <ul className="flex-1 space-y-0.5 border-t border-surface-border px-4 py-3 sm:px-5">
            {shownSubs.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/category/${s.slug}`}
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm text-primary-700 hover:bg-surface-subtle hover:text-primary-800"
                >
                  <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                  <span className="truncate">{s.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex-1 border-t border-surface-border px-4 py-3 text-sm text-muted sm:px-5">
            No sub-categories yet.
          </p>
        )}

        <Link
          to={`/category/${category.slug}`}
          className="mt-auto flex items-center gap-1 border-t border-surface-border px-4 py-3 text-xs font-bold uppercase tracking-wide text-primary-700 hover:bg-surface-subtle hover:text-primary-800 sm:px-5"
        >
          Explore category
          {hiddenCount > 0 && <span className="font-medium normal-case tracking-normal">· +{hiddenCount} more</span>}
          <ChevronRightIcon className="ml-auto h-4 w-4 shrink-0" />
        </Link>
      </div>
    </li>
  );
}

/** Phone/small-tablet section — icon + name as a header, subs as tappable chips. */
function CategorySection({ category }) {
  const subs = category.subs ?? [];

  return (
    <li>
      <Link to={`/category/${category.slug}`} className="flex items-center gap-2.5 border-b border-surface-border pb-2">
        <span className="shrink-0 overflow-hidden rounded-md ring-1 ring-surface-border">
          <CategoryThumb category={category} className="h-7 w-7" />
        </span>
        <span className="text-base font-bold text-ink-900">{category.name}</span>
      </Link>

      {subs.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {subs.map((s) => (
            <li key={s.id}>
              <Link
                to={`/category/${s.slug}`}
                className="flex items-center gap-1.5 rounded-full border border-surface-border bg-white py-1.5 pl-1.5 pr-3 text-sm text-primary-700 hover:border-primary-600 hover:bg-surface-subtle"
              >
                <span className="shrink-0 overflow-hidden rounded-full">
                  <CategoryThumb category={s} className="h-5 w-5" />
                </span>
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No sub-categories yet.</p>
      )}
    </li>
  );
}

function CardSkeleton() {
  return (
    <li className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-card">
      <div className="flex items-center gap-3 p-4 sm:p-5">
        <Skeleton className="h-11 w-11 shrink-0 rounded-lg sm:h-12 sm:w-12" />
        <Skeleton className="h-5 w-2/3" />
      </div>
      <div className="space-y-2 border-t border-surface-border px-4 py-3 sm:px-5">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </li>
  );
}

function SectionSkeleton() {
  return (
    <li>
      <div className="flex items-center gap-2.5 border-b border-surface-border pb-2">
        <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
        <Skeleton className="h-5 w-1/2" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
    </li>
  );
}

const DESKTOP_GRID = 'hidden md:grid md:grid-cols-2 md:gap-5 lg:grid-cols-3 xl:grid-cols-4';
const MOBILE_LIST = 'flex flex-col gap-7 md:hidden';

export function Categories() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: catalogueKeys.tree,
    queryFn: catalogueApi.tree,
  });
  const [q, setQ] = useState('');

  // Public page — give it its own title rather than inheriting the landing
  // page's (m3-seo.md §2 wants a per-page title; full meta/canonical arrive with
  // the M3 SEO pass).
  useEffect(() => {
    const previous = document.title;
    document.title = 'Categories Index — MPX Global';
    return () => {
      document.title = previous;
    };
  }, []);

  const categories = data ?? [];
  const norm = q.trim().toLowerCase();
  // Filter matches the category OR any of its sub-categories — the thing a
  // visitor types is usually the leaf ("denim"), not the top.
  const shown = norm
    ? categories.filter((c) =>
        `${c.name} ${(c.subs ?? []).map((s) => s.name).join(' ')}`.toLowerCase().includes(norm),
      )
    : categories;

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink-900">
      <PublicHeader current="Categories" />

      <main className="flex-1">
        <div className="w-full px-4 py-10 sm:px-6 md:py-14">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">Categories Index</h1>
            <p className="mt-2 max-w-2xl text-base text-muted md:text-lg">
              Quickly navigate through our global supply chain catalogue.
            </p>

            {/* Local navigation over the loaded cards (name + sub-category
                matching) — not Module-3's server-side search. */}
            <div className="relative mt-6 w-full sm:max-w-md">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                aria-label="Find a category"
                placeholder="Search categories or sub-categories…"
                className="h-11 w-full rounded-full border border-surface-border bg-white pl-10 pr-10 text-sm outline-none placeholder:text-ink-500 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button
                  type="button"
                  aria-label="Clear"
                  onClick={() => setQ('')}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </header>

          {isPending && (
            <>
              <ul className={DESKTOP_GRID} aria-busy="true" aria-label="Loading categories">
                {Array.from({ length: 8 }, (_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </ul>
              <ul className={MOBILE_LIST} aria-busy="true" aria-label="Loading categories">
                {Array.from({ length: 4 }, (_, i) => (
                  <SectionSkeleton key={i} />
                ))}
              </ul>
            </>
          )}

          {isError && (
            <div className="rounded-2xl border border-surface-border bg-white shadow-card">
              <ErrorState
                title="We couldn't load the categories"
                requestId={error?.response?.data?.error?.requestId}
                onRetry={refetch}
              />
            </div>
          )}

          {!isPending && !isError && categories.length === 0 && (
            <div className="rounded-2xl border border-surface-border bg-white shadow-card">
              <EmptyState icon={BoxIcon} title="No categories yet">
                The catalogue is being set up. Check back shortly.
              </EmptyState>
            </div>
          )}

          {!isPending && !isError && categories.length > 0 && shown.length === 0 && (
            <div className="rounded-2xl border border-surface-border bg-white shadow-card">
              <EmptyState icon={SearchOffIcon} title={`Nothing matches “${q.trim()}”`}>
                Try another word — the filter checks category and sub-category names.
              </EmptyState>
            </div>
          )}

          {!isPending && !isError && shown.length > 0 && (
            <>
              {norm && (
                <p className="mb-4 text-sm text-muted">
                  {shown.length} of {categories.length} categories match
                </p>
              )}

              {/* Desktop/tablet — card grid, real sub-links, "Explore category". */}
              <ul className={DESKTOP_GRID}>
                {shown.map((category) => (
                  <CategoryCard key={category.id} category={category} />
                ))}
              </ul>

              {/* Phone — grouped sections, subs as tappable chips. */}
              <ul className={MOBILE_LIST}>
                {shown.map((category) => (
                  <CategorySection key={category.id} category={category} />
                ))}
              </ul>
            </>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
