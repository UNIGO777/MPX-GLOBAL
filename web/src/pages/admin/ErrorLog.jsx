import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { errorLogApi, errorLogKeys } from '../../api/errorLog.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { roleLabel } from '../../lib/auditFormat.js';
import { cp } from '../../lib/consolePath.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { FilterChip } from '../../components/ui/FilterChip.jsx';
import { inputClasses } from '../../components/ui/Field.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { apiError, formatDate, formatTime } from '../../lib/format.js';
import { AlertIcon, CheckIcon, ChevronRightIcon, ClockIcon, CopyIcon, LockIcon, SearchIcon, ShieldIcon, XIcon } from '../../components/ui/icons.jsx';

/**
 * The error log viewer (`/admin/errors` · `/staff/errors`, `errorlog:read`).
 *
 * Every user-facing error state shows a support reference; that reference is
 * the `requestId`, and this screen turns it into the server-side detail. Kept
 * separate from the audit log on purpose: `errorlog:read` hands over stack
 * traces, not the record of every KYC document staff have opened.
 *
 * 🔴 READ-ONLY. The backend has no write verb here — no delete, no "clear
 * log", no export — so this screen renders none. Retention is the server's
 * 90-day TTL, and the header says so, so nobody hunts for a purge button.
 *
 * 🔴 Content is INTERNAL (stacks, internal messages). Nothing here may leak
 * outside the admin panel — no share link, no public status page.
 *
 * Filters and the open entry live in the URL (`?entry=<id>`), so a colleague
 * can be linked straight to one failure. An entry may EXPIRE between list and
 * click; that renders as its own calm state. 2026-09-24 redesign: an overview
 * (24h / 7d / 90d + the week's most-failing routes), one search, chips.
 */
const METHOD_OPTIONS = [
  { value: '', label: 'Any method' },
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
];

// 5xx ONLY — the log stores nothing else (4xx is never persisted), so offering
// 4xx here would produce empty pages that read as "this route never failed".
const STATUS_OPTIONS = [
  { value: '', label: 'Any 5xx' },
  { value: '500', label: '500 · Internal error' },
  { value: '502', label: '502 · Bad gateway' },
  { value: '503', label: '503 · Unavailable' },
  { value: '504', label: '504 · Timeout' },
];

const PERIOD_OPTIONS = [
  { value: '', label: 'Last 90 days' },
  { value: '1d', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range…' },
];

function isoDay(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function presetRange(key) {
  const today = new Date();
  const back = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return isoDay(d); };
  if (key === '1d') return { from: back(1), to: isoDay(today) };
  if (key === '7d') return { from: back(6), to: isoDay(today) };
  if (key === '30d') return { from: back(29), to: isoDay(today) };
  return { from: '', to: '' };
}
function periodOf(from, to) {
  if (!from && !to) return '';
  for (const key of ['1d', '7d', '30d']) {
    const r = presetRange(key);
    if (r.from === from && r.to === to) return key;
  }
  return 'custom';
}
function dayLabel(value) {
  const d = new Date(value);
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
const STATUS_WORD = { 500: 'Internal error', 502: 'Bad gateway', 503: 'Unavailable', 504: 'Timeout' };

/** A value with a copy affordance — what staff paste into chat or a ticket. */
function Copyable({ value, label = 'Copy', mono = true }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-ink-400">—</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`group/copy inline-flex max-w-full items-center gap-1.5 rounded-md text-left text-ink-700 hover:text-primary-700 ${mono ? 'font-mono text-[12px]' : 'text-[13px]'}`}
      title={label}
    >
      <span className="min-w-0 break-all">{value}</span>
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5 shrink-0 text-success-600" aria-hidden="true" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5 shrink-0 text-ink-300 group-hover/copy:text-primary-600" aria-hidden="true" />
      )}
      <span className="sr-only">{copied ? 'Copied' : label}</span>
    </button>
  );
}

function StatusBadge({ code }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-danger-50 px-2 py-0.5 font-mono text-[12px] font-bold text-danger-700 ring-1 ring-inset ring-danger-200">
      {code}
    </span>
  );
}

export function ErrorLog() {
  // Filters live in the URL: a "what failed on /auth since the deploy" view is
  // worth linking to a colleague — same rule as the audit and org lists.
  const [params, setParams] = useSearchParams();
  const requestId = params.get('requestId') ?? '';
  const route = params.get('route') ?? '';
  const method = params.get('method') ?? '';
  const statusCode = params.get('statusCode') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Number(params.get('page') ?? 1);
  const entryId = params.get('entry');
  const [pageSize, setPageSize] = useState(20);
  const [draft, setDraft] = useState(requestId);
  const [customOpen, setCustomOpen] = useState(periodOf(from, to) === 'custom');
  const period = customOpen ? 'custom' : periodOf(from, to);

  // Keep the box in step when the URL's requestId changes (back button, link).
  const [lastRequestId, setLastRequestId] = useState(requestId);
  if (lastRequestId !== requestId) {
    setLastRequestId(requestId);
    setDraft(requestId);
  }

  const setFilter = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  const clearAll = () => { setCustomOpen(false); setParams(new URLSearchParams(), { replace: true }); };

  const query = {
    ...(requestId ? { requestId } : {}),
    ...(route ? { route } : {}),
    ...(method ? { method } : {}),
    ...(statusCode ? { statusCode } : {}),
    // Date inputs give YYYY-MM-DD; `to` covers that whole day.
    ...(from ? { from: `${from}T00:00:00.000Z` } : {}),
    ...(to ? { to: `${to}T23:59:59.999Z` } : {}),
    page,
    pageSize,
  };

  const list = useQuery({ queryKey: errorLogKeys.list(query), queryFn: () => errorLogApi.list(query), placeholderData: (prev) => prev });
  const summary = useQuery({ queryKey: errorLogKeys.summary, queryFn: errorLogApi.summary, refetchInterval: 60_000 });

  const rows = list.data?.entries ?? [];
  const total = list.data?.total ?? 0;
  const hasFilters = Boolean(requestId || route || method || statusCode || from || to);
  const s = summary.data;

  useEffect(() => {
    const previous = document.title;
    document.title = 'Error log — MPX Global';
    return () => { document.title = previous; };
  }, []);

  const openEntry = (id) => setFilter({ entry: id, page: page > 1 ? String(page) : '' });
  const closeEntry = () => setFilter({ entry: '', page: page > 1 ? String(page) : '' });

  // Group the page by day (the server sorts newest first).
  const groups = [];
  for (const r of rows) {
    const label = dayLabel(r.occurredAt);
    if (groups.at(-1)?.label !== label) groups.push({ label, rows: [] });
    groups.at(-1).rows.push(r);
  }

  return (
    <AdminLayout>
      <header className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Error log</h1>
          <p className="mt-1 text-sm text-muted">Server failures (5xx), found by the support reference a user reports.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-ink-900 px-3 py-1.5 text-[12px] font-semibold text-white sm:self-auto">
          <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Read-only · kept 90 days, then removed automatically
        </span>
      </header>

      {/* Overview — one slim strip: counts are shortcuts to the period filter. */}
      <div className="mb-4 flex flex-col gap-2.5 rounded-2xl border border-surface-border bg-white px-3 py-2.5 shadow-card lg:flex-row lg:items-center lg:gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: '1d', label: '24 hours', value: s?.last24h },
            { key: '7d', label: '7 days', value: s?.last7d },
            { key: '', label: '90 days', value: s?.total },
          ].map((c) => {
            const active = period === c.key && !customOpen;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => { setCustomOpen(false); setFilter(presetRange(c.key)); }}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors ${
                  active ? 'bg-primary-50 text-primary-800 ring-1 ring-inset ring-primary-200' : 'text-ink-600 hover:bg-ink-50'
                }`}
              >
                <span className={`font-bold tabular-nums ${c.value ? 'text-danger-700' : 'text-ink-900'}`}>
                  {summary.isLoading ? '–' : (c.value ?? 0).toLocaleString()}
                </span>
                <span>in {c.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 border-t border-surface-border pt-2.5 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <span className="shrink-0 text-[12px] font-semibold text-muted">Failing most this week</span>
          {summary.isLoading ? (
            <span className="h-6 w-40 animate-pulse rounded-md bg-ink-100" />
          ) : !s?.topRoutes?.length ? (
            <span className="inline-flex items-center gap-1 text-[12.5px] text-success-700">
              <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> nothing
            </span>
          ) : (
            <div className="scrollbar-none flex min-w-0 gap-1.5 overflow-x-auto">
              {s.topRoutes.slice(0, 3).map((r) => (
                <button
                  key={r.route}
                  type="button"
                  // Filter by the pattern's fixed prefix (everything before the first ":id").
                  onClick={() => { setDraft(''); setFilter({ route: r.route.split('/:id')[0] || r.route, requestId: '' }); }}
                  className="inline-flex max-w-[16rem] shrink-0 items-center gap-1.5 rounded-md border border-surface-border px-2 py-1 hover:border-primary-300 hover:bg-primary-50/40"
                  title={`Show only ${r.route}`}
                >
                  <span className="truncate font-mono text-[11.5px] text-ink-800">{r.route}</span>
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-danger-700">{r.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search + filters */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <form
          onSubmit={(e) => { e.preventDefault(); setFilter({ requestId: draft.trim() }); }}
          className="relative lg:max-w-lg lg:flex-1"
          role="search"
        >
          <label htmlFor="err-request" className="sr-only">Support reference (request ID)</label>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
          <input
            id="err-request"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste a support reference and press Enter"
            className="search-own-clear h-11 w-full rounded-full border border-surface-border bg-white pl-9 pr-9 font-mono text-sm text-ink-900 shadow-sm placeholder:font-sans placeholder:text-ink-500 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
          />
          {(draft || requestId) && (
            <button
              type="button"
              onClick={() => { setDraft(''); setFilter({ requestId: '' }); }}
              aria-label="Clear the reference"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </form>
        <div className="scrollbar-none -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
          <FilterChip label="Method" value={method} options={METHOD_OPTIONS} onChange={(v) => setFilter({ method: v })} />
          <FilterChip label="Status" value={statusCode} options={STATUS_OPTIONS} onChange={(v) => setFilter({ statusCode: v })} />
          <FilterChip
            label="Period"
            value={period}
            options={PERIOD_OPTIONS}
            onChange={(v) => {
              if (v === 'custom') { setCustomOpen(true); return; }
              setCustomOpen(false);
              setFilter(presetRange(v));
            }}
          />
          {hasFilters && (
            <button type="button" onClick={clearAll} className="whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold text-primary-700 hover:bg-primary-50">
              Clear all
            </button>
          )}
        </div>
      </div>

      {(period === 'custom' || route) && (
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          {period === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-surface-border bg-white px-3 py-2 shadow-sm">
              <label htmlFor="err-from" className="text-[12.5px] font-semibold text-ink-600">From</label>
              <input id="err-from" type="date" className={inputClasses(false, 'h-9 w-auto')} value={from} max={to || undefined} onChange={(e) => setFilter({ from: e.target.value })} />
              <label htmlFor="err-to" className="text-[12.5px] font-semibold text-ink-600">to</label>
              <input id="err-to" type="date" className={inputClasses(false, 'h-9 w-auto')} value={to} min={from || undefined} onChange={(e) => setFilter({ to: e.target.value })} />
            </div>
          )}
          {route && (
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1.5 text-[12.5px] font-medium text-primary-700 ring-1 ring-inset ring-primary-100">
              Route starts with <span className="font-mono font-semibold">{route}</span>
              <button type="button" onClick={() => setFilter({ route: '' })} aria-label="Show every route" className="rounded-full p-0.5 text-primary-600 hover:bg-primary-100">
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {list.isLoading ? (
          <SkeletonRows rows={8} />
        ) : list.error ? (
          <ErrorState title="We couldn't load the error log" message={apiError(list.error).message} requestId={apiError(list.error).requestId} onRetry={list.refetch} />
        ) : rows.length === 0 ? (
          hasFilters ? (
            <EmptyState icon={SearchIcon} title="No failures match" action={<Button variant="secondary" size="sm" onClick={clearAll}>Clear all</Button>}>
              A support reference matches exactly; a route matches from the start of the path.
            </EmptyState>
          ) : (
            <EmptyState icon={ShieldIcon} title="No server failures">
              Nothing has failed in the last 90 days — the state this screen is for.
            </EmptyState>
          )
        ) : (
          <>
            {groups.map((g) => (
              <section key={g.label} aria-label={g.label}>
                <h2 className="border-b border-surface-border bg-ink-50/70 px-4 py-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-500 sm:px-5">
                  {g.label}
                </h2>
                <ul className="divide-y divide-surface-border">
                  {g.rows.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => openEntry(row.id)}
                        className="group flex w-full items-start gap-3.5 px-4 py-3 text-left transition-colors hover:bg-ink-50 focus-visible:bg-ink-50 focus-visible:outline-none sm:px-5"
                      >
                        <StatusBadge code={row.statusCode} />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0 font-mono text-[11.5px] font-bold text-ink-500">{row.method}</span>
                            <span className="truncate font-mono text-[13px] font-semibold text-ink-900">{row.route}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-[12.5px] text-ink-600">{row.message ?? '—'}</span>
                          <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                            {row.user ? `${row.user.name ?? 'User'} · ${roleLabel(row.user.role)}` : 'Not signed in'}
                            {row.requestId ? <> · ref <span className="font-mono">{row.requestId.slice(0, 8)}</span></> : ''}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[12px] tabular-nums text-muted">
                          {formatTime(row.occurredAt)}
                          <ChevronRightIcon className="h-4 w-4 text-ink-300 group-hover:text-primary-600" aria-hidden="true" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPage={(p) => setFilter({ page: p > 1 ? String(p) : '', entry: entryId ?? '' })}
              onPageSize={(size) => { setPageSize(size); setFilter({ page: '', entry: entryId ?? '' }); }}
            />
          </>
        )}
      </div>

      <EntryDrawer
        id={entryId}
        onClose={closeEntry}
        onFilter={(patch) => { setDraft(patch.requestId ?? ''); setFilter({ ...patch, entry: '' }); }}
      />
    </AdminLayout>
  );
}

/** The failure, read-only: what failed, for whom, the reference, the stack. */
function EntryDrawer({ id, onClose, onFilter }) {
  const { user } = useAuth();
  const entry = useQuery({
    queryKey: errorLogKeys.entry(id),
    queryFn: () => errorLogApi.entry(id),
    enabled: Boolean(id),
    retry: false, // a 404 here is an answer (expired), not a flake
  });
  const [stackCopied, setStackCopied] = useState(false);
  const notFound = entry.error?.response?.status === 404;
  const e = entry.data;

  return (
    <Drawer
      open={Boolean(id)}
      onClose={onClose}
      icon={AlertIcon}
      title="Server failure"
      subtitle={e ? `${formatDate(e.occurredAt)} · ${formatTime(e.occurredAt)}` : undefined}
    >
      {entry.isLoading && <SkeletonRows rows={4} />}
      {notFound && (
        <EmptyState icon={ClockIcon} title="This entry has expired">
          Entries are kept for 90 days, then removed automatically.
        </EmptyState>
      )}
      {entry.error && !notFound && <ErrorState message={apiError(entry.error).message} onRetry={entry.refetch} />}

      {e && (
        <div className="space-y-5">
          {/* What failed */}
          <div className="rounded-2xl border border-danger-200 bg-danger-50/50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge code={e.statusCode} />
              <span className="text-[12.5px] font-semibold text-danger-800">{STATUS_WORD[e.statusCode] ?? 'Server error'}</span>
            </div>
            <p className="mt-2 break-all font-mono text-[13px] text-ink-900">
              <span className="font-bold text-ink-500">{e.method}</span> {e.route ?? '—'}
            </p>
            <p className="mt-3 rounded-xl bg-white px-3 py-2 text-[13.5px] leading-relaxed text-ink-800 ring-1 ring-inset ring-danger-100">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-muted">Message</span>
              {e.message ?? '—'}
            </p>
          </div>

          {/* Reference + who */}
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-surface-border p-3.5 sm:col-span-2">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Support reference</dt>
              <dd className="mt-1.5"><Copyable value={e.requestId} label="Copy the support reference" /></dd>
              <p className="mt-1 text-[11.5px] text-muted">The code the user saw on their error screen.</p>
            </div>
            <div className="rounded-xl border border-surface-border p-3.5">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Signed in as</dt>
              <dd className="mt-1.5 text-[13.5px] font-semibold text-ink-900">
                {e.user ? (e.user.name ?? e.user.id) : <span className="font-normal text-muted">Not signed in</span>}
                {e.user && <span className="block text-[12px] font-normal text-muted">{roleLabel(e.user.role)}</span>}
              </dd>
            </div>
            <div className="rounded-xl border border-surface-border p-3.5">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Company</dt>
              <dd className="mt-1.5 text-[13.5px]">
                {e.orgId ? (
                  can(user, 'organisation:read') ? (
                    <Link to={cp(`/admin/organisations/${e.orgId}`)} onClick={onClose} className="font-semibold text-primary-700 hover:underline">Open company</Link>
                  ) : (
                    <span className="font-mono text-[12px] text-ink-700">{e.orgId}</span>
                  )
                ) : (
                  <span className="text-muted">—</span>
                )}
              </dd>
            </div>
          </dl>

          {/* Show similar — filters, never actions. */}
          <section>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Show similar</h3>
            <div className="flex flex-wrap gap-2">
              {e.route && (
                <SimilarButton onClick={() => onFilter({ route: e.route.split('?')[0], requestId: '' })}>This route</SimilarButton>
              )}
              <SimilarButton onClick={() => onFilter({ statusCode: String(e.statusCode), requestId: '' })}>Every {e.statusCode}</SimilarButton>
            </div>
          </section>

          {e.stack && (
            <section>
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted">Stack trace</h3>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(e.stack);
                    setStackCopied(true);
                    setTimeout(() => setStackCopied(false), 1500);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50"
                >
                  {stackCopied ? <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> : <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                  {stackCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="max-h-96 overflow-auto rounded-xl bg-ink-900 p-4 font-mono text-[11.5px] leading-relaxed text-ink-100">{e.stack}</pre>
            </section>
          )}

          <p className="flex items-center gap-1.5 text-[12px] text-muted">
            <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {e.recordedAt ? `Recorded ${formatDate(e.recordedAt)} · ${formatTime(e.recordedAt)}. ` : ''}Removed automatically after 90 days.
          </p>
        </div>
      )}
    </Drawer>
  );
}

function SimilarButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-lg border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-800 shadow-sm transition-colors hover:border-primary-300 hover:text-primary-700"
    >
      {children}
    </button>
  );
}
