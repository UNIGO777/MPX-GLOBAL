import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { savedApi, savedKeys } from '../../api/saved.js';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { PriceLine } from '../../components/catalogue/PriceLine.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import { BuildingIcon, HeartIcon, MapPinIcon, XIcon } from '../../components/ui/icons.jsx';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { countryName } from '../../lib/countries.js';
import { formatDate } from '../../lib/format.js';
import { useNoIndex } from '../../lib/seo.js';
import { BUYER_NAV } from './buyerNav.js';

/**
 * M3 screen 8 — the buyer's saved products and suppliers (`/saved`).
 *
 * Buyer-only, and guarded twice: the route sits behind `RequireRole(['buyer'])`
 * and every `/saved` endpoint re-checks the role server-side. This page never
 * decides who may read it — it only renders what the API returns.
 *
 * 🔴 "Currently unavailable" is the ENTIRE public explanation for an item that
 * has gone (archived, taken down, category deactivated, supplier deactivated).
 * The API sends `unavailableReason` as an internal discriminator; the UI shows
 * one neutral badge and NEVER the reason — same rule the public surfaces obey
 * (m3-public-projection.md). Unavailable rows stay readable and removable;
 * items the backend purged simply don't come back, so there are no tombstones.
 */
const PAGE_SIZE = 12;

/** Same monogram the browse card uses, so a saved card and a search result
 *  read as the same object. */
function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

function SavedCardSkeleton() {
  return (
    <li className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-card">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2 p-3.5">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    </li>
  );
}

/** One saved row. Products and suppliers share the frame; only the body
 *  differs, so the grid never looks like two different pages. */
function SavedCard({ item, onRemove, removing }) {
  const isProduct = item.targetType === 'product';
  const target = isProduct ? item.product : item.supplier;
  if (!target) return null;

  const to = isProduct ? `/product/${target.slug}` : `/supplier/${target.slug}`;
  const cover = isProduct ? target.images?.[0] : target.logo;
  const unavailable = !item.available;

  return (
    <li className="relative">
      {/* Still a link when unavailable (the page itself explains the state) —
          muted, never removed from reach. */}
      <Link
        to={to}
        className={`flex h-full flex-col overflow-hidden rounded-xl border border-surface-border bg-white shadow-card transition-all hover:border-primary-600 hover:shadow-lift ${
          unavailable ? 'opacity-60 grayscale' : ''
        }`}
      >
        <div className="relative">
          {cover ? (
            <img src={cover} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <NoImagePanel
              ratio="aspect-[4/3]"
              className="w-full"
              label={isProduct ? undefined : target.name}
              monogram={!isProduct}
            />
          )}
          {unavailable && (
            <span className="absolute left-3 top-3 rounded-full bg-ink-900/80 px-2.5 py-1 text-xs font-semibold text-white">
              Currently unavailable
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-3.5">
          <div className="flex items-start gap-2">
            <h3 className="line-clamp-2 flex-1 text-sm font-bold text-ink-900">{target.name}</h3>
            {target.verified && !isProduct && <VerifiedTick verified compact />}
          </div>

          {isProduct ? (
            <div className="mt-2">
              {/* PriceLine takes `price`/`unit` — passing the whole product
                  silently rendered every card as "Price on request". */}
              <PriceLine price={target.price} unit={target.unit} size="base" />
              {target.moq && (
                <p className="mt-0.5 text-xs text-muted">
                  MOQ {target.moq} {target.unit ?? ''}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              {target.country && (
                <span className="inline-flex items-center gap-1">
                  <MapPinIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {countryName(target.country) ?? target.country}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <BuildingIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {target.productCount} listing{target.productCount === 1 ? '' : 's'}
              </span>
            </div>
          )}

          {/* Seller identity — same row the browse card carries (owner,
              2026-08-16), so the saved grid isn't a poorer version of the
              card it was saved from. Public projection only: name, derived
              `verified` tick, country. */}
          {isProduct && target.seller && (
            <div className="mt-2.5 flex items-center gap-2 border-t border-surface-border pt-2.5">
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[9px] font-bold text-primary-700"
              >
                {initials(target.seller.name)}
              </span>
              <span className="min-w-0 truncate text-xs font-medium text-ink-800">{target.seller.name}</span>
              <VerifiedTick verified={target.seller.verified} compact />
              {target.seller.country && (
                <span className="ml-auto shrink-0 text-[10px] text-muted">
                  {countryName(target.seller.country) ?? target.seller.country}
                </span>
              )}
            </div>
          )}

          <p className="mt-auto pt-2.5 text-xs text-muted">Saved {formatDate(item.savedAt)}</p>
        </div>
      </Link>

      {/* Outside the Link so the remove action is its own target. */}
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        disabled={removing}
        aria-label={`Remove ${target.name} from saved`}
        title="Remove"
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink-600 shadow-card backdrop-blur transition-colors hover:text-danger disabled:opacity-50"
      >
        <XIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

export function SavedItems() {
  // Behind auth anyway, but stated explicitly (m3-seo §4 spirit).
  useNoIndex();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const params = { page, pageSize: PAGE_SIZE };
  const saved = useQuery({
    queryKey: savedKeys.list(params),
    queryFn: () => savedApi.list(params),
    placeholderData: (prev) => prev,
  });

  const remove = useMutation({
    mutationFn: (id) => savedApi.unsave(id),
    onSuccess: () => {
      // Both the page's list and the shared heart index are now stale.
      queryClient.invalidateQueries({ queryKey: ['saved', 'list'] });
      queryClient.invalidateQueries({ queryKey: savedKeys.index() });
    },
  });

  const items = saved.data?.items ?? [];
  const total = saved.data?.total ?? 0;

  return (
    <PortalLayout nav={BUYER_NAV} subline="Saved items" wide>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-surface-border pb-3">
        <div>
          <h1 className="text-lg font-bold text-ink-900 sm:text-xl">Saved</h1>
          <p className="mt-0.5 text-sm text-muted" aria-live="polite">
            {saved.isSuccess ? `${total} item${total === 1 ? '' : 's'}` : ' '}
          </p>
        </div>
        <Link
          to="/search"
          className="flex min-h-[44px] items-center text-sm font-semibold text-primary-700 hover:text-primary-800"
        >
          Find more products →
        </Link>
      </div>

      {saved.isPending && (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="Loading saved items">
          {Array.from({ length: 8 }, (_, i) => (
            <SavedCardSkeleton key={i} />
          ))}
        </ul>
      )}

      {saved.isError && (
        <div className="rounded-2xl border border-surface-border bg-white shadow-card">
          <ErrorState
            title="We couldn't load your saved items"
            requestId={saved.error?.response?.data?.error?.requestId}
            onRetry={saved.refetch}
          />
        </div>
      )}

      {saved.isSuccess && total === 0 && (
        <div className="rounded-2xl border border-surface-border bg-white shadow-card">
          <EmptyState icon={HeartIcon} title="Nothing saved yet">
            Tap the heart on any product to keep it here for later.
            <div className="mt-4">
              <Link
                to="/search"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-ink-900 px-6 text-sm font-semibold text-white hover:bg-primary-800"
              >
                Browse products
              </Link>
            </div>
          </EmptyState>
        </div>
      )}

      {saved.isSuccess && total > 0 && (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <SavedCard
                key={item.id}
                item={item}
                onRemove={remove.mutate}
                removing={remove.isPending && remove.variables === item.id}
              />
            ))}
          </ul>
          <div className="mt-6">
            <Pagination compact page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
          </div>
        </>
      )}
    </PortalLayout>
  );
}
