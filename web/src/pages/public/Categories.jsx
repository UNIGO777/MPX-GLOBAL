import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { BoxIcon, SearchIcon, SearchOffIcon, XIcon } from '../../components/ui/icons.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

/**
 * M2 web screen 1 — public category browse (`/categories`).
 *
 * REDESIGNED 2026-08-11 to the M2 language: photo-forward cards (all 40
 * categories carry real images now) with a hover zoom, sub-category teaser
 * CHIPS, and a QUICK-FIND filter box. The original build deliberately omitted
 * any search control to avoid prejudging Module 3 — that module has since
 * shipped server-side, and this box is local navigation over the 40 loaded
 * cards (name + sub-category matching), not catalogue search. Supersedes that
 * earlier note.
 *
 * Public and indexable: real links, real headings, one h1 — content is never
 * click-to-reveal. Filtering hides cards client-side only; crawlers without JS
 * see all 40.
 *
 * Ordering is the server's (`order`, pre-sorted). Never re-sort client-side:
 * the sequence is an admin decision, and alphabetising it silently would bury
 * the categories the owner chose to lead with. The filter preserves that order.
 */

/** How many sub names fit on a card before it stops being a teaser. */
const TEASER_COUNT = 3;

function CategoryCard({ category }) {
  const subs = category.subs ?? [];
  const teaser = subs.slice(0, TEASER_COUNT);
  const more = subs.length - teaser.length;

  return (
    // h-full + flex-col with the count pushed by mt-auto: names wrap to two
    // lines on several categories, and without this the count line floats and
    // the row stops aligning.
    <li className="h-full">
      <Link
        to={`/category/${category.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-xl border border-surface-border bg-white shadow-card transition-all hover:border-primary-600 hover:shadow-lift"
      >
        <div className="overflow-hidden">
          {category.image ? (
            <img
              src={category.image}
              alt=""
              loading="lazy"
              width={640}
              height={360}
              className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <NoImagePanel label={category.name} ratio="aspect-video" />
          )}
        </div>
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <h2 className="text-base font-bold leading-snug text-ink-900 sm:text-lg">
            {category.name}
          </h2>
          {teaser.length > 0 && (
            <p className="mt-2.5 flex flex-wrap gap-1.5">
              {teaser.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-ink-600"
                >
                  {s.name}
                </span>
              ))}
              {more > 0 && (
                <span className="rounded-full px-1 py-0.5 text-[11px] text-muted">+{more} more</span>
              )}
            </p>
          )}
          <p className="mt-auto pt-3 text-xs text-muted">
            {subs.length} {subs.length === 1 ? 'sub-category' : 'sub-categories'}
          </p>
        </div>
      </Link>
    </li>
  );
}

function CardSkeleton() {
  return (
    <li className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-card">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="p-4 sm:p-5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-5 h-3 w-24" />
      </div>
    </li>
  );
}

const GRID = 'grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4';

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
    document.title = 'Browse categories — MPX Global';
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
    <div className="flex min-h-screen flex-col bg-surface-subtle text-ink-900">
      <PublicHeader current="Categories" />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-14">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-primary-800 sm:text-4xl">
                Browse categories
              </h1>
              <p className="mt-2 max-w-2xl text-base text-muted md:text-lg">
                Find specialised suppliers across {categories.length || 40} industries.
              </p>
            </div>
            {/* Quick find — local navigation over the loaded cards, matching
                names AND sub-categories. Not Module-3 search. */}
            <div className="relative w-full sm:w-[300px]">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                aria-label="Find a category"
                placeholder="Find a category — e.g. denim, spices…"
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
            <ul className={GRID} aria-busy="true" aria-label="Loading categories">
              {Array.from({ length: 8 }, (_, i) => (
                <CardSkeleton key={i} />
              ))}
            </ul>
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
              <ul className={GRID}>
                {shown.map((category) => (
                  <CategoryCard key={category.id} category={category} />
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
