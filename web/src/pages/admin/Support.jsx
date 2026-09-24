import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { supportApi, supportKeys } from '../../api/support.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { actionLabel } from '../../lib/auditFormat.js';
import { apiError, formatDate, formatListTime, formatTime } from '../../lib/format.js';
import { CATEGORY_LABEL, TICKET_CATEGORIES, autoCloseDate } from '../../lib/support.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { CompanyAvatar, initialsOf } from '../../components/chat/CompanyAvatar.jsx';
import { TicketStatusChip } from '../../components/support/TicketStatusChip.jsx';
import { TopicIcon } from '../../components/support/TopicIcon.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { FilterChip } from '../../components/ui/FilterChip.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { ToolbarSearch } from '../../components/ui/ToolbarSearch.jsx';
import {
  ChatIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  HelpIcon,
  LinkIcon,
  ListIcon,
  PlusIcon,
  RefreshIcon,
  UserIcon,
} from '../../components/ui/icons.jsx';
import { cp } from '../../lib/consolePath.js';

/**
 * `/admin/support` — the support desk (Step 1b, `support:manage`).
 *
 * Four stat cards (each one filters the queue) above two tabs:
 *  - Queue: every ticket, filterable; a row opens the ticket.
 *  - Ticket log: "who did what" across tickets, from the append-only audit
 *    trail, grouped by day. A superadmin sees the whole team; anyone else sees
 *    ONLY their own actions — the server forces that, whatever the filter asks.
 */
const STATUS_OPTIONS = [
  { value: 'active', label: 'Not resolved' },
  { value: 'needs_reply', label: 'Needs a reply' },
  { value: 'waiting', label: 'Waiting on company' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: '', label: 'Any' },
];
const SIDE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'buyer', label: 'Buyers' },
  { value: 'exporter', label: 'Exporters' },
];
const LOG_ACTIONS = [
  { value: '', label: 'Any' },
  { value: 'ticket.create', label: 'Raised' },
  { value: 'ticket.reply', label: 'Replied' },
  { value: 'ticket.assign', label: 'Assigned' },
  { value: 'ticket.status', label: 'Status changed' },
  { value: 'ticket.reopen', label: 'Re-opened (older tickets)' },
];

const VIEWS = {
  needs_reply: { status: 'needs_reply' },
  unassigned: { status: 'active', assignee: 'unassigned' },
  waiting: { status: 'waiting' },
  resolved: { status: 'resolved' },
};

export function Support() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'log' ? 'log' : 'queue';
  // Queue filters live here so a stat card can set them. `?view=` (from the
  // dashboard's counts) opens the page on that card's filter.
  const [status, setStatus] = useState(() => VIEWS[params.get('view')]?.status ?? 'active');
  const [assignee, setAssignee] = useState(() => VIEWS[params.get('view')]?.assignee ?? '');

  useEffect(() => {
    const previous = document.title;
    document.title = 'Support — MPX Global';
    return () => { document.title = previous; };
  }, []);

  const overview = useQuery({ queryKey: supportKeys.overview, queryFn: supportApi.overview, refetchInterval: 60_000 });
  const c = overview.data?.counts;

  const openQueue = (next) => {
    setStatus(next.status);
    setAssignee(next.assignee ?? '');
    setParams({}, { replace: true });
  };
  const cards = [
    { key: 'needs_reply', label: 'Needs a reply', hint: 'The company wrote last', value: c?.needsReply, Icon: ChatIcon, tone: 'text-primary-700 bg-primary-50', go: { status: 'needs_reply' } },
    { key: 'unassigned', label: 'Unassigned', hint: 'Nobody has picked it up', value: c?.unassigned, Icon: UserIcon, tone: 'text-warning-800 bg-warning-50', go: { status: 'active', assignee: 'unassigned' } },
    { key: 'waiting', label: 'Waiting on company', hint: 'Closes itself after 14 days', value: c?.waiting, Icon: ClockIcon, tone: 'text-sky-700 bg-sky-50', go: { status: 'waiting' } },
    { key: 'resolved', label: 'Resolved', hint: 'In the last 7 days', value: c?.resolved7d, Icon: CheckCircleIcon, tone: 'text-success-700 bg-success-50', go: { status: 'resolved' } },
  ];
  const activeCard = tab === 'queue'
    ? cards.find((k) => k.go.status === status && (k.go.assignee ?? '') === assignee)?.key
    : null;

  return (
    <AdminLayout>
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Support</h1>
          <p className="mt-1 hidden text-sm text-muted sm:block">
            Tickets from buyers and exporters. Replies go out as MPX Global Support.
          </p>
        </div>
        <div role="tablist" aria-label="Support" className="inline-flex self-start rounded-full border border-ink-200 bg-white p-1 shadow-sm sm:self-auto">
          {[
            { key: 'queue', label: 'Queue', Icon: HelpIcon },
            { key: 'log', label: 'Ticket log', Icon: ListIcon },
          ].map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setParams(t.key === 'log' ? { tab: 'log' } : {}, { replace: true })}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors ${
                  on ? 'bg-primary-600 text-white' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                }`}
              >
                <t.Icon className="h-4 w-4" aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((k) => {
          const on = activeCard === k.key;
          return (
            <button
              key={k.key}
              type="button"
              onClick={() => openQueue(k.go)}
              aria-pressed={on}
              className={`group flex items-center gap-3 rounded-2xl border bg-white p-3.5 text-left shadow-card transition-all sm:p-4 ${
                on ? 'border-primary-600 ring-1 ring-primary-600' : 'border-surface-border hover:-translate-y-px hover:border-primary-300 motion-reduce:transform-none'
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${k.tone}`} aria-hidden="true">
                <k.Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-2xl font-bold leading-none tabular-nums text-ink-900">
                  {overview.isLoading ? '–' : k.value ?? 0}
                </span>
                <span className="mt-1 block text-[12.5px] font-semibold leading-tight text-ink-700 sm:truncate">{k.label}</span>
                <span className="hidden truncate text-[11.5px] text-muted sm:block">{k.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {tab === 'queue' ? (
        <Queue status={status} setStatus={setStatus} assignee={assignee} setAssignee={setAssignee} />
      ) : (
        <TicketLog />
      )}
    </AdminLayout>
  );
}

function Queue({ status, setStatus, assignee, setAssignee }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [side, setSide] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const t = setTimeout(() => { setQ(draft.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [draft]);

  const staff = useQuery({ queryKey: supportKeys.assignees, queryFn: supportApi.assignees });
  const query = {
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(side ? { side } : {}),
    ...(assignee ? { assignee } : {}),
    ...(q ? { q } : {}),
    page,
    pageSize,
  };
  const list = useQuery({ queryKey: supportKeys.queue(query), queryFn: () => supportApi.queue(query), placeholderData: (p) => p });
  const rows = list.data?.rows ?? [];
  const reset = (fn) => (v) => { fn(v); setPage(1); };
  const open = (t) => navigate(cp(`/admin/support/${t.id}`));

  const assigneeOptions = [
    { value: '', label: 'Anyone' },
    { value: 'me', label: 'Assigned to me' },
    { value: 'unassigned', label: 'Unassigned' },
    ...(staff.data ?? []).map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:max-w-md lg:flex-1">
          <ToolbarSearch id="ticket-search" label="Search tickets" value={draft} onChange={setDraft} onSubmit={() => setQ(draft.trim())} onClear={() => setDraft('')} placeholder="Ticket ref or subject…" />
        </div>
        <div className="scrollbar-none -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
          <FilterChip label="Status" value={status} options={STATUS_OPTIONS} onChange={reset(setStatus)} />
          <FilterChip label="Assignee" value={assignee} options={assigneeOptions} onChange={reset(setAssignee)} />
          <FilterChip label="Topic" value={category} options={[{ value: '', label: 'Any' }, ...TICKET_CATEGORIES]} onChange={reset(setCategory)} />
          <FilterChip label="From" value={side} options={SIDE_OPTIONS} onChange={reset(setSide)} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {list.isLoading && <SkeletonRows rows={6} />}
        {list.error && <ErrorState message={apiError(list.error).message} onRetry={list.refetch} />}
        {list.isSuccess && rows.length === 0 && (
          <EmptyState icon={HelpIcon} title="No tickets here">Nothing matches these filters.</EmptyState>
        )}
        {rows.length > 0 && (
          <>
            {/* Wide screens: a table. */}
            <table className="hidden w-full table-fixed text-left lg:table">
              <thead>
                <tr className="border-b border-surface-border bg-ink-50/60 text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
                  <th scope="col" className="w-[40%] px-5 py-2.5">Ticket</th>
                  <th scope="col" className="w-[22%] px-3 py-2.5">Company</th>
                  <th scope="col" className="w-[16%] px-3 py-2.5">Assigned to</th>
                  <th scope="col" className="w-[12%] px-3 py-2.5">Status</th>
                  <th scope="col" className="w-[10%] px-5 py-2.5 text-right">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => open(t)}
                    className={`cursor-pointer transition-colors hover:bg-ink-50 ${t.unread ? 'bg-primary-50/30' : ''}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-start gap-3">
                        <TopicIcon category={t.category} />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); open(t); }}
                            className="flex max-w-full items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/30"
                          >
                            {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary-600" aria-label="New from the company" />}
                            <span className={`truncate text-[14px] ${t.unread ? 'font-bold' : 'font-semibold'} text-ink-900`}>{t.subject}</span>
                          </button>
                          <p className="mt-0.5 truncate text-xs text-muted">
                            <span className="font-mono">{t.ref}</span> · {CATEGORY_LABEL[t.category] ?? t.category}
                          </p>
                          <RowTags t={t} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <CompanyAvatar name={t.org.name} size="xs" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-ink-900">{t.org.name}</p>
                          <p className="text-[11.5px] capitalize text-muted">{t.side}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5"><Assignee a={t.assignedTo} /></td>
                    <td className="px-3 py-3.5"><TicketStatusChip status={t.status} size="sm" /></td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-[12px] text-muted">{formatListTime(t.lastMessageAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Below lg: cards. */}
            <ul className="divide-y divide-surface-border lg:hidden">
              {rows.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => open(t)}
                    className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ink-50 ${t.unread ? 'bg-primary-50/30' : ''}`}
                  >
                    <TopicIcon category={t.category} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary-600" aria-label="New from the company" />}
                        <span className={`truncate text-[14px] ${t.unread ? 'font-bold' : 'font-semibold'} text-ink-900`}>{t.subject}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        <span className="font-mono">{t.ref}</span> · {t.org.name} ({t.side})
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Assignee a={t.assignedTo} compact />
                        <RowTags t={t} inline />
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <TicketStatusChip status={t.status} size="sm" />
                      <span className="text-[11.5px] text-muted">{formatListTime(t.lastMessageAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={pageSize} total={list.data.total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
          </>
        )}
      </div>
    </>
  );
}

/** Small row tags: a follow-up link, and the auto-close date while waiting on the company. */
function RowTags({ t, inline = false }) {
  const closes = t.status !== 'resolved' ? autoCloseDate(t.awaitingCompanySince) : null;
  if (!t.followUpOf && !closes) return null;
  const tags = (
    <>
      {t.followUpOf && (
        <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700">
          <LinkIcon className="h-3 w-3" aria-hidden="true" />
          Follow-up of {t.followUpOf.ref}
        </span>
      )}
      {closes && (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
          <ClockIcon className="h-3 w-3" aria-hidden="true" />
          Waiting · closes {formatDate(closes)}
        </span>
      )}
    </>
  );
  return inline ? tags : <div className="mt-1.5 flex flex-wrap gap-1.5">{tags}</div>;
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

/** "Today" / "Yesterday" / a date — the log's day headings. */
function dayLabel(at) {
  const d = new Date(at);
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return formatDate(at);
}

/** The icon badge per log row — what kind of action, at a glance. */
export function logIcon(r) {
  if (r.actor?.role === 'system') return { Icon: ClockIcon, tone: 'bg-ink-100 text-ink-600' };
  switch (r.action) {
    case 'ticket.create':
      return { Icon: PlusIcon, tone: 'bg-sky-50 text-sky-700' };
    case 'ticket.reply':
      return r.by === 'company' ? { Icon: ChatIcon, tone: 'bg-ink-100 text-ink-700' } : { Icon: ChatIcon, tone: 'bg-primary-50 text-primary-700' };
    case 'ticket.assign':
      return { Icon: UserIcon, tone: 'bg-amber-50 text-amber-700' };
    case 'ticket.status':
      return r.to === 'resolved' ? { Icon: CheckCircleIcon, tone: 'bg-success-50 text-success-700' } : { Icon: RefreshIcon, tone: 'bg-violet-50 text-violet-700' };
    case 'ticket.reopen':
      return { Icon: RefreshIcon, tone: 'bg-warning-50 text-warning-800' };
    default:
      return { Icon: ListIcon, tone: 'bg-ink-100 text-ink-600' };
  }
}

function TicketLog() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';
  const navigate = useNavigate();
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const staff = useQuery({ queryKey: supportKeys.assignees, queryFn: supportApi.assignees, enabled: isSuperadmin });
  const query = { ...(actorId ? { actorId } : {}), ...(action ? { action } : {}), page, pageSize: 50 };
  const log = useQuery({ queryKey: supportKeys.log(query), queryFn: () => supportApi.log(query), placeholderData: (p) => p });
  const rows = log.data?.rows ?? [];

  // Group consecutive rows by day (the server already sorts newest first).
  const groups = [];
  for (const r of rows) {
    const label = dayLabel(r.at);
    if (groups.at(-1)?.label !== label) groups.push({ label, rows: [] });
    groups.at(-1).rows.push(r);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {isSuperadmin ? (
          <FilterChip
            label="Who"
            value={actorId}
            options={[{ value: '', label: 'Everyone' }, ...(staff.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
            onChange={(v) => { setActorId(v); setPage(1); }}
          />
        ) : (
          <span className="rounded-full bg-ink-100 px-3 py-2 text-[12.5px] font-semibold text-ink-700">Showing your own actions</span>
        )}
        <FilterChip label="Action" value={action} options={LOG_ACTIONS} onChange={(v) => { setAction(v); setPage(1); }} />
        {log.isSuccess && (
          <span className="ml-auto text-[12.5px] text-muted">
            {log.data.total.toLocaleString()} {log.data.total === 1 ? 'action' : 'actions'}
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {log.isLoading && <SkeletonRows rows={6} />}
        {log.error && <ErrorState message={apiError(log.error).message} onRetry={log.refetch} />}
        {log.isSuccess && rows.length === 0 && <EmptyState icon={ListIcon} title="Nothing recorded yet">Ticket actions appear here as they happen.</EmptyState>}
        {groups.map((g) => (
          <section key={g.label} aria-label={g.label}>
            <h2 className="border-b border-surface-border bg-ink-50/70 px-4 py-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-500 sm:px-5">
              {g.label}
            </h2>
            <ul className="divide-y divide-surface-border">
              {g.rows.map((r) => {
                const { Icon, tone } = logIcon(r);
                return (
                  <li key={r.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`} aria-hidden="true">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] leading-snug text-ink-800">
                        <span className="font-semibold text-ink-900">{r.actor.name}</span> <LogPhrase row={r} />
                      </p>
                      {r.ticket && (
                        <button
                          type="button"
                          onClick={() => navigate(cp(`/admin/support/${r.ticket.id}`))}
                          className="group mt-1 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-surface-border bg-white px-2 py-1 text-left text-[12px] transition-colors hover:border-primary-300"
                        >
                          <span className="shrink-0 font-mono font-semibold text-primary-700">{r.ticket.ref}</span>
                          <span className="truncate text-ink-700">{r.ticket.subject}</span>
                          <span className="hidden shrink-0 text-muted sm:inline">· {r.ticket.org}</span>
                          <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-ink-300 group-hover:text-primary-600" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <span className="shrink-0 whitespace-nowrap pt-0.5 text-[12px] tabular-nums text-muted">{formatTime(r.at)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {log.isSuccess && log.data.total > 50 && <Pagination page={page} pageSize={50} total={log.data.total} onPage={setPage} />}
      </div>
    </>
  );
}

/** "resolved", "assigned it to Ravi", "replied (as the company)"… */
export function LogPhrase({ row }) {
  switch (row.action) {
    case 'ticket.create':
      return <>raised the ticket</>;
    case 'ticket.reply':
      return <>{row.by === 'company' ? 'replied (company)' : 'replied'}</>;
    case 'ticket.assign':
      return row.to ? <>assigned it to <b>{row.to}</b>{row.from ? <> (was {row.from})</> : null}</> : <>unassigned it{row.from ? <> (was {row.from})</> : null}</>;
    case 'ticket.status':
      if (row.to === 'resolved' && row.by === 'company') return <><b className="text-success-700">marked it solved</b> (company)</>;
      if (row.to === 'resolved' && row.by === 'auto') return <><b className="text-success-700">closed it</b> — no reply for 14 days</>;
      return row.to === 'resolved' ? <><b className="text-success-700">resolved</b> it</> : <>set status to <b>{row.to === 'in_progress' ? 'In progress' : row.to}</b></>;
    case 'ticket.reopen':
      return <>re-opened it by replying</>;
    default:
      return <>{actionLabel(row.action)}</>;
  }
}
