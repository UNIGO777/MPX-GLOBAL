import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminCatalogueApi, adminCatalogueKeys } from '../../api/adminCatalogue.js';
import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Combobox } from '../../components/ui/Combobox.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { RowMenu } from '../../components/ui/RowMenu.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { BuildingIcon, ChatIcon, ClockIcon, ExternalIcon, SearchIcon, SearchOffIcon, ShieldIcon, TrashIcon, XIcon } from '../../components/ui/icons.jsx';
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
function PurgeCountdown({ purgeAt }) {
  /**
   * `Date.now()` used to be read straight in the render body, which makes the
   * component impure: two renders of the same row can disagree, and under
   * concurrent rendering React may discard and re-run a render, so the number
   * shown is not guaranteed to be the number computed. Reading the clock once
   * per mount into state keeps the render a pure function of its inputs.
   *
   * The value only needs day granularity, so it never needs to tick.
   */
  const [now] = useState(() => Date.now());
  if (!purgeAt) return null;
  const days = Math.ceil((new Date(purgeAt) - now) / 86_400_000);
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
  const navigate = useNavigate();
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
  /**
   * 🔴 A seller filter arrives in the URL from the Organisations list's "View
   * products" (§4: "open the seller's Organisation" and back again are the
   * paths an investigation follows). The endpoint has always accepted
   * `seller`; this screen simply never read it, so the link opened EVERY
   * product and looked like a broken filter.
   *
   * It is not a control here — there is no seller picker — so it renders as a
   * removable chip rather than a dropdown that would sit empty.
   */
  const seller = params.get('seller') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = Number(params.get('pageSize')) || 20;

  const query = {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(nearingPurge ? { nearingPurge: 'true' } : {}),
    ...(seller ? { seller } : {}),
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
  const hasFilters = Boolean(q || status || nearingPurge || category || seller);

  // ONE `category` param serves both boxes (the server resolves a top to its
  // leaves): a top slug selects only the Category box, a sub slug selects its
  // parent + itself. Derived, so a pasted URL populates both correctly.
  const tops = tree.data ?? [];
  const selTop =
    tops.find((t) => t.slug === category) ??
    tops.find((t) => (t.subs ?? []).some((sub) => sub.slug === category)) ??
    null;
  const selSub = selTop?.subs?.find((sub) => sub.slug === category) ?? null;
  const rows = list.data?.rows ?? [];
  // Only meaningful while the seller filter is on, and only from a row that
  // actually came back — never guessed.
  const sellerName = seller ? (rows[0]?.seller?.name ?? null) : null;
  const total = list.data?.total ?? 0;

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <h1 className="text-2xl font-bold text-ink-900">Products</h1>
        {list.isSuccess && (
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
            {total.toLocaleString()} listed
          </span>
        )}
      </div>

      {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

      {/* Filter toolbar — hybrid comboboxes; the category picker is SEARCHABLE
          (the old optgroup select was unusable at ~200 subs). */}
      <div className="mb-5 rounded-2xl border border-surface-border bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-[280px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <input
              aria-label="Search products"
              type="search"
              className={inputClasses(false, 'pl-9')}
              placeholder="Search products…"
              defaultValue={q}
              onKeyDown={(e) => e.key === 'Enter' && setFilter({ q: e.currentTarget.value })}
              onBlur={(e) => e.target.value !== q && setFilter({ q: e.target.value })}
            />
          </div>
          {/* Category → Sub-category, dependent (owner, 2026-08-11) — the
              single flattened list made long names collide and mixed levels. */}
          <div className="min-w-0 flex-1 basis-0 sm:flex-none sm:basis-auto sm:w-[210px]">
            <Combobox
              id="mod-category"
              value={selTop?.slug ?? ''}
              placeholder="All categories"
              options={[
                { value: '', label: 'All categories' },
                ...tops.map((t) => ({ value: t.slug, label: t.name })),
              ]}
              onChange={(v) => setFilter({ category: v })}
            />
          </div>
          <div className="min-w-0 flex-1 basis-0 sm:flex-none sm:basis-auto sm:w-[210px]">
            <Combobox
              id="mod-subcategory"
              value={selSub?.slug ?? ''}
              disabled={!selTop}
              placeholder={selTop ? `All in ${selTop.name}` : 'All sub-categories'}
              options={[
                { value: '', label: selTop ? `All in ${selTop.name}` : 'All sub-categories' },
                ...(selTop?.subs ?? []).map((sub) => ({ value: sub.slug, label: sub.name })),
              ]}
              onChange={(v) => setFilter({ category: v || selTop.slug })}
            />
          </div>
          <div className="min-w-0 flex-1 basis-0 sm:flex-none sm:basis-auto sm:w-[150px]">
            {/* EXACTLY three states. No drafts, no archived — ever. */}
            <Combobox
              id="mod-status"
              value={status}
              placeholder="All statuses"
              options={[
                { value: '', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'blocked', label: 'Blocked' },
              ]}
              onChange={(v) => setFilter({ status: v })}
            />
          </div>
          <button
            type="button"
            aria-pressed={nearingPurge}
            onClick={() => setFilter({ nearingPurge: nearingPurge ? '' : 'true' })}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all ${
              nearingPurge
                ? 'border-warning-500 bg-warning-50 text-warning-800'
                : 'border-surface-border bg-white text-ink-600 hover:border-warning-400'
            }`}
          >
            <ClockIcon className="h-4 w-4" aria-hidden="true" />
            Nearing purge
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={() => setParams({})}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* The seller filter has no control of its own, so it says so here —
            otherwise one company's catalogue is indistinguishable from the whole
            platform's, which is exactly how this bug read. */}
        {seller && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-[12px] font-medium text-primary-800 ring-1 ring-inset ring-primary-100">
              {/* Every row in a seller-scoped list belongs to the same company,
                  so the NAME is already in the data. The id only shows when the
                  filter matched nothing — there is no row to read a name from,
                  and it is still what a moderator would paste somewhere else. */}
              {sellerName ? (
                <>
                  Products from <span className="font-semibold">{sellerName}</span>
                </>
              ) : (
                <>
                  One exporter&apos;s products
                  <code className="font-mono text-[11px] text-primary-700">{seller}</code>
                </>
              )}
              <button
                type="button"
                onClick={() => setFilter({ seller: '' })}
                aria-label="Show every exporter's products"
                className="rounded-full p-0.5 text-primary-600 hover:bg-primary-100 hover:text-primary-800"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
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
            {/* Phones get CARDS, not a sideways-scrolling table. */}
            <ul className="divide-y divide-surface-border md:hidden">
              {rows.map((p) => {
                const meta = PRODUCT_STATUS_META[p.status];
                const blocked = p.takedown?.isDown;
                return (
                  <li key={p.id} className={`p-4 ${blocked ? 'bg-danger-50/40' : ''}`}>
                    <div className="flex items-start gap-3">
                      {p.image ? (
                        <img src={p.image} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <NoImagePanel ratio="h-11 w-11" className="shrink-0 rounded-lg" />
                      )}
                      {/* The card itself opens the drawer — on a phone the ⋮
                          menu alone is too easy to miss (QA, 2026-08-14). */}
                      <button
                        type="button"
                        onClick={() => setDetail(p)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="font-medium text-ink-900">{p.name}</p>
                        <p className="truncate text-xs text-muted">
                          {p.seller?.name ?? '—'}
                          {p.category?.name ? ` · ${p.category.name}` : ''}
                        </p>
                      </button>
                      <RowMenu
                        label={`Actions for ${p.name}`}
                        items={[
                          { label: 'View details', Icon: ShieldIcon, onSelect: () => setDetail(p) },
                          {
                            label: 'View chats',
                            Icon: ChatIcon,
                            onSelect: () => navigate(`/admin/conversations?productId=${p.id}`),
                          },
                          p.seller?.orgId && {
                            label: 'Open exporter',
                            Icon: BuildingIcon,
                            onSelect: () => navigate(`/admin/organisations/${p.seller.orgId}`),
                          },
                          p.seller?.slug && {
                            label: 'Public profile',
                            Icon: ExternalIcon,
                            onSelect: () => window.open(`/supplier/${p.seller.slug}`, '_blank', 'noopener'),
                          },
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
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {blocked ? (
                        <>
                          <StatusChip label="Taken down" tone="danger" />
                          <span className="text-[11px] text-muted">Exporter had it {meta?.label}</span>
                        </>
                      ) : (
                        <StatusChip label={meta?.label} tone={meta?.tone} />
                      )}
                      {p.seller?.takedownCount > 0 && (
                        <span className="rounded-full bg-danger-50 px-2 py-0.5 text-xs font-semibold text-danger">
                          {p.seller.takedownCount} {p.seller.takedownCount === 1 ? 'takedown' : 'takedowns'}
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-muted">{formatDate(p.createdAt)}</span>
                    </div>
                    {blocked && <PurgeCountdown purgeAt={p.purgeAt} />}
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="bg-ink-50 text-left text-xs uppercase tracking-wide text-muted">
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Product</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Exporter</th>
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
                      <tr
                        key={p.id}
                        className={`transition-colors hover:bg-surface-subtle/50 ${
                          blocked ? 'bg-danger-50/40' : ''
                        }`}
                      >
                        <td className="border-b border-surface-border px-4 py-3">
                          <div className="flex items-center gap-3">
                            {p.image ? (
                              <img src={p.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                            ) : (
                              <NoImagePanel ratio="h-10 w-10" className="shrink-0 rounded-lg" />
                            )}
                            <span className="font-medium text-ink-900">{p.name}</span>
                          </div>
                        </td>
                        <td className="border-b border-surface-border px-4 py-3">
                          <span className="text-ink-800">{p.seller?.name ?? '—'}</span>
                          {/* §A24 repeat-offender signal — increment-only, never
                              reduced by a restore. */}
                          {p.seller?.takedownCount > 0 && (
                            <span className="ml-2 rounded-full bg-danger-50 px-2 py-0.5 text-xs font-semibold text-danger">
                              {p.seller.takedownCount} {p.seller.takedownCount === 1 ? 'takedown' : 'takedowns'}
                            </span>
                          )}
                        </td>
                        <td className="border-b border-surface-border px-4 py-3 text-ink-600">
                          {p.category?.name ?? '—'}
                        </td>
                        <td className="border-b border-surface-border px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {blocked ? (
                              <>
                                <StatusChip label="Taken down" tone="danger" />
                                <span className="text-[11px] text-muted">
                                  Exporter had it {meta?.label}
                                </span>
                              </>
                            ) : (
                              <StatusChip label={meta?.label} tone={meta?.tone} />
                            )}
                          </div>
                          {blocked && (
                            <span className="mt-1 block text-xs text-muted">
                              Down since {formatDate(p.takedown.at)}
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
                              {
                                label: 'View chats',
                                Icon: ChatIcon,
                                onSelect: () => navigate(`/admin/conversations?productId=${p.id}`),
                              },
                              p.seller?.orgId && {
                                label: 'Open exporter',
                                Icon: BuildingIcon,
                                onSelect: () => navigate(`/admin/organisations/${p.seller.orgId}`),
                              },
                              p.seller?.slug && {
                                label: 'Public profile',
                                Icon: ExternalIcon,
                                onSelect: () => window.open(`/supplier/${p.seller.slug}`, '_blank', 'noopener'),
                              },
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
            {detail.image && (
              <img
                src={detail.image}
                alt=""
                className="mb-1 aspect-[2/1] w-full rounded-xl object-cover"
              />
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Status</dt>
              <dd className="font-medium">{PRODUCT_STATUS_META[detail.status]?.label}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Category</dt>
              <dd className="font-medium">{detail.category?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Exporter</dt>
              <dd className="text-right font-medium">
                {detail.seller?.name ?? '—'}
                {detail.seller?.takedownCount > 0 && (
                  <span className="ml-2 rounded-full bg-danger-50 px-2 py-0.5 text-xs font-semibold text-danger">
                    {detail.seller.takedownCount}{' '}
                    {detail.seller.takedownCount === 1 ? 'takedown' : 'takedowns'}
                  </span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Listed</dt>
              <dd className="font-medium">{formatDate(detail.createdAt)}</dd>
            </div>
            {/* Active products are the only ones with a public page (SEO §6). */}
            {detail.status === 'active' && !detail.takedown?.isDown && detail.slug && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Public page</dt>
                <dd>
                  <a
                    href={`/product/${detail.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary-700 underline underline-offset-2"
                  >
                    View listing
                  </a>
                </dd>
              </div>
            )}
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
