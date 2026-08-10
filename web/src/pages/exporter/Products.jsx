import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { productKeys, productsApi } from '../../api/products.js';
import { BlockedBanner } from '../../components/catalogue/BlockedBanner.jsx';
import { CapMeter } from '../../components/catalogue/CapMeter.jsx';
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
import { BoxIcon, EyeOffIcon, TrashIcon, UploadIcon } from '../../components/ui/icons.jsx';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { EXPORTER_NAV } from './exporterNav.js';
import { formatDate } from '../../lib/format.js';
import { PRODUCT_STATUS_META, PRODUCT_TABS, rowActionsFor } from '../../lib/productStatus.js';

/**
 * M2 web screen 5 — the seller's product list (`/exporter/products`).
 *
 * 🔴 THERE IS NO "BLOCKED" TAB. A taken-down product keeps its own status and
 * appears inside that status's tab wearing an extra danger chip — takedown never
 * touches `status` (m5-rules §2), so "Live · Taken down" is a real, correct row.
 *
 * 🔴 THE CAP METER AND THE LIVE TAB DELIBERATELY DISAGREE. `caps.active.used`
 * excludes taken-down rows (§A10 — a block frees a slot); `counts.active` does
 * not. "2 of 3 live" beside a Live tab of 3 is correct and required. Both come
 * from the same response, so they cannot drift — do not "fix" one to match.
 *
 * 🔴 NO "revert to draft" action exists anywhere: draft is one-way (§A1).
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
  const cover = product.images?.[0];
  if (cover) {
    return <img src={cover} alt="" className="h-12 w-12 rounded-lg object-cover" />;
  }
  return <NoImagePanel ratio="h-12 w-12" className="shrink-0 rounded-lg" />;
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

  // One invalidation refreshes rows, tab counts AND the cap meter, because all
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
          {list.data && (
            <div className="mt-4">
              <CapMeter caps={list.data.caps} />
            </div>
          )}
        </div>
        {/* Owner decision (2026-08-09): forward links WITHIN the module ship
            live rather than disabled — screens 6 and 7 land in the next step and
            the shared 404 covers the gap in between. This is a deliberate
            exception to web-ui-notes.md's dead-control rule, not an oversight. */}
        <Link
          to="/exporter/products/new"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary-600 px-5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          + Add product
        </Link>
      </div>

      {banner && (
        <Alert tone="danger" className="mt-6">
          {banner.message}
          {banner.isCap && (
            <>
              {' '}
              <Link to="/exporter/kyc" className="font-semibold underline">Get verified</Link>
            </>
          )}
        </Alert>
      )}

      {/* Tabs. No "Blocked" tab by design — see the header comment. */}
      <div className="mt-6 flex flex-wrap gap-1 border-b border-surface-border">
        {PRODUCT_TABS.map((t) => {
          const active = tab === t.key;
          const count = counts?.[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => go(t.key === 'all' ? {} : { status: t.key })}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px min-h-[44px] border-b-2 px-4 text-sm font-medium transition-colors ${
                active
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-ink-600 hover:text-ink-900'
              }`}
            >
              {t.label}
              {count !== undefined && <span className="ml-1.5 text-muted">({count})</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
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
            {list.data.caps?.verified === false && (
              <span className="mt-2 block text-xs">
                While unverified you can publish up to {list.data.caps.active.limit} live products.
              </span>
            )}
          </EmptyState>
        )}

        {list.isSuccess && !firstRun && total === 0 && (
          <EmptyState icon={BoxIcon} title={`Nothing in ${PRODUCT_TABS.find((t) => t.key === tab)?.label}`}>
            Try another tab.
          </EmptyState>
        )}

        {list.isSuccess && total > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Product</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Category</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Price</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Status</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Created</th>
                    <th className="border-b border-surface-border px-4 py-3" />
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
                        // Design tints a taken-down row pale red (bg-[#FEF3F2]/30)
                        // so it reads at a glance without opening anything.
                        className={`align-middle ${archived ? 'opacity-60' : ''} ${
                          p.takedown ? 'bg-danger-50/40' : ''
                        } ${busyId === p.id ? 'opacity-50' : ''}`}
                      >
                        <td className="border-b border-surface-border px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Thumb product={p} />
                            <span className={`font-medium text-ink-900 ${archived ? 'line-through' : ''}`}>
                              {p.name}
                            </span>
                          </div>
                        </td>
                        <td className="border-b border-surface-border px-4 py-3 text-ink-600">
                          {categoryName.get(p.categoryId) ?? '—'}
                        </td>
                        <td className="border-b border-surface-border px-4 py-3">
                          <PriceLine price={p.price} unit={p.unit} size="sm" />
                        </td>
                        <td className="border-b border-surface-border px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusChip label={meta?.label} tone={meta?.tone} />
                            {/* Overlay, never a fifth status. */}
                            {p.takedown && <StatusChip label="Taken down" tone="danger" />}
                          </div>
                        </td>
                        <td className="border-b border-surface-border px-4 py-3 text-ink-600">
                          {formatDate(p.createdAt)}
                        </td>
                        <td className="border-b border-surface-border px-4 py-3 text-right">
                          {actions.length > 0 && (
                            <RowMenu
                              items={[
                                actions.includes('publish') && {
                                  label: 'Publish',
                                  Icon: UploadIcon,
                                  onSelect: () => setStatus.mutate({ id: p.id, status: 'active' }),
                                },
                                actions.includes('hide') && {
                                  label: 'Hide',
                                  Icon: EyeOffIcon,
                                  onSelect: () => setStatus.mutate({ id: p.id, status: 'inactive' }),
                                },
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* A taken-down row's reason, shown once beneath the table rather
                than repeated per row. Reason + date only — never the admin. */}
            {rows.filter((p) => p.takedown).map((p) => (
              <div key={p.id} className="border-t border-surface-border p-4">
                <p className="mb-2 text-sm font-medium text-ink-900">{p.name}</p>
                <BlockedBanner takedown={p.takedown} />
              </div>
            ))}

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
