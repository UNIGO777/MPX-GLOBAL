import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { PublicFooter } from '../../components/public/PublicFooter.jsx';
import { PublicHeader } from '../../components/public/PublicHeader.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { BoxIcon } from '../../components/ui/icons.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

/**
 * M2 web screen 1 — public category browse (`/categories`).
 *
 * The catalogue's front door: every ACTIVE top category as a card. Public and
 * indexable, so it is real links and real headings, never click-to-reveal
 * content. Deliberately carries NO search box, filter rail or sort control —
 * those are Module 3 and drawing a disabled one here would prejudge that design.
 *
 * Ordering is the server's (`order`, pre-sorted). Never re-sort client-side:
 * the sequence is an admin decision, and alphabetising it silently would bury
 * the categories the owner chose to lead with.
 */

/** How many sub names fit on a card before it stops being a teaser. */
const TEASER_COUNT = 3;

/**
 * The no-image state, designed as the PRIMARY look rather than an edge case.
 *
 * §A20: the 40 top-category images are uploaded by admins through the panel over
 * time, so at launch essentially every card lands here. A grey broken-image icon
 * would make the whole page read as failed; a tinted monogram panel reads as
 * deliberate.
 */
function CategoryThumb({ name, image }) {
  if (image) {
    return (
      <img
        src={image}
        alt=""
        loading="lazy"
        width={640}
        height={360}
        className="aspect-video w-full rounded-t-lg object-cover"
      />
    );
  }
  // The shared panel, so category cards, product cards, galleries and supplier
  // logos all degrade identically.
  return <NoImagePanel label={name} monogram className="rounded-t-lg" />;
}

function CategoryCard({ category }) {
  const subs = category.subs ?? [];
  const teaser = subs.slice(0, TEASER_COUNT).map((s) => s.name).join(', ');

  return (
    // h-full + flex-col with the count pushed by mt-auto: names wrap to two
    // lines on several categories, and without this the count line floats and
    // the row stops aligning.
    <li className="h-full">
      <Link
        to={`/category/${category.slug}`}
        className="flex h-full flex-col overflow-hidden rounded-lg border border-surface-border bg-white shadow-card transition-colors hover:border-primary-600"
      >
      <CategoryThumb name={category.name} image={category.image} />
      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-lg font-bold leading-snug text-ink-900">{category.name}</h2>
        {teaser && <p className="mt-2 line-clamp-2 text-sm text-ink-600">{teaser}</p>}
        <p className="mt-auto pt-4 text-xs text-muted">
          {subs.length} {subs.length === 1 ? 'sub-category' : 'sub-categories'}
        </p>
      </div>
      </Link>
    </li>
  );
}

function CardSkeleton() {
  return (
    <li className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="p-5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-2/3" />
        <Skeleton className="mt-5 h-3 w-24" />
      </div>
    </li>
  );
}

const GRID = 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

export function Categories() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: catalogueKeys.tree,
    queryFn: catalogueApi.tree,
  });

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

  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle text-ink-900">
      <PublicHeader current="Categories" />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 md:py-16">
          <header className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-primary-800 sm:text-4xl">
              Browse categories
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted md:text-lg">
              Find specialised suppliers across 40 industries.
            </p>
          </header>

          {isPending && (
            <ul className={GRID} aria-busy="true" aria-label="Loading categories">
              {Array.from({ length: 8 }, (_, i) => (
                <CardSkeleton key={i} />
              ))}
            </ul>
          )}

          {isError && (
            <div className="rounded-lg border border-surface-border bg-white shadow-card">
              <ErrorState
                title="We couldn't load the categories"
                requestId={error?.response?.data?.error?.requestId}
                onRetry={refetch}
              />
            </div>
          )}

          {!isPending && !isError && categories.length === 0 && (
            <div className="rounded-lg border border-surface-border bg-white shadow-card">
              <EmptyState icon={BoxIcon} title="No categories yet">
                The catalogue is being set up. Check back shortly.
              </EmptyState>
            </div>
          )}

          {!isPending && !isError && categories.length > 0 && (
            <ul className={GRID}>
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </ul>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
