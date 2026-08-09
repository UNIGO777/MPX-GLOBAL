import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminCatalogueApi, adminCatalogueKeys } from '../../api/adminCatalogue.js';
import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { RowMenu } from '../../components/ui/RowMenu.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { SearchOffIcon, ShieldIcon, TrashIcon } from '../../components/ui/icons.jsx';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { formatDate } from '../../lib/format.js';
import { PRODUCT_STATUS_META } from '../../lib/productStatus.js';

/**
 * M2 web screen 10 — product moderation (`/admin/products`).
 *
 * 🔴 DRAFTS AND ARCHIVED ROWS ARE NOT IN THIS LIST AT ALL, and no filter reveals
 * them. The server excludes them; moderation acts on what is live or was live.
 * Do not add a "Drafts" or "Archived" option — a draft was never publicly
 * visible, and taking one down strands it.
 *
 * 🔴 THE STATUS FILTER HAS EXACTLY THREE OPTIONS — Active · Inactive · Blocked.
 * Blocked is not a status: it reads `takedown.isDown`, which is why it sits
 * alongside the other two rather than among them.
 *
 * 🔴 SEARCH IS SUBSTRING, NOT PREFIX. `adminProducts.service.js` builds
 * `new RegExp(escapeRegex(q), 'i')` with no anchor, deliberately — a moderator
 * searching "cotton" expects to find "Premium Cotton Fabric". The design brief's
 * "Starts with…" label is stale; the placeholder here says nothing about it.
 *
 * 🔴 WHO took a product down is STAFF-ONLY (`takedown.byName`). It appears in the
 * row drawer and must never reach anything the seller sees — their own listing
 * shows reason + date only (§A9).
 */
const PAGE_SIZES = [20, 50, 100];

function PurgeCountdown({ purgeAt }) {
  if (!purgeAt) return null;
  const days = Math.ceil((new Date(purgeAt) - Date.now()) / 86_400_000);
  if (days < 0) return null;
  // §A8 is the one place the 180-day purge is user-visible. Under 30 days it
  // turns amber — a countdown that only appears on the last day is no warning.
  return (
    <span className={`block text-xs ${days <= 30 ? 'font-semibold text-warning' : 'text-muted'}`}>
      Purges in {days} {days === 1 ? 'day' : 'days'}
    </span>
  );
}

export function ProductMonitoring() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const canModerate = can(user, 'product:takedown');

  const [takedown, setTakedown] = useState(null);
  const [restore, setRestore] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const category = params.get('category') ?? '';
  const nearingPurge = params.get('nearingPurge') === 'true';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = Number(params.get('pageSize')) || 20;

  const query = {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(nearingPurge ? { nearingPurge: 'true' } : {}),
    page,
    pageSize,
  };

  // The category filter accepts a slug; the tree is already cached elsewhere.
  const tree = useQuery({ queryKey: catalogueKeys.tree, queryFn: catalogueApi.tree });

  const list = useQuery({
    queryKey: adminCatalogueKeys.productsPage(query),
    queryFn: () => adminCatalogueApi.products(query),
    placeholderData: (prev) => prev,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: adminCatalogueKeys.products });
  const onError = (err) => setError(err?.response?.data?.error?.message ?? 'Something went wrong.');

  const doTakedown = useMutation({
    mutationFn: () => adminCatalogueApi.takedown(takedown.id, reason),
    onMutate: () => setError(null),
    onSuccess: () => { setTakedown(null); setReason(''); refresh(); },
    onError,
  });
  const doRestore = useMutation({
    mutationFn: () => adminCatalogueApi.restore(restore.id),
    onMutate: () => setError(null),
    onSuccess: () => { setRestore(null); refresh(); },
    onError,
  });

  const setFilter = (patch) => {
    const next = { ...Object.fromEntries(params), ...patch, page: '1' };
    for (const k of Object.keys(next)) if (!next[k]) delete next[k];
    setParams(next);
  };
  const hasFilters = Boolean(q || status || nearingPurge || category);
  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;

  return (
    <AdminLayout>
      <h1 className="mb-6 text-2xl font-bold text-ink-900">Products</h1>

      {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

      <div className="mb-5 rounded-lg border border-surface-border bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1">
            <Field label="Search">
              {(id) => (
                <input
                  id={id}
                  className={inputClasses(false)}
                  placeholder="Search product name"
                  defaultValue={q}
                  onKeyDown={(e) => e.key === 'Enter' && setFilter({ q: e.currentTarget.value })}
                  onBlur={(e) => e.target.value !== q && setFilter({ q: e.target.value })}
                />
              )}
            </Field>
          </div>
          <div className="w-52">
            <Field label="Category">
              {(id) => (
                <select
                  id={id}
                  className={inputClasses(false)}
                  value={category}
                  onChange={(e) => setFilter({ category: e.target.value })}
                >
                  <option value="">All categories</option>
                  {(tree.data ?? []).map((top) => (
                    <optgroup key={top.id} label={top.name}>
                      {(top.subs ?? []).map((sub) => (
                        <option key={sub.id} value={sub.slug}>{sub.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <div className="w-44">
            <Field label="Status">
              {(id) => (
                <select
                  id={id}
                  className={inputClasses(false)}
                  value={status}
                  onChange={(e) => setFilter({ status: e.target.value })}
                >
                  {/* EXACTLY three. No drafts, no archived — ever. */}
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="blocked">Blocked</option>
                </select>
              )}
            </Field>
          </div>
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-ink-800">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={nearingPurge}
              onChange={(e) => setFilter({ nearingPurge: e.target.checked ? 'true' : '' })}
            />
            Nearing purge
          </label>
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={() => setParams({})}>Clear filters</Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
        {list.isPending && <SkeletonRows rows={8} />}
        {list.isError && (
          <ErrorState
            title="We couldn't load the products"
            requestId={list.error?.response?.data?.error?.requestId}
            onRetry={list.refetch}
          />
        )}

        {list.isSuccess && total === 0 && (
          <EmptyState
            icon={SearchOffIcon}
            title={hasFilters ? 'No products match those filters' : 'No products yet'}
            action={hasFilters ? <Button variant="secondary" onClick={() => setParams({})}>Clear filters</Button> : undefined}
          >
            {hasFilters
              ? `Filters applied: ${[q && `search “${q}”`, status && `status ${status}`, category && `category ${category}`, nearingPurge && 'nearing purge'].filter(Boolean).join(' · ')}.`
              : 'Nothing has been published yet.'}
          </EmptyState>
        )}

        {list.isSuccess && total > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Product</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Seller</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Category</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Status</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Listed</th>
                    <th className="border-b border-surface-border px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const meta = PRODUCT_STATUS_META[p.status];
                    const blocked = p.takedown?.isDown;
                    return (
                      <tr key={p.id}>
                        <td className="border-b border-surface-border px-4 py-3">
                          <div className="flex items-center gap-3">
                            <NoImagePanel ratio="h-10 w-10" className="shrink-0 rounded" />
                            <span className="font-medium text-ink-900">{p.name}</span>
                          </div>
                        </td>
                        <td className="border-b border-surface-border px-4 py-3">
                          <span className="text-ink-800">{p.seller?.name ?? '—'}</span>
                          {/* §A24 repeat-offender signal — increment-only, never
                              reduced by a restore. */}
                          {p.seller?.takedownCount > 0 && (
                            <span className="ml-2 rounded-full bg-danger-50 px-2 py-0.5 text-xs font-semibold text-danger">
                              {p.seller.takedownCount} takedowns
                            </span>
                          )}
                        </td>
                        <td className="border-b border-surface-border px-4 py-3 text-ink-600">
                          {p.category?.name ?? '—'}
                        </td>
                        <td className="border-b border-surface-border px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusChip label={meta?.label} tone={meta?.tone} />
                            {blocked && <StatusChip label="Taken down" tone="danger" />}
                          </div>
                          {blocked && (
                            <span className="mt-1 block text-xs text-muted">
                              {formatDate(p.takedown.at)}
                              <PurgeCountdown purgeAt={p.purgeAt} />
                            </span>
                          )}
                        </td>
                        <td className="border-b border-surface-border px-4 py-3 text-ink-600">
                          {formatDate(p.createdAt)}
                        </td>
                        <td className="border-b border-surface-border px-4 py-3 text-right">
                          {/* Read-only staff get NO menu — not a disabled one. */}
                          <RowMenu
                            items={[
                              { label: 'View details', Icon: ShieldIcon, onSelect: () => setDetail(p) },
                              canModerate && !blocked && {
                                label: 'Take down',
                                Icon: TrashIcon,
                                danger: true,
                                onSelect: () => { setReason(''); setTakedown(p); },
                              },
                              canModerate && blocked && {
                                label: 'Restore',
                                Icon: ShieldIcon,
                                onSelect: () => setRestore(p),
                              },
                            ].filter(Boolean)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPage={(n) => setParams({ ...Object.fromEntries(params), page: String(n) })}
              onPageSize={(n) => setFilter({ pageSize: String(n) })}
            />
          </>
        )}
      </div>

      {/* --- Take down --- */}
      <Modal
        open={Boolean(takedown)}
        onClose={() => setTakedown(null)}
        centered
        danger
        icon={TrashIcon}
        title={`Take down ${takedown?.name}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTakedown(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={doTakedown.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => doTakedown.mutate()}
            >
              Take down
            </Button>
          </>
        }
      >
        <div className="text-left">
          <Field
            label="Reason"
            helper="This is shown to the seller — say what's wrong and what would fix it."
            trailing={<span className="text-xs text-muted">{reason.length}/500</span>}
          >
            {(id) => (
              <textarea
                id={id}
                rows={4}
                maxLength={500}
                className={inputClasses(false, 'h-auto py-3')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </Field>
          <p className="mt-4 text-sm text-muted">
            The product disappears from the public catalogue immediately. The seller keeps it and
            sees this reason. If it stays blocked for 180 days it is permanently deleted.
          </p>
        </div>
      </Modal>

      {/* --- Restore --- */}
      <Modal
        open={Boolean(restore)}
        onClose={() => setRestore(null)}
        centered
        title={`Restore ${restore?.name}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRestore(null)}>Cancel</Button>
            <Button loading={doRestore.isPending} onClick={() => doRestore.mutate()}>Restore</Button>
          </>
        }
      >
        The product returns to exactly the state the seller left it in (live products go live
        again). The seller&apos;s takedown count is not reduced.
      </Modal>

      {/* --- Row detail: the ONLY place the acting admin is named --- */}
      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name}
        subtitle={detail?.seller?.name}
      >
        {detail && (
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Status</dt>
              <dd className="font-medium">{PRODUCT_STATUS_META[detail.status]?.label}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Category</dt>
              <dd className="font-medium">{detail.category?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Listed</dt>
              <dd className="font-medium">{formatDate(detail.createdAt)}</dd>
            </div>
            {detail.takedown?.isDown && (
              <div className="mt-4 rounded-lg border border-danger-200 bg-danger-50 p-4">
                <p className="text-sm font-semibold text-danger">Taken down</p>
                <p className="mt-1 text-sm text-ink-800">{detail.takedown.reason}</p>
                {/* 🔴 STAFF-ONLY. §A9 keeps this out of everything the seller
                    sees; their own listing shows reason + date only. */}
                <p className="mt-2 text-xs text-muted">
                  By {detail.takedown.byName ?? 'a removed user'} · {formatDate(detail.takedown.at)}
                </p>
                <PurgeCountdown purgeAt={detail.purgeAt} />
              </div>
            )}
          </dl>
        )}
      </Drawer>
    </AdminLayout>
  );
}
