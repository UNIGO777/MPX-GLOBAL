import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from '../../api/admin.js';
import { config } from '../../config.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { apiError, KYC_STATUS_META } from '../../lib/format.js';
import { countryName } from '../../lib/countries.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FilterChip } from '../../components/ui/FilterChip.jsx';
import { ToolbarSearch } from '../../components/ui/ToolbarSearch.jsx';
import { CompanyAvatar } from '../../components/chat/CompanyAvatar.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { RowMenu } from '../../components/ui/RowMenu.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { BoxIcon, BuildingIcon, ChatIcon, FileIcon } from '../../components/ui/icons.jsx';
import { cp } from '../../lib/consolePath.js';

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
  { value: '', label: 'Any' },
  { value: 'buyer', label: 'Buyer side' },
  { value: 'exporter', label: 'Exporter side' },
  { value: 'both', label: 'Both sides' },
];

const VERIFICATION_OPTIONS = [
  { value: '', label: 'Any' },
  ...Object.entries(KYC_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
];

const STATE_OPTIONS = [
  { value: '', label: 'Any' },
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
    <span className="inline-flex shrink-0 items-center rounded-full bg-ink-100 px-2 py-px text-[11px] font-medium text-ink-600">
      {label}
    </span>
  );
}

/**
 * The company's second line (2026-09-24): which sides it trades on, where it
 * is, and its slug. The side used to sit under the VERIFICATION chip — it
 * describes the company, not its verification, and stacking it there made
 * every row ~85px tall. The slug stays: names collide, the slug never does.
 */
function CompanyMeta({ org }) {
  const where = [countryName(org.country) ?? org.country, org.slug].filter(Boolean).join(' · ');
  return (
    <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
      <SidesBadge sides={org.sides} />
      <span className="truncate text-xs text-muted">{where || '—'}</span>
    </div>
  );
}

/**
 * Products and takedowns as ONE compact cell (2026-09-24) — two full columns
 * of mostly "0" were the widest thing in the table. A takedown only speaks up
 * when there is one.
 */
function Activity({ products, takedowns }) {
  return (
    <div className="text-[13px] leading-snug">
      <span className={products ? 'font-semibold text-ink-900' : 'text-ink-400'}>
        {products || 0} {products === 1 ? 'product' : 'products'}
      </span>
      {takedowns > 0 && (
        <span className="block text-xs font-semibold text-danger-700">
          {takedowns} {takedowns === 1 ? 'takedown' : 'takedowns'}
        </span>
      )}
    </div>
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
      { label: 'Open company', Icon: BuildingIcon, to: cp(`/admin/organisations/${org.id}`) },
      { label: 'View products', Icon: BoxIcon, to: cp(`/admin/products?seller=${org.id}`) },
      { label: 'View conversations', Icon: ChatIcon, to: cp(`/admin/conversations?orgId=${org.id}`) },
    ];
    if (can(me, 'kyc:view')) {
      items.push({ label: 'KYC documents', Icon: FileIcon, to: cp(`/admin/verification/${org.id}/kyc`) });
    }
    return items;
  };

  const clearAll = () => setParams(new URLSearchParams(), { replace: true });

  // Clicking anywhere on a row/card opens the company — unless the click was on
  // something interactive inside it (the name link, the ⋮ menu).
  const navigate = useNavigate();
  const openRow = (e, org) => {
    if (e.target.closest('a, button, [role="menu"], [role="menuitem"]')) return;
    navigate(cp(`/admin/organisations/${org.id}`));
  };

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

      {/* Toolbar (2026-09-24): a bordered white search and FILTER CHIPS. The
          three full-width dropdowns read as form fields, showed nothing about
          which filters were on, and wrapped unevenly on phones (one left alone
          on its own row, "Any verification" cut off). Chips scroll sideways on
          small screens; an active one turns brand-tinted and names its value. */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:max-w-md lg:flex-1">
          <ToolbarSearch
            id="org-search"
            label="Search companies"
            value={draft}
            onChange={setDraft}
            onSubmit={() => setFilter({ q: draft.trim() })}
            onClear={() => {
              setDraft('');
              setFilter({ q: '' });
            }}
            placeholder="Company name starts with…"
          />
        </div>
        <div className="scrollbar-none -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
          <FilterChip label="Side" value={side} options={SIDE_OPTIONS} onChange={(v) => setFilter({ side: v })} />
          <FilterChip
            label="Verification"
            value={verification}
            options={VERIFICATION_OPTIONS}
            onChange={(v) => setFilter({ verification: v })}
          />
          <FilterChip label="State" value={blocked} options={STATE_OPTIONS} onChange={(v) => setFilter({ blocked: v })} />
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setDraft('');
                clearAll();
              }}
              className="ml-1 shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 text-[13px] font-semibold text-primary-700 hover:bg-primary-50"
            >
              Clear filters
            </button>
          )}
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
            {/* Cards below lg — phones AND tablets (2026-09-24). The table used
                to start at md, and between md and lg its fixed columns crushed
                the company name to "D..". */}
            <ul className="divide-y divide-surface-border lg:hidden">
              {rows.map((org) => (
                <li
                  key={org.id}
                  onClick={(e) => openRow(e, org)}
                  className={`cursor-pointer p-4 transition-colors ${
                    org.blocked ? 'bg-danger-50/40 hover:bg-danger-50/70' : 'hover:bg-ink-50/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <CompanyAvatar name={org.name} logo={org.logo} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={cp(`/admin/organisations/${org.id}`)}
                        className="block truncate font-semibold text-ink-900 hover:text-primary-700 hover:underline"
                      >
                        {org.name}
                      </Link>
                      <CompanyMeta org={org} />
                    </div>
                    <RowMenu label={`Actions for ${org.name}`} items={rowActions(org)} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-12">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip status={org.verification} />
                      <StateChip blocked={org.blocked} />
                    </div>
                    <Activity products={org.products} takedowns={org.takedowns} />
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-sm">
                {/* ~27rem of fixed columns (was ~37rem): the company column keeps
                    ~240px even at a 1024px window with the sidebar open. */}
                <colgroup>
                  <col />
                  <col className="w-[9.5rem]" />
                  <col className="w-[8rem]" />
                  <col className="w-[6.5rem]" />
                  <col className="w-[3.5rem]" />
                </colgroup>
                <thead className="border-b border-surface-border bg-ink-50/60 text-[11px] uppercase tracking-wider text-ink-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Company</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Verification</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Activity</th>
                    <th scope="col" className="px-4 py-3 font-semibold">State</th>
                    <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {rows.map((org) => (
                    <tr
                      key={org.id}
                      // The whole row opens the company (2026-09-24); the name
                      // stays a real link for keyboard and screen-reader users.
                      onClick={(e) => openRow(e, org)}
                      className={`cursor-pointer transition-colors ${org.blocked ? 'bg-danger-50/40 hover:bg-danger-50/70' : 'hover:bg-ink-50/70'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <CompanyAvatar name={org.name} logo={org.logo} size="sm" />
                          <div className="min-w-0">
                            <Link
                              to={cp(`/admin/organisations/${org.id}`)}
                              className="block truncate font-semibold text-ink-900 hover:text-primary-700 hover:underline"
                            >
                              {org.name}
                            </Link>
                            <CompanyMeta org={org} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={org.verification} />
                      </td>
                      <td className="px-4 py-3">
                        <Activity products={org.products} takedowns={org.takedowns} />
                      </td>
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
