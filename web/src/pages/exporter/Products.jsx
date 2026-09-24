import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { productKeys, productsApi } from '../../api/products.js';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { PriceLine } from '../../components/catalogue/PriceLine.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { RowMenu } from '../../components/ui/RowMenu.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { BoxIcon, EyeOffIcon, SearchIcon, ShieldIcon, TrashIcon, UploadIcon, XIcon } from '../../components/ui/icons.jsx';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { EXPORTER_NAV } from './exporterNav.js';
import { formatDate } from '../../lib/format.js';
import { PRODUCT_STATUS_META, PRODUCT_TABS, rowActionsFor } from '../../lib/productStatus.js';

/**
 * M2 web screen 5 — the seller's product list (`/exporter/products`).
 *
 * REDESIGNED 2026-08-11, and again 2026-09-24 (owner: "enhance it … fully
 * responsive"): the stat tiles that were both filter AND quota meter are split —
 * a SEGMENTED filter bar with counts (scrolls sideways on phones) and a separate
 * "Listing limits" card for the D1/A15 caps; a name SEARCH (`?q=`, server-side,
 * own products only); Publish = the filled action, Hide = secondary; cards below
 * lg (phones AND tablets), the table from lg. Rows keep thumb + name + category,
 * the takedown reason inline.
 *
 * 🔴 THERE IS NO "BLOCKED" TAB. A taken-down product keeps its own status and
 * appears inside that status's tile wearing an extra danger chip — takedown
 * never touches `status` (m5-rules §2), so "Live · Taken down" is a real row.
 *
 * 🔴 THE CAP BAR AND ITS OWN TILE'S COUNT DELIBERATELY DISAGREE.
 * `caps.active.used` excludes taken-down rows (§A10 — a block frees a slot);
 * `counts.active` does not. A Live tile showing 3 with "2 of 3 slots" beneath
 * it is correct and required. Both come from the same response, so they cannot
 * drift — do not "fix" one to match the other.
 *
 * 🔴 Cap UI renders ONLY when `caps.verified` is false — a verified account has
 * no cap and must see no cap UI at all (the server sends no numbers).
 *
 * 🔴 NO "revert to draft" action exists anywhere: draft is one-way (§A1).
 *
 * "All" EXCLUDES archived (owner, 2026-08-11) — server-enforced in `listMine`:
 * the unfiltered list and `counts.all` both skip archived rows, whose only
 * window is their own tile. So All = draft + active + inactive, by design.
 */
const PAGE_SIZE = 20;

/** The two publish refusals are different failures and must read differently. */
function publishError(err) {
  const status = err?.response?.status;
  const message = err?.response?.data?.error?.message ?? 'Something went wrong.';
  // 409 = a cap (D1/A15). 400 = required specifications missing at publish.
  return { message, isCap: status === 409 };
}

function Thumb({ product }) {
  // Owner views return {url, publicId} refs since 2026-08-11 (the edit screen
  // needs the ids back); public views still send bare URLs — take either.
  const first = product.images?.[0];
  const cover = typeof first === 'string' ? first : first?.url;
  if (cover) {
    return <img src={cover} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />;
  }
  return <NoImagePanel ratio="h-14 w-14" className="shrink-0 rounded-lg" />;
}

/**
 * One D1/A15 meter in the "Listing limits" card (2026-09-24 redesign — the cap
 * bars used to be squeezed inside two of the five filter tiles, which made the
 * tiles uneven and mixed "filter" with "quota"). Unverified sellers only.
 */
function LimitMeter({ label, used, limit }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const full = used >= limit;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="font-medium text-ink-700">{label}</span>
        <span className={`tabular-nums ${full ? 'font-semibold text-warning-700' : 'text-muted'}`}>
          {used} of {limit}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${label}: ${used} of ${limit} used`}
      >
        <div
          className={`h-full rounded-full ${full ? 'bg-warning-500' : 'bg-primary-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Products() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get('status') ?? 'all';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = params.get('q') ?? '';

  // The box is local; the URL (and so the query) follows it after a pause.
  const [draftQ, setDraftQ] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => {
      if (draftQ.trim() === q) return;
      const next = new URLSearchParams(params);
      if (draftQ.trim()) next.set('q', draftQ.trim());
      else next.delete('q');
      next.delete('page');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [draftQ, q, params, setParams]);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [banner, setBanner] = useState(null); // { message, isCap } from a refused publish
  const [busyId, setBusyId] = useState(null);

  const query = useMemo(
    () => ({ ...(tab === 'all' ? {} : { status: tab }), ...(q ? { q } : {}), page, pageSize: PAGE_SIZE }),
    [tab, q, page],
  );

  const list = useQuery({
    queryKey: productKeys.minePage(query),
    queryFn: () => productsApi.mine(query),
    placeholderData: (prev) => prev,
  });

  // `/products/mine` returns `categoryId` only, never the leaf's name — the
  // cached category tree supplies it, one lookup for the whole page.
  const tree = useQuery({ queryKey: catalogueKeys.tree, queryFn: catalogueApi.tree });
  const categoryName = useMemo(() => {
    const map = new Map();
    for (const top of tree.data ?? []) {
      for (const sub of top.subs ?? []) map.set(sub.id, sub.name);
    }
    return map;
  }, [tree.data]);

  // One invalidation refreshes rows, tile counts AND the cap bars, because all
  // three ride on the same response.
  const refresh = () => qc.invalidateQueries({ queryKey: productKeys.mine });

  const setStatus = useMutation({
    mutationFn: ({ id, status }) => productsApi.setStatus(id, status),
    onMutate: ({ id }) => { setBusyId(id); setBanner(null); },
    onSuccess: refresh,
    onError: (err) => setBanner(publishError(err)),
    onSettled: () => setBusyId(null),
  });

  const archive = useMutation({
    mutationFn: (id) => productsApi.archive(id),
    onMutate: (id) => setBusyId(id),
    onSuccess: () => { setConfirmDelete(null); refresh(); },
    onError: (err) => setBanner(publishError(err)),
    onSettled: () => setBusyId(null),
  });

  const counts = list.data?.counts;
  const caps = list.data?.caps;
  const unverified = caps?.verified === false;
  const rows = list.data?.products ?? [];
  const total = list.data?.total ?? 0;
  // The very first visit — no products in ANY tab. The most important empty
  // state in the module: it decides whether a new exporter lists at all.
  const firstRun = counts?.all === 0;

  // Filter / page changes keep the search.
  const go = (next) => setParams({ ...next, ...(q ? { q } : {}) }, { replace: false });

  return (
    <PortalLayout nav={EXPORTER_NAV} wide>
      {/* Phone-first (2026-09-24): title and the Add button share a row down
          to 360px — the button never drops under a two-line title. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">My products</h1>
          <p className="mt-1 hidden text-sm text-muted sm:block">
            Your catalogue as buyers can find it — drafts stay private until you publish.
          </p>
        </div>
        {/* Owner decision (2026-08-09): forward links WITHIN the module ship
            live rather than disabled — the shared 404 covers any gap. */}
        <Link
          to="/exporter/products/new"
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 sm:px-5"
        >
          <span aria-hidden="true" className="text-base leading-none">+</span>
          Add product
        </Link>
      </div>

      {banner && (
        <Alert tone="danger" className="mt-5">
          {banner.message}
          {banner.isCap && (
            <>
              {' '}
              <Link to="/exporter/kyc" className="font-semibold underline">Get verified</Link>
            </>
          )}
        </Alert>
      )}

      {/* 🔴 D1/A15 caps — ONLY while unverified (a verified account has no cap
          and the server sends no numbers). The Live meter reads caps.active.used,
          which EXCLUDES taken-down rows (§A10), so it can disagree with the Live
          count in the filter bar — correct and required; do not "fix" it. */}
      {unverified && (
        <section
          aria-label="Listing limits"
          className="mt-5 flex flex-col gap-4 rounded-2xl border border-surface-border bg-white p-4 shadow-card sm:flex-row sm:items-center sm:gap-6"
        >
          <div className="flex items-start gap-3 sm:w-64 sm:shrink-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <ShieldIcon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink-900">Listing limits</span>
              <span className="block text-xs text-muted">Verified sellers have no limits.</span>
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:gap-6">
            <LimitMeter label="Live products" used={caps.active.used} limit={caps.active.limit} />
            <LimitMeter label="Drafts" used={caps.drafts.used} limit={caps.drafts.limit} />
          </div>
          <Link
            to="/exporter/kyc"
            className="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-full border border-primary-600 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50"
          >
            Get verified
          </Link>
        </section>
      )}

      {/* Filter + search. The filter is a SEGMENTED bar (it used to be five
          stat tiles that were also the quota meter, uneven and cut off on
          phones); it scrolls sideways on small screens, never wraps. */}
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Filter products"
          className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:px-0"
        >
          {/* White track with a border (owner, 2026-09-24: "not clearly
              visible") — a grey fill vanished into the tinted page canvas. */}
          <div className="flex shrink-0 gap-1 rounded-full border border-ink-200 bg-white p-1 shadow-sm">
            {PRODUCT_TABS.map((t) => {
              const active = tab === t.key;
              const count = counts?.[t.key];
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => go(t.key === 'all' ? {} : { status: t.key })}
                  className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
                    active ? 'bg-primary-600 text-white shadow-sm' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                  }`}
                >
                  {t.label}
                  <span
                    className={`rounded-full px-1.5 text-[11px] tabular-nums leading-[18px] ${
                      active ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    {count ?? '–'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative w-full lg:w-72">
          <label htmlFor="product-search" className="sr-only">Search your products</label>
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            aria-hidden="true"
          />
          <input
            id="product-search"
            type="search"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder="Search by product name"
            maxLength={80}
            className="search-own-clear h-11 w-full rounded-full border border-ink-200 bg-white pl-9 pr-9 text-[13px] text-ink-900 shadow-sm transition-colors placeholder:text-ink-500 hover:border-ink-300 focus:border-primary-600 focus:outline-none focus:ring-4 focus:ring-primary-600/10"
          />
          {draftQ && (
            <button
              type="button"
              onClick={() => setDraftQ('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {list.isPending && <div className="p-4"><SkeletonRows rows={6} /></div>}

        {list.isError && (
          <ErrorState
            title="We couldn't load your products"
            requestId={list.error?.response?.data?.error?.requestId}
            onRetry={list.refetch}
          />
        )}

        {list.isSuccess && firstRun && (
          <EmptyState
            icon={BoxIcon}
            title="List your first product"
            action={
              <Link
                to="/exporter/products/new"
                className="inline-flex min-h-[44px] items-center rounded-full bg-primary-600 px-6 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Add product
              </Link>
            }
          >
            Buyers find you through your catalogue. Add photos, specs and pricing — you can save a
            draft and finish later.
            {unverified && (
              <span className="mt-2 block text-xs">
                While unverified you can publish up to {caps.active.limit} live products.
              </span>
            )}
          </EmptyState>
        )}

        {list.isSuccess && !firstRun && total === 0 && (
          <EmptyState
            icon={q ? SearchIcon : BoxIcon}
            title={q ? `No products match “${q}”` : `Nothing in ${PRODUCT_TABS.find((t) => t.key === tab)?.label}`}
          >
            {q ? (
              <button
                type="button"
                onClick={() => setDraftQ('')}
                className="font-semibold text-primary-700 hover:underline"
              >
                Clear the search
              </button>
            ) : (
              'Try another filter.'
            )}
          </EmptyState>
        )}

        {list.isSuccess && total > 0 && (
          <>
            {/* Phones get CARDS, not a sideways-scrolling 820px table. */}
            {/* Cards below lg — phones AND tablets. The 820px table used to
                start at md, so a tablet scrolled the list sideways. */}
            <ul className="divide-y divide-surface-border lg:hidden">
              {rows.map((p) => {
                const meta = PRODUCT_STATUS_META[p.status];
                const actions = rowActionsFor(p);
                const archived = p.status === 'archived';
                return (
                  <li
                    key={p.id}
                    className={`p-4 ${archived ? 'opacity-60' : ''} ${
                      p.takedown ? 'bg-danger-50/40' : ''
                    } ${busyId === p.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <Thumb product={p} />
                      <div className="min-w-0 flex-1">
                        {actions.includes('edit') ? (
                          <Link
                            to={`/exporter/products/${p.id}/edit`}
                            className={`block font-medium text-ink-900 ${archived ? 'line-through' : ''}`}
                          >
                            {p.name}
                          </Link>
                        ) : (
                          <span className={`block font-medium text-ink-900 ${archived ? 'line-through' : ''}`}>
                            {p.name}
                          </span>
                        )}
                        <span className="block truncate text-xs text-muted">
                          {categoryName.get(p.categoryId) ?? '—'}
                        </span>
                        <div className="mt-1">
                          <PriceLine price={p.price} unit={p.unit} size="sm" />
                        </div>
                        {/* Reason + date only — NEVER the acting admin (§A9). */}
                        {p.takedown && (
                          <p className="mt-1 text-xs text-danger">
                            Removed{formatDate(p.takedown.at) ? ` ${formatDate(p.takedown.at)}` : ''}
                            {p.takedown.reason ? ` — ${p.takedown.reason}` : ''}
                          </p>
                        )}
                      </div>
                      {(actions.includes('edit') || actions.includes('delete')) && (
                        <RowMenu
                          items={[
                            actions.includes('edit') && {
                              label: 'Edit',
                              Icon: BoxIcon,
                              to: `/exporter/products/${p.id}/edit`,
                            },
                            actions.includes('delete') && {
                              label: 'Delete',
                              Icon: TrashIcon,
                              danger: true,
                              onSelect: () => setConfirmDelete(p),
                            },
                          ].filter(Boolean)}
                        />
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusChip label={meta?.label} tone={meta?.tone} />
                        {p.takedown && <StatusChip label="Taken down" tone="danger" />}
                        <span className="text-xs text-muted">{formatDate(p.createdAt)}</span>
                      </div>
                      {actions.includes('publish') && (
                        <Button
                          size="sm"
                          loading={busyId === p.id && setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: p.id, status: 'active' })}
                        >
                          Publish
                        </Button>
                      )}
                      {actions.includes('hide') && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busyId === p.id && setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: p.id, status: 'inactive' })}
                        >
                          Hide
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden lg:block">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Product</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Price</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Status</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Created</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const meta = PRODUCT_STATUS_META[p.status];
                    const actions = rowActionsFor(p);
                    const archived = p.status === 'archived';
                    return (
                      <tr
                        key={p.id}
                        // Design tints a taken-down row pale red so it reads at
                        // a glance without opening anything.
                        className={`align-middle transition-colors hover:bg-surface-subtle/40 ${
                          archived ? 'opacity-60' : ''
                        } ${p.takedown ? 'bg-danger-50/40' : ''} ${
                          busyId === p.id ? 'opacity-50' : ''
                        }`}
                      >
                        <td className="border-b border-surface-border px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Thumb product={p} />
                            <div className="min-w-0">
                              {actions.includes('edit') ? (
                                <Link
                                  to={`/exporter/products/${p.id}/edit`}
                                  className={`block truncate font-medium text-ink-900 hover:text-primary-700 ${
                                    archived ? 'line-through' : ''
                                  }`}
                                >
                                  {p.name}
                                </Link>
                              ) : (
                                <span
                                  className={`block truncate font-medium text-ink-900 ${
                                    archived ? 'line-through' : ''
                                  }`}
                                >
                                  {p.name}
                                </span>
                              )}
                              <span className="block truncate text-xs text-muted">
                                {categoryName.get(p.categoryId) ?? '—'}
                              </span>
                              {/* Reason + date only — NEVER the acting admin
                                  (§A9). Inline so the row explains itself. */}
                              {p.takedown && (
                                <span className="mt-0.5 block truncate text-xs text-danger">
                                  Removed{formatDate(p.takedown.at) ? ` ${formatDate(p.takedown.at)}` : ''}
                                  {p.takedown.reason ? ` — ${p.takedown.reason}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-surface-border px-4 py-3">
                          <PriceLine price={p.price} unit={p.unit} size="sm" />
                        </td>
                        <td className="border-b border-surface-border px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusChip label={meta?.label} tone={meta?.tone} />
                            {/* Overlay, never a fifth status. */}
                            {p.takedown && <StatusChip label="Taken down" tone="danger" />}
                          </div>
                        </td>
                        <td className="border-b border-surface-border px-4 py-3 text-ink-600">
                          {formatDate(p.createdAt)}
                        </td>
                        <td className="border-b border-surface-border px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {/* The lifecycle action is one click, not two — the
                                menu keeps the rest. Always visible: primary
                                actions are never hover-only (web-design.md). */}
                            {actions.includes('publish') && (
                              <Button
                                size="sm"
                                loading={busyId === p.id && setStatus.isPending}
                                onClick={() => setStatus.mutate({ id: p.id, status: 'active' })}
                              >
                                Publish
                              </Button>
                            )}
                            {actions.includes('hide') && (
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={busyId === p.id && setStatus.isPending}
                                onClick={() => setStatus.mutate({ id: p.id, status: 'inactive' })}
                              >
                                Hide
                              </Button>
                            )}
                            {(actions.includes('edit') || actions.includes('delete')) && (
                              <RowMenu
                                items={[
                                  actions.includes('edit') && {
                                    label: 'Edit',
                                    Icon: BoxIcon,
                                    to: `/exporter/products/${p.id}/edit`,
                                  },
                                  actions.includes('hide') && {
                                    label: 'Hide',
                                    Icon: EyeOffIcon,
                                    onSelect: () =>
                                      setStatus.mutate({ id: p.id, status: 'inactive' }),
                                  },
                                  actions.includes('publish') && {
                                    label: 'Publish',
                                    Icon: UploadIcon,
                                    onSelect: () =>
                                      setStatus.mutate({ id: p.id, status: 'active' }),
                                  },
                                  actions.includes('delete') && {
                                    label: 'Delete',
                                    Icon: TrashIcon,
                                    danger: true,
                                    onSelect: () => setConfirmDelete(p),
                                  },
                                ].filter(Boolean)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPage={(n) => go(tab === 'all' ? { page: String(n) } : { status: tab, page: String(n) })}
            />
          </>
        )}
      </div>

      {/* Below lg the floating chat button sits over the page's bottom-right
          corner; this lets the last card's Publish/Hide scroll clear of it. */}
      <div aria-hidden="true" className="h-20 lg:hidden" />

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        centered
        danger
        icon={TrashIcon}
        title="Archive this product?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={archive.isPending}
              onClick={() => archive.mutate(confirmDelete.id)}
            >
              Archive product
            </Button>
          </>
        }
      >
        {/* 🔴 The copy owns the semantics: this ARCHIVES. Never say "permanently
            deleted" — the row and its images are kept indefinitely (§A7). */}
        This archives the product. It disappears from the catalogue and can&apos;t be edited or
        restored — to sell it again later, create a new listing. Your product name and web address
        become free to reuse.
      </Modal>
    </PortalLayout>
  );
}
