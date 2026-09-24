import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { LEAD_STATUS, leadsApi, leadsKeys } from '../../api/support.js';
import { apiError, formatListTime } from '../../lib/format.js';
import { countryName } from '../../lib/countries.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { CompanyAvatar, initialsOf } from '../../components/chat/CompanyAvatar.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { FilterChip } from '../../components/ui/FilterChip.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { ToolbarSearch } from '../../components/ui/ToolbarSearch.jsx';
import { CheckCircleIcon, HandshakeIcon, SearchIcon, SparkleIcon, UserIcon } from '../../components/ui/icons.jsx';
import { cp } from '../../lib/consolePath.js';

/**
 * `/admin/leads` — buyers' "find me a supplier" requests (Step 1d,
 * `lead:manage`). Stat cards filter the list; a row opens the request, where
 * staff connect suppliers.
 */
const STATUS_OPTIONS = [
  { value: 'active', label: 'Open (new + finding)' },
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'Finding suppliers' },
  { value: 'routed', label: 'Suppliers connected' },
  { value: 'closed', label: 'Closed' },
  { value: '', label: 'Any' },
];

const VIEWS = {
  new: { status: 'new' },
  finding: { status: 'in_progress' },
  unassigned: { status: 'active', assignee: 'unassigned' },
  routed: { status: 'routed' },
};

export function Leads() {
  const navigate = useNavigate();
  // `?view=` (from the dashboard's counts) opens the page on that card's filter.
  const [params] = useSearchParams();
  const [status, setStatus] = useState(() => VIEWS[params.get('view')]?.status ?? 'active');
  const [assignee, setAssignee] = useState(() => VIEWS[params.get('view')]?.assignee ?? '');
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Supplier requests — MPX Global';
    return () => { document.title = previous; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setQ(draft.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [draft]);

  const overview = useQuery({ queryKey: leadsKeys.overview, queryFn: leadsApi.overview, refetchInterval: 60_000 });
  const c = overview.data?.counts;
  const staff = useQuery({ queryKey: leadsKeys.assignees, queryFn: leadsApi.assignees });
  const query = { ...(status ? { status } : {}), ...(assignee ? { assignee } : {}), ...(q ? { q } : {}), page, pageSize: 20 };
  const list = useQuery({ queryKey: leadsKeys.queue(query), queryFn: () => leadsApi.queue(query), placeholderData: (p) => p });
  const rows = list.data?.rows ?? [];
  const open = (l) => navigate(cp(`/admin/leads/${l.id}`));

  const cards = [
    { key: 'new', label: 'New', hint: 'Nobody has started yet', value: c?.new, Icon: SparkleIcon, tone: 'text-warning-800 bg-warning-50', go: { status: 'new', assignee: '' } },
    { key: 'finding', label: 'Finding suppliers', hint: 'Being worked on', value: c?.inProgress, Icon: SearchIcon, tone: 'text-primary-700 bg-primary-50', go: { status: 'in_progress', assignee: '' } },
    { key: 'unassigned', label: 'Unassigned', hint: 'Open, nobody holds it', value: c?.unassigned, Icon: UserIcon, tone: 'text-sky-700 bg-sky-50', go: { status: 'active', assignee: 'unassigned' } },
    { key: 'routed', label: 'Connected', hint: `${c?.routed7d ?? 0} in the last 7 days`, value: c?.routed, Icon: CheckCircleIcon, tone: 'text-success-700 bg-success-50', go: { status: 'routed', assignee: '' } },
  ];
  const activeCard = cards.find((k) => k.go.status === status && k.go.assignee === assignee)?.key;
  const applyCard = (k) => { setStatus(k.go.status); setAssignee(k.go.assignee); setPage(1); };

  return (
    <AdminLayout>
      <header className="mb-5">
        <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Supplier requests</h1>
        <p className="mt-1 hidden text-sm text-muted sm:block">
          Buyers asking MPX Global to find them a supplier. Connecting one opens a normal enquiry in the buyer&apos;s name.
        </p>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((k) => {
          const on = activeCard === k.key;
          return (
            <button
              key={k.key}
              type="button"
              onClick={() => applyCard(k)}
              aria-pressed={on}
              className={`flex items-center gap-3 rounded-2xl border bg-white p-3.5 text-left shadow-card transition-all sm:p-4 ${
                on ? 'border-primary-600 ring-1 ring-primary-600' : 'border-surface-border hover:-translate-y-px hover:border-primary-300 motion-reduce:transform-none'
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${k.tone}`} aria-hidden="true">
                <k.Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-2xl font-bold leading-none tabular-nums text-ink-900">{overview.isLoading ? '–' : k.value ?? 0}</span>
                <span className="mt-1 block text-[12.5px] font-semibold leading-tight text-ink-700 sm:truncate">{k.label}</span>
                <span className="hidden truncate text-[11.5px] text-muted sm:block">{k.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:max-w-md lg:flex-1">
          <ToolbarSearch id="lead-search" label="Search requests" value={draft} onChange={setDraft} onSubmit={() => setQ(draft.trim())} onClear={() => setDraft('')} placeholder="Request ref or product…" />
        </div>
        <div className="scrollbar-none -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
          <FilterChip label="Status" value={status} options={STATUS_OPTIONS} onChange={(v) => { setStatus(v); setPage(1); }} />
          <FilterChip
            label="Assignee"
            value={assignee}
            options={[
              { value: '', label: 'Anyone' },
              { value: 'me', label: 'Assigned to me' },
              { value: 'unassigned', label: 'Unassigned' },
              ...(staff.data ?? []).map((s) => ({ value: s.id, label: s.name })),
            ]}
            onChange={(v) => { setAssignee(v); setPage(1); }}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {list.isLoading && <SkeletonRows rows={6} />}
        {list.error && <ErrorState message={apiError(list.error).message} onRetry={list.refetch} />}
        {list.isSuccess && rows.length === 0 && (
          <EmptyState icon={HandshakeIcon} title="No requests here">
            {status === 'active' ? 'No open requests right now. Pick another card or set Status to "Any".' : 'Nothing matches these filters.'}
          </EmptyState>
        )}
        {rows.length > 0 && (
          <>
            {/* Wide screens: a table. */}
            <table className="hidden w-full table-fixed text-left lg:table">
              <thead>
                <tr className="border-b border-surface-border bg-ink-50/60 text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
                  <th scope="col" className="w-[38%] px-5 py-2.5">Request</th>
                  <th scope="col" className="w-[20%] px-3 py-2.5">Buyer</th>
                  <th scope="col" className="w-[15%] px-3 py-2.5">Assigned to</th>
                  <th scope="col" className="w-[16%] px-3 py-2.5">Status</th>
                  <th scope="col" className="w-[11%] px-5 py-2.5 text-right">Raised</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((l) => (
                  <tr key={l.id} onClick={() => open(l)} className="cursor-pointer transition-colors hover:bg-ink-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600" aria-hidden="true">
                          <HandshakeIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); open(l); }}
                            className="block max-w-full truncate text-left text-[14px] font-semibold text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/30"
                          >
                            {l.what}
                          </button>
                          <p className="mt-0.5 truncate text-xs text-muted"><span className="font-mono">{l.ref}</span>{specs(l)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <CompanyAvatar name={l.buyer.org} size="xs" />
                        <span className="truncate text-[13px] font-semibold text-ink-900">{l.buyer.org}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5"><Assignee a={l.assignedTo} /></td>
                    <td className="px-3 py-3.5">
                      <LeadStatus l={l} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-[12px] text-muted">{formatListTime(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Below lg: cards. */}
            <ul className="divide-y divide-surface-border lg:hidden">
              {rows.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => open(l)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ink-50">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600" aria-hidden="true">
                      <HandshakeIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink-900">{l.what}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted"><span className="font-mono">{l.ref}</span> · {l.buyer.org}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Assignee a={l.assignedTo} compact />
                        {l.routedTo.length > 0 && l.status !== 'routed' && (
                          <span className="text-[11.5px] font-semibold text-success-700">{l.routedTo.length} connected</span>
                        )}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <LeadStatusChip status={l.status} />
                      <span className="text-[11.5px] text-muted">{formatListTime(l.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={20} total={list.data.total} onPage={setPage} />
          </>
        )}
      </div>
    </AdminLayout>
  );
}

/** " · 20,000 kg · to UAE" — the request's quantity and destination, when given. */
function specs(l) {
  return `${l.quantity ? ` · ${l.quantity.toLocaleString()} ${l.unit ?? ''}`.trimEnd() : ''}${
    l.destinationCountry ? ` · to ${countryName(l.destinationCountry) ?? l.destinationCountry}` : ''
  }`;
}

export function LeadStatusChip({ status }) {
  const st = LEAD_STATUS[status] ?? LEAD_STATUS.new;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${st.cls}`}>{st.label}</span>;
}

function LeadStatus({ l }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <LeadStatusChip status={l.status} />
      {/* "Suppliers connected" already says it; the count matters on the other states. */}
      {l.routedTo.length > 0 && l.status !== 'routed' && (
        <span className="text-[11.5px] font-medium text-success-700">
          {l.routedTo.length} supplier{l.routedTo.length === 1 ? '' : 's'} connected
        </span>
      )}
    </div>
  );
}

function Assignee({ a, compact = false }) {
  if (!a) {
    return (
      <span className="inline-flex items-center rounded-full bg-warning-50 px-2 py-0.5 text-[11.5px] font-semibold text-warning-800 ring-1 ring-inset ring-warning-200">
        Unassigned
      </span>
    );
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-full bg-ink-900 font-bold text-white ${compact ? 'h-5 w-5 text-[9px]' : 'h-7 w-7 text-[10.5px]'}`}
      >
        {initialsOf(a.name)}
      </span>
      <span className={`truncate font-medium text-ink-800 ${compact ? 'text-[11.5px]' : 'text-[13px]'}`}>{a.name}</span>
    </span>
  );
}
