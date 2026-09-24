import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminCatalogueApi, adminCatalogueKeys } from '../../api/adminCatalogue.js';
import { catalogueApi, catalogueKeys } from '../../api/catalogue.js';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FilterChip } from '../../components/ui/FilterChip.jsx';
import { ToolbarSearch } from '../../components/ui/ToolbarSearch.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { CompanyAvatar } from '../../components/chat/CompanyAvatar.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { RowMenu } from '../../components/ui/RowMenu.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { BuildingIcon, ChatIcon, ClockIcon, ExternalIcon, SearchOffIcon, ShieldIcon, TrashIcon, XIcon } from '../../components/ui/icons.jsx';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { formatDate } from '../../lib/format.js';
import { PRODUCT_STATUS_META } from '../../lib/productStatus.js';
import { cp } from '../../lib/consolePath.js';

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

/** Product image or the no-image panel, one size everywhere in this list. */
function ProductThumb({ p }) {
  return p.image ? (
    <img src={p.image} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
  ) : (
    <NoImagePanel ratio="h-12 w-12" className="shrink-0 rounded-lg" />
  );
}

/** Exporter under the product name, with the §A24 repeat-offender count
 *  (increment-only, never reduced by a restore). */
function SellerLine({ p }) {
  return (
    <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
      <BuildingIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
      <span className="truncate">{p.seller?.name ?? '—'}</span>
      {p.seller?.takedownCount > 0 && (
        <span className="shrink-0 rounded-full bg-danger-50 px-1.5 py-px text-[11px] font-semibold text-danger">
          {p.seller.takedownCount} {p.seller.takedownCount === 1 ? 'takedown' : 'takedowns'}
        </span>
      )}
    </p>
  );
}

/** Status chip; a taken-down row says so, what the exporter had it as, and
 *  the purge countdown. */
function ProductStatus({ p }) {
  const meta = PRODUCT_STATUS_META[p.status];
  if (!p.takedown?.isDown) return <StatusChip label={meta?.label} tone={meta?.tone} />;
  return (
    <div className="min-w-0">
      <StatusChip label="Taken down" tone="danger" />
      <span className="mt-1 block whitespace-nowrap text-[11.5px] text-muted">
        Was {meta?.label?.toLowerCase()} · down {formatDate(p.takedown.at)}
      </span>
      <PurgeCountdown purgeAt={p.purgeAt} />
    </div>
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

  // Keep the search box in step when navigation changes `q` (back/forward, a
  // cleared filter) — same pattern as the Organisations list.
  const [draft, setDraft] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  if (lastQ !== q) {
    setLastQ(q);
    // Only when q moved for another reason (back/forward, Clear) — not when it
    // is just our own debounced echo, which would eat a trailing space mid-word.
    if (q !== draft.trim()) setDraft(q);
  }

  // Search as you type (owner, 2026-09-24 — it used to wait for Enter). A
  // short pause, then `?q` updates; the FUNCTIONAL update keeps any filter
  // clicked during the pause, and `replace` keeps typing out of history.
  useEffect(() => {
    const term = draft.trim();
    if (term === q) return undefined;
    const t = setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (term) next.set('q', term);
        else next.delete('q');
        next.delete('page');
        return next;
      }, { replace: true });
    }, 350);
    return () => clearTimeout(t);
  }, [draft, q, setParams]);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Products — MPX Global';
    return () => { document.title = previous; };
  }, []);

  /** One action list for the card, the table row and nothing else to drift. */
  const rowActions = (p) => {
    const blocked = p.takedown?.isDown;
    return [
      { label: 'View details', Icon: ShieldIcon, onSelect: () => setDetail(p) },
      { label: 'View chats', Icon: ChatIcon, onSelect: () => navigate(cp(`/admin/conversations?productId=${p.id}`)) },
      p.seller?.orgId && {
        label: 'Open exporter',
        Icon: BuildingIcon,
        onSelect: () => navigate(cp(`/admin/organisations/${p.seller.orgId}`)),
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
      canModerate && blocked && { label: 'Restore', Icon: ShieldIcon, onSelect: () => setRestore(p) },
    ].filter(Boolean);
  };

  // Clicking anywhere on a row/card opens the details — unless the click was
  // on something interactive inside it (the ⋮ menu).
  const openRow = (e, p) => {
    if (e.target.closest('a, button, [role="menu"], [role="menuitem"]')) return;
    setDetail(p);
  };

  const categoryOptions = [{ value: '', label: 'Any' }, ...tops.map((t) => ({ value: t.slug, label: t.name }))];
  const subOptions = [
    { value: '', label: `All in ${selTop?.name ?? ''}` },
    ...(selTop?.subs ?? []).map((sub) => ({ value: sub.slug, label: sub.name })),
  ];

  return (
    <AdminLayout>
      <header className="mb-4 sm:mb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Products</h1>
          {list.isSuccess && (
            <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
              {total.toLocaleString()} listed
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          Everything live or taken down. Drafts and archived listings never appear here.
        </p>
      </header>

      {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

      {/* Toolbar (2026-09-24) — the Organisations language: a bordered search
          and FILTER CHIPS. The old card of dropdowns collapsed to three empty
          "⌄" boxes on phones. Category → Sub-category stay dependent (owner,
          2026-08-11): the sub chip appears once a category is picked. */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:max-w-md lg:flex-1">
          <ToolbarSearch
            id="mod-search"
            label="Search products"
            value={draft}
            onChange={setDraft}
            onSubmit={() => setFilter({ q: draft.trim() })}
            onClear={() => { setDraft(''); setFilter({ q: '' }); }}
            placeholder="Search products…"
          />
        </div>
        <div className="scrollbar-none -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
          <FilterChip
            label="Category"
            value={selTop?.slug ?? ''}
            options={categoryOptions}
            onChange={(v) => setFilter({ category: v })}
          />
          {selTop && (selTop.subs ?? []).length > 0 && (
            <FilterChip
              label="Sub-category"
              value={selSub?.slug ?? ''}
              options={subOptions}
              onChange={(v) => setFilter({ category: v || selTop.slug })}
            />
          )}
          {/* EXACTLY three states. No drafts, no archived — ever. */}
          <FilterChip
            label="Status"
            value={status}
            options={[
              { value: '', label: 'Any' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'blocked', label: 'Blocked' },
            ]}
            onChange={(v) => setFilter({ status: v })}
          />
          <button
            type="button"
            aria-pressed={nearingPurge}
            onClick={() => setFilter({ nearingPurge: nearingPurge ? '' : 'true' })}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold shadow-sm transition-colors ${
              nearingPurge
                ? 'border-warning-500 bg-warning-50 text-warning-800'
                : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50'
            }`}
          >
            <ClockIcon className="h-4 w-4" aria-hidden="true" />
            Nearing purge
          </button>
          {/* The seller filter has no control of its own (it arrives from the
              Organisations list), so it shows as a removable chip — otherwise
              one company's catalogue is indistinguishable from the platform's. */}
          {seller && (
            <span className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-primary-600 bg-primary-50 pl-3.5 pr-2 text-[13px] font-semibold text-primary-700">
              {sellerName ? (
                <>Exporter: <span className="font-medium">{sellerName}</span></>
              ) : (
                <>
                  One exporter
                  <code className="font-mono text-[11px]">{seller}</code>
                </>
              )}
              <button
                type="button"
                onClick={() => setFilter({ seller: '' })}
                aria-label="Show every exporter's products"
                className="rounded-full p-1 hover:bg-primary-100"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setDraft(''); setParams({}); }}
              className="ml-1 shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 text-[13px] font-semibold text-primary-700 hover:bg-primary-50"
            >
              Clear filters
            </button>
          )}
        </div>
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
            action={hasFilters ? <Button variant="secondary" size="sm" onClick={() => { setDraft(''); setParams({}); }}>Clear filters</Button> : undefined}
          >
            {hasFilters
              ? `Filters applied: ${[q && `search “${q}”`, status && `status ${status}`, category && `category ${category}`, nearingPurge && 'nearing purge'].filter(Boolean).join(' · ')}.`
              : 'Nothing has been published yet.'}
          </EmptyState>
        )}

        {list.isSuccess && total > 0 && (
          <>
            {/* Cards below lg — phones AND tablets (the table cut its last
                columns off at 1024 with the sidebar open). */}
            <ul className="divide-y divide-surface-border lg:hidden">
              {rows.map((p) => {
                const blocked = p.takedown?.isDown;
                return (
                  <li
                    key={p.id}
                    onClick={(e) => openRow(e, p)}
                    className={`cursor-pointer p-4 transition-colors ${
                      blocked ? 'bg-danger-50/40 hover:bg-danger-50/70' : 'hover:bg-ink-50/70'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <ProductThumb p={p} />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 font-semibold leading-snug text-ink-900">{p.name}</p>
                        <SellerLine p={p} />
                      </div>
                      <RowMenu label={`Actions for ${p.name}`} items={rowActions(p)} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-[3.75rem]">
                      <div className="min-w-0">
                        <ProductStatus p={p} />
                      </div>
                      <span className="text-xs text-muted">
                        {p.category?.name ? `${p.category.name} · ` : ''}
                        {formatDate(p.createdAt)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col />
                  <col className="w-[10rem]" />
                  <col className="w-[12.5rem]" />
                  <col className="hidden w-[7.5rem] xl:table-column" />
                  <col className="w-[3.5rem]" />
                </colgroup>
                <thead className="border-b border-surface-border bg-ink-50/60 text-[11px] uppercase tracking-wider text-ink-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Product</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Category</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                    <th scope="col" className="hidden px-4 py-3 font-semibold xl:table-cell">Listed</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {rows.map((p) => {
                    const blocked = p.takedown?.isDown;
                    return (
                      <tr
                        key={p.id}
                        onClick={(e) => openRow(e, p)}
                        className={`cursor-pointer transition-colors ${
                          blocked ? 'bg-danger-50/40 hover:bg-danger-50/70' : 'hover:bg-ink-50/70'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <ProductThumb p={p} />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-ink-900">{p.name}</p>
                              <SellerLine p={p} />
                            </div>
                          </div>
                        </td>
                        <td className="truncate px-4 py-3 text-[13px] text-ink-600">{p.category?.name ?? '—'}</td>
                        <td className="px-4 py-3"><ProductStatus p={p} /></td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-[13px] text-muted xl:table-cell">{formatDate(p.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <RowMenu label={`Actions for ${p.name}`} items={rowActions(p)} />
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

      {/* --- Row detail: the ONLY place the acting admin is named ---
          Redesigned 2026-09-24: image + chips, the takedown record, an
          exporter card (the investigation path), facts, and the actions in
          the footer. */}
      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name}
        subtitle={detail?.category?.name ? `in ${detail.category.name}` : undefined}
        footer={
          detail ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(cp(`/admin/conversations?productId=${detail.id}`))}
              >
                <ChatIcon className="h-4 w-4" aria-hidden="true" />
                View chats
              </Button>
              {canModerate &&
                (detail.takedown?.isDown ? (
                  <Button size="sm" onClick={() => { const d = detail; setDetail(null); setRestore(d); }}>
                    <ShieldIcon className="h-4 w-4" aria-hidden="true" />
                    Restore
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => { const d = detail; setDetail(null); setReason(''); setTakedown(d); }}
                  >
                    <TrashIcon className="h-4 w-4" aria-hidden="true" />
                    Take down
                  </Button>
                ))}
            </>
          ) : null
        }
      >
        {detail && (
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-2xl border border-surface-border bg-ink-50">
              {detail.image ? (
                <img
                  src={detail.image}
                  alt=""
                  className={`aspect-[16/10] w-full object-cover ${detail.takedown?.isDown ? 'grayscale' : ''}`}
                />
              ) : (
                <NoImagePanel ratio="aspect-[16/10] w-full" />
              )}
              <span className="absolute left-3 top-3">
                {detail.takedown?.isDown ? (
                  <StatusChip label="Taken down" tone="danger" />
                ) : (
                  <StatusChip label={PRODUCT_STATUS_META[detail.status]?.label} tone={PRODUCT_STATUS_META[detail.status]?.tone} />
                )}
              </span>
            </div>

            {detail.takedown?.isDown && (
              <section className="rounded-xl border border-danger-200 bg-danger-50/70 p-4">
                <h3 className="flex items-center gap-2 text-[13px] font-semibold text-danger-700">
                  <TrashIcon className="h-4 w-4" aria-hidden="true" />
                  Taken down {formatDate(detail.takedown.at)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-800">{detail.takedown.reason}</p>
                {/* 🔴 STAFF-ONLY. §A9 keeps this out of everything the seller
                    sees; their own listing shows reason + date only. */}
                <p className="mt-2 text-xs text-muted">
                  By {detail.takedown.byName ?? 'a removed user'} · the exporter had it{' '}
                  {PRODUCT_STATUS_META[detail.status]?.label?.toLowerCase()}
                </p>
                <PurgeCountdown purgeAt={detail.purgeAt} />
              </section>
            )}

            {/* The exporter — where an investigation goes next. */}
            <section>
              <h3 className="mb-2 text-[12px] font-semibold text-ink-500">Exporter</h3>
              <div className="overflow-hidden rounded-xl border border-surface-border">
                <div className="flex items-center gap-3 p-3.5">
                  <CompanyAvatar name={detail.seller?.name ?? '?'} logo={detail.seller?.logo} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink-900">{detail.seller?.name ?? '—'}</p>
                    {detail.seller?.takedownCount > 0 ? (
                      <p className="mt-0.5 text-xs font-semibold text-danger">
                        {detail.seller.takedownCount} {detail.seller.takedownCount === 1 ? 'takedown' : 'takedowns'} on record
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted">No takedowns on record</p>
                    )}
                  </div>
                </div>
                {(detail.seller?.orgId || detail.seller?.slug) && (
                  <div className="flex divide-x divide-surface-border border-t border-surface-border">
                    {detail.seller?.orgId && (
                      <button
                        type="button"
                        onClick={() => navigate(cp(`/admin/organisations/${detail.seller.orgId}`))}
                        className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold text-primary-700 hover:bg-primary-50/60"
                      >
                        <BuildingIcon className="h-4 w-4" aria-hidden="true" />
                        Open exporter
                      </button>
                    )}
                    {detail.seller?.slug && (
                      <a
                        href={`/supplier/${detail.seller.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold text-ink-700 hover:bg-ink-50"
                      >
                        <ExternalIcon className="h-4 w-4" aria-hidden="true" />
                        Public profile
                      </a>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[12px] font-semibold text-ink-500">Listing</h3>
              <dl className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border text-sm">
                <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <dt className="text-muted">Category</dt>
                  <dd className="text-right font-medium text-ink-900">{detail.category?.name ?? '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <dt className="text-muted">Listed</dt>
                  <dd className="font-medium text-ink-900">{formatDate(detail.createdAt)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <dt className="text-muted">Public page</dt>
                  <dd>
                    {/* Active products are the only ones with a public page (SEO §6). */}
                    {detail.status === 'active' && !detail.takedown?.isDown && detail.slug ? (
                      <a
                        href={`/product/${detail.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline"
                      >
                        View listing
                        <ExternalIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="text-muted">Not public</span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        )}
      </Drawer>
    </AdminLayout>
  );
}
