import { useMemo, useState } from 'react';
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
import { BoxIcon, EyeOffIcon, InfoIcon, TrashIcon, UploadIcon } from '../../components/ui/icons.jsx';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { EXPORTER_NAV } from './exporterNav.js';
import { formatDate } from '../../lib/format.js';
import { PRODUCT_STATUS_META, PRODUCT_TABS, rowActionsFor } from '../../lib/productStatus.js';

/**
 * M2 web screen 5 — the seller's product list (`/exporter/products`).
 *
 * REDESIGNED 2026-08-11 to the M2 redesign language (screen 6 set it): the
 * underline tabs became STAT TILES — count-forward cards that ARE the filter —
 * with the D1/A15 cap bars living inside the Live and Drafts tiles; rows got
 * richer (thumb + name + category stacked, inline Publish/Hide buttons, the
 * takedown reason inline in the row instead of dumped under the table).
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

/** Tiny in-tile cap bar (D1/A15). Only ever rendered for unverified sellers. */
function TileCapBar({ used, limit }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="mt-2">
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-ink-100"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${used} of ${limit} slots used`}
      >
        <div
          className={`h-full rounded-full ${used >= limit ? 'bg-warning-500' : 'bg-primary-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted">
        {used} of {limit} slots
      </p>
    </div>
  );
}

export function Products() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get('status') ?? 'all';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [banner, setBanner] = useState(null); // { message, isCap } from a refused publish
  const [busyId, setBusyId] = useState(null);

  const query = useMemo(
    () => ({ ...(tab === 'all' ? {} : { status: tab }), page, pageSize: PAGE_SIZE }),
    [tab, page],
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

  const go = (next) => setParams(next, { replace: false });

  return (
    <PortalLayout nav={EXPORTER_NAV} wide>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">My products</h1>
          <p className="mt-1 text-sm text-muted">
            Your catalogue as buyers can find it — drafts stay private until you publish.
          </p>
        </div>
        {/* Owner decision (2026-08-09): forward links WITHIN the module ship
            live rather than disabled — the shared 404 covers any gap. */}
        <Link
          to="/exporter/products/new"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary-600 px-5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          + Add product
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

      {/* Stat tiles ARE the filter — no separate tab strip. On phones the five
          tiles become one swipeable strip instead of a 2-2-1 stack. */}
      <div className="-mx-1 mt-6 flex gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">
        {PRODUCT_TABS.map((t) => {
          const active = tab === t.key;
          const count = counts?.[t.key];
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={active}
              onClick={() => go(t.key === 'all' ? {} : { status: t.key })}
              className={`w-[140px] shrink-0 rounded-xl border p-3.5 text-left transition-all sm:w-auto ${
                active
                  ? 'border-primary-600 bg-primary-50 shadow-card ring-1 ring-primary-600'
                  : 'border-surface-border bg-white hover:border-primary-400 hover:shadow-card'
              }`}
            >
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                {t.label}
              </span>
              <span className="mt-0.5 block text-2xl font-bold leading-tight text-ink-900">
                {count ?? '—'}
              </span>
              {unverified && t.key === 'active' && (
                <TileCapBar used={caps.active.used} limit={caps.active.limit} />
              )}
              {unverified && t.key === 'draft' && (
                <TileCapBar used={caps.drafts.used} limit={caps.drafts.limit} />
              )}
            </button>
          );
        })}
      </div>

      {unverified && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <InfoIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Get verified to publish unlimited products —{' '}
          <Link to="/exporter/kyc" className="font-semibold text-primary-700 hover:underline">
            start verification
          </Link>
        </p>
      )}

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
            icon={BoxIcon}
            title={`Nothing in ${PRODUCT_TABS.find((t) => t.key === tab)?.label}`}
          >
            Try another tile.
          </EmptyState>
        )}

        {list.isSuccess && total > 0 && (
          <>
            {/* Phones get CARDS, not a sideways-scrolling 820px table. */}
            <ul className="divide-y divide-surface-border md:hidden">
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
                          variant="secondary"
                          loading={busyId === p.id && setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: p.id, status: 'active' })}
                        >
                          Publish
                        </Button>
                      )}
                      {actions.includes('hide') && (
                        <Button
                          size="sm"
                          variant="ghost"
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

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
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
                                variant="secondary"
                                loading={busyId === p.id && setStatus.isPending}
                                onClick={() => setStatus.mutate({ id: p.id, status: 'active' })}
                              >
                                Publish
                              </Button>
                            )}
                            {actions.includes('hide') && (
                              <Button
                                size="sm"
                                variant="ghost"
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
