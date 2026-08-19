import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from '../../api/admin.js';
import { config } from '../../config.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { apiError, KYC_STATUS_META } from '../../lib/format.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Combobox } from '../../components/ui/Combobox.jsx';
import { CompanyAvatar } from '../../components/chat/CompanyAvatar.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { RowMenu } from '../../components/ui/RowMenu.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { BoxIcon, BuildingIcon, ChatIcon, FileIcon, SearchIcon, XIcon } from '../../components/ui/icons.jsx';

/**
 * M5 screen 14 — the Organisation list.
 *
 * 🔴 FIVE COLUMNS, deliberately (m5.md §7): company · verification · products ·
 * takedowns · state. A wider table breaks on responsive, so country and the
 * sides badge were assigned to the DETAIL screen instead. The one addition the
 * spec asks for is a second line under the company name — company names collide,
 * and two "Global Exports" rows are otherwise indistinguishable — so the slug
 * and country ride there rather than in columns of their own.
 *
 * Sorted by takedown count, server-side. That is not a default anyone picked for
 * neatness: A10 means a taken-down product frees a slot in the seller's active
 * cap, so blocking a product is not itself a deterrent, and this ordering is
 * what surfaces a repeat offender at all.
 *
 * Gate: `organisation:read` — grantable, and a pure read. It never returns KYC
 * documents (those need `kyc:view` and write their own audit row).
 *
 * Rows open the Organisation detail (M5 #15). The row menu keeps the
 * cross-links §3 calls for — the exporter's products, the company's
 * conversations, its KYC documents — because those are the paths an
 * investigation actually follows, and making someone route through the detail
 * screen to reach them is a step for nothing.
 */
const PAGE_SIZE_DEFAULT = 20;

const SIDE_OPTIONS = [
  { value: '', label: 'Any side' },
  { value: 'buyer', label: 'Buyer side' },
  { value: 'exporter', label: 'Exporter side' },
  { value: 'both', label: 'Both sides' },
];

const VERIFICATION_OPTIONS = [
  { value: '', label: 'Any verification' },
  ...Object.entries(KYC_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
];

const STATE_OPTIONS = [
  { value: '', label: 'Any state' },
  { value: 'false', label: 'Active' },
  { value: 'true', label: 'Blocked' },
];

/** The sides a company trades on — a badge, never a column (§7). */
function SidesBadge({ sides }) {
  const label = sides?.buyer && sides?.exporter
    ? 'Buyer + Exporter'
    : sides?.exporter
      ? 'Exporter'
      : sides?.buyer
        ? 'Buyer'
        : 'No side';
  return (
    <span className="inline-flex items-center rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">
      {label}
    </span>
  );
}

function StateChip({ blocked }) {
  return blocked ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-danger-50 px-2.5 py-1 text-[12px] font-semibold text-danger-700">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-danger-500" />
      Blocked
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success-50 px-2.5 py-1 text-[12px] font-semibold text-success-700">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success-500" />
      Active
    </span>
  );
}

/** A count that is zero is muted — only the ones with something to look at read as numbers. */
function Count({ value, tone = 'ink' }) {
  if (!value) return <span className="text-ink-400">0</span>;
  return (
    <span className={tone === 'danger' ? 'font-semibold text-danger-700' : 'font-semibold text-ink-900'}>
      {value}
    </span>
  );
}

export function Organisations() {
  const { user: me } = useAuth();
  // Filters live in the URL: a moderator's "blocked exporters" view is worth
  // linking to, and the dashboard (§5) is specified to link into exactly these
  // lists already filtered.
  const [params, setParams] = useSearchParams();

  const side = params.get('side') ?? '';
  const verification = params.get('verification') ?? '';
  const blocked = params.get('blocked') ?? '';
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [draft, setDraft] = useState(q);

  // Keep the box in step when navigation changes `q` (back/forward, a cleared
  // filter), without an effect that would paint the stale term for one frame.
  const [lastQ, setLastQ] = useState(q);
  if (lastQ !== q) {
    setLastQ(q);
    setDraft(q);
  }

  const setFilter = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any filter change restarts paging — page 3 of the old result set is
    // meaningless against the new one.
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  const query = {
    ...(side ? { side } : {}),
    ...(verification ? { verification } : {}),
    ...(blocked ? { blocked } : {}),
    ...(q ? { q } : {}),
    page,
    pageSize,
  };

  const list = useQuery({
    queryKey: ['admin', 'orgs', query],
    queryFn: () => adminApi.listOrgs(query),
    placeholderData: (prev) => prev,
  });

  const rows = list.data?.organisations ?? list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const error = list.error ? apiError(list.error) : null;
  const hasFilters = Boolean(side || verification || blocked || q);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Organisations — MPX Global';
    return () => { document.title = previous; };
  }, []);

  /**
   * What a row can actually reach TODAY. The Organisation detail screen (M5 #15)
   * does not exist, so nothing here pretends to open it — every entry below
   * lands on a real, built screen.
   */
  const rowActions = (org) => {
    const items = [
      { label: 'Open company', Icon: BuildingIcon, to: `/admin/organisations/${org.id}` },
      { label: 'View products', Icon: BoxIcon, to: `/admin/products?seller=${org.id}` },
      { label: 'View conversations', Icon: ChatIcon, to: `/admin/conversations?orgId=${org.id}` },
    ];
    if (can(me, 'kyc:view')) {
      items.push({ label: 'KYC documents', Icon: FileIcon, to: `/admin/verification/${org.id}/kyc` });
    }
    return items;
  };

  const clearAll = () => setParams(new URLSearchParams(), { replace: true });

  return (
    <AdminLayout>
      <header className="mb-4 sm:mb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Organisations</h1>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
            {total.toLocaleString(config.locale.numbers)} companies
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Every company on the platform, most taken-down first.
        </p>
      </header>

      {error && (
        <div className="mb-4 max-w-3xl">
          <Alert tone="danger">{error.message}</Alert>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFilter({ q: draft.trim() });
          }}
          className="relative min-w-[12rem] flex-1 basis-64"
        >
          <label htmlFor="org-search" className="sr-only">Search companies</label>
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            aria-hidden="true"
          />
          <input
            id="org-search"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Starts with — company name"
            className="h-11 w-full rounded-lg border border-surface-border bg-white pl-9 pr-9 text-sm text-ink-900 placeholder:text-ink-500 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
          />
          {q && (
            <button
              type="button"
              onClick={() => setFilter({ q: '' })}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="w-[8.5rem] shrink-0 sm:w-[11rem]">
          <label htmlFor="org-side" className="sr-only">Filter by side</label>
          <Combobox
            id="org-side"
            value={side}
            placeholder="Any side"
            options={SIDE_OPTIONS}
            onChange={(v) => setFilter({ side: v })}
          />
        </div>

        <div className="w-[9.5rem] shrink-0 sm:w-[12rem]">
          <label htmlFor="org-verification" className="sr-only">Filter by verification</label>
          <Combobox
            id="org-verification"
            value={verification}
            placeholder="Any verification"
            options={VERIFICATION_OPTIONS}
            onChange={(v) => setFilter({ verification: v })}
          />
        </div>

        <div className="w-[8rem] shrink-0 sm:w-[10rem]">
          <label htmlFor="org-state" className="sr-only">Filter by state</label>
          <Combobox
            id="org-state"
            value={blocked}
            placeholder="Any state"
            options={STATE_OPTIONS}
            onChange={(v) => setFilter({ blocked: v })}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {list.isLoading ? (
          <SkeletonRows rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={BuildingIcon}
            title={hasFilters ? 'No companies match' : 'No companies yet'}
            action={hasFilters ? <Button variant="secondary" size="sm" onClick={clearAll}>Clear filters</Button> : null}
          >
            {hasFilters
              ? 'Nothing matches those filters. Search matches from the start of a company name.'
              : 'Companies appear here as soon as buyers and exporters sign up.'}
          </EmptyState>
        ) : (
          <>
            {/* Phones get cards — five columns cannot survive 390px, which is the
                same reason the spec caps the table at five in the first place. */}
            <ul className="divide-y divide-surface-border md:hidden">
              {rows.map((org) => (
                <li key={org.id} className={org.blocked ? 'bg-danger-50/40 p-4' : 'p-4'}>
                  <div className="flex items-start gap-3">
                    <CompanyAvatar name={org.name} logo={org.logo} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/admin/organisations/${org.id}`}
                        className="block truncate font-semibold text-ink-900 hover:text-primary-700 hover:underline"
                      >
                        {org.name}
                      </Link>
                      <p className="truncate text-xs text-muted">
                        {[org.country, org.slug].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <RowMenu label={`Actions for ${org.name}`} items={rowActions(org)} />
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <StatusChip status={org.verification} />
                    <SidesBadge sides={org.sides} />
                    <StateChip blocked={org.blocked} />
                  </div>

                  <div className="mt-2 flex gap-4 text-xs text-muted">
                    <span>Products <Count value={org.products} /></span>
                    <span>Takedowns <Count value={org.takedowns} tone="danger" /></span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col />
                  <col className="w-[10rem]" />
                  <col className="w-[7rem]" />
                  <col className="w-[7.5rem]" />
                  <col className="w-[8rem]" />
                  <col className="w-[4rem]" />
                </colgroup>
                <thead className="border-b border-surface-border bg-ink-50/60 text-[11px] uppercase tracking-wider text-ink-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Company</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Verification</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Products</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Takedowns</th>
                    <th scope="col" className="px-4 py-3 font-semibold">State</th>
                    <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {rows.map((org) => (
                    <tr key={org.id} className={`transition-colors ${org.blocked ? 'bg-danger-50/40 hover:bg-danger-50/70' : 'hover:bg-primary-50/50'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <CompanyAvatar name={org.name} logo={org.logo} size="sm" />
                          <div className="min-w-0">
                            <Link
                              to={`/admin/organisations/${org.id}`}
                              className="block truncate font-semibold text-ink-900 hover:text-primary-700 hover:underline"
                            >
                              {org.name}
                            </Link>
                            {/* The second line the spec asks for: names collide. */}
                            <p className="truncate text-xs text-muted">
                              {[org.country, org.slug].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <StatusChip status={org.verification} />
                          <SidesBadge sides={org.sides} />
                        </div>
                      </td>
                      <td className="px-4 py-3"><Count value={org.products} /></td>
                      <td className="px-4 py-3"><Count value={org.takedowns} tone="danger" /></td>
                      <td className="px-4 py-3"><StateChip blocked={org.blocked} /></td>
                      <td className="px-4 py-3 text-right">
                        <RowMenu label={`Actions for ${org.name}`} items={rowActions(org)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPage={(p) => setFilter({ page: p > 1 ? String(p) : '' })}
              onPageSize={(size) => { setPageSize(size); setFilter({ page: '' }); }}
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
