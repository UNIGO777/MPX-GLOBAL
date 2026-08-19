import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { errorLogApi, errorLogKeys } from '../../api/errorLog.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Combobox } from '../../components/ui/Combobox.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { apiError, formatDate, formatTime } from '../../lib/format.js';
import { CheckIcon, CopyIcon, SearchIcon, ShieldIcon, XIcon } from '../../components/ui/icons.jsx';

/**
 * M6 screens 1–2 — the error log viewer (`/admin/errors`), FINALIZE F5.
 *
 * Every user-facing error state shows a support reference code; that code is
 * the `requestId`, and this screen turns it into the server-side detail. It is
 * kept separate from the audit log on purpose: `errorlog:read` hands over stack
 * traces, not the record of every KYC document staff have opened.
 *
 * 🔴 READ-ONLY. The backend has no write verb here — no delete, no "clear
 * log", no export — so this screen renders none. Retention is the server's
 * 90-day TTL, and the caption says so, so nobody hunts for a purge button.
 *
 * 🔴 Content is INTERNAL (stacks, internal messages). Nothing here may leak
 * outside the admin panel — no share link, no public status page.
 *
 * The detail is a Drawer over the list, addressed by `?entry=<id>` so a
 * colleague can be linked straight to one entry (the destination reads the
 * param — the cross-link rule). An entry may EXPIRE between list and click;
 * that renders as its own calm state, never a broken page.
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
  { value: '500', label: '500 — internal' },
  { value: '502', label: '502 — bad gateway' },
  { value: '503', label: '503 — unavailable' },
  { value: '504', label: '504 — timeout' },
];

/** A requestId with a copy affordance — the value staff paste into chat. */
function CopyableId({ value }) {
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
      className="group/copy inline-flex max-w-full items-center gap-1.5 rounded-md font-mono text-[12px] text-ink-700 hover:text-primary-700"
      title="Copy request ID"
    >
      <span className="min-w-0 truncate">{value}</span>
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5 shrink-0 text-success-600" aria-hidden="true" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5 shrink-0 text-ink-300 group-hover/copy:text-primary-600" aria-hidden="true" />
      )}
    </button>
  );
}

function StatusBadge({ code }) {
  return (
    <span className="inline-flex items-center rounded-md bg-danger-50 px-2 py-0.5 font-mono text-[12px] font-bold text-danger-700 ring-1 ring-inset ring-danger-200">
      {code}
    </span>
  );
}

/** The detail drawer — the row plus the stack. */
function EntryDrawer({ id, onClose }) {
  const entry = useQuery({
    queryKey: errorLogKeys.entry(id),
    queryFn: () => errorLogApi.entry(id),
    enabled: Boolean(id),
    retry: false, // a 404 here is an answer (expired), not a flake
  });
  const [stackCopied, setStackCopied] = useState(false);
  const notFound = entry.error?.response?.status === 404;

  return (
    <Drawer open={Boolean(id)} onClose={onClose} title="Error detail" subtitle={id ?? undefined}>
      {entry.isLoading && <SkeletonRows rows={4} />}

      {notFound && (
        <p className="text-sm leading-relaxed text-muted">
          This entry has expired or does not exist. Entries are kept for 90 days, then removed
          automatically.
        </p>
      )}
      {entry.error && !notFound && (
        <ErrorState message={apiError(entry.error).message} onRetry={entry.refetch} />
      )}

      {entry.data && (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              ['Occurred', `${formatDate(entry.data.occurredAt)} · ${formatTime(entry.data.occurredAt)}`],
              ['Status', entry.data.statusCode],
              ['Method', entry.data.method],
              ['User', entry.data.user ? `${entry.data.user.name ?? entry.data.user.id} (${entry.data.user.role ?? '—'})` : 'Not signed in'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{k}</dt>
                <dd className="mt-0.5 text-sm text-ink-900">{v ?? '—'}</dd>
              </div>
            ))}
            <div className="col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Route</dt>
              <dd className="mt-0.5 break-all font-mono text-[12.5px] text-ink-900">{entry.data.route ?? '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Request ID</dt>
              <dd className="mt-0.5"><CopyableId value={entry.data.requestId} /></dd>
            </div>
            {entry.data.orgId && (
              <div className="col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Organisation</dt>
                <dd className="mt-0.5 font-mono text-[12px] text-ink-700">{entry.data.orgId}</dd>
              </div>
            )}
          </dl>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Message</p>
            <p className="mt-1 break-words text-sm text-ink-900">{entry.data.message ?? '—'}</p>
          </div>

          {entry.data.stack && (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Stack trace</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(entry.data.stack);
                    setStackCopied(true);
                    setTimeout(() => setStackCopied(false), 1500);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:underline"
                >
                  {stackCopied ? <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> : <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                  {stackCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="mt-1.5 max-h-96 overflow-auto rounded-lg bg-ink-900 p-4 font-mono text-[11.5px] leading-relaxed text-ink-100">
                {entry.data.stack}
              </pre>
            </div>
          )}

          {entry.data.recordedAt && (
            <p className="text-xs text-muted">Recorded {formatDate(entry.data.recordedAt)} · {formatTime(entry.data.recordedAt)}</p>
          )}
        </div>
      )}
    </Drawer>
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

  const query = {
    ...(requestId ? { requestId } : {}),
    ...(route ? { route } : {}),
    ...(method ? { method } : {}),
    ...(statusCode ? { statusCode } : {}),
    // date inputs give YYYY-MM-DD; `to` covers that whole day
    ...(from ? { from: `${from}T00:00:00.000Z` } : {}),
    ...(to ? { to: `${to}T23:59:59.999Z` } : {}),
    page,
    pageSize,
  };

  const list = useQuery({
    queryKey: errorLogKeys.list(query),
    queryFn: () => errorLogApi.list(query),
    placeholderData: (prev) => prev,
  });

  const rows = list.data?.entries ?? [];
  const total = list.data?.total ?? 0;
  const hasFilters = Boolean(requestId || route || method || statusCode || from || to);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Error log — MPX Global';
    return () => { document.title = previous; };
  }, []);

  const openEntry = (id) => setFilter({ entry: id, page: page > 1 ? String(page) : '' });
  const closeEntry = () => setFilter({ entry: '', page: page > 1 ? String(page) : '' });

  const dateInput =
    'h-11 rounded-lg border border-surface-border bg-white px-3 text-sm text-ink-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20';

  return (
    <AdminLayout>
      <header className="mb-4 sm:mb-6">
        <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Error log</h1>
        <p className="mt-1 text-sm text-muted">
          Server-side 5xx failures, looked up by the support code a user reports. Entries are kept
          for 90 days, then removed automatically.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFilter({ requestId: draft.trim() });
          }}
          className="relative min-w-[14rem] flex-1 basis-72"
        >
          <label htmlFor="err-request" className="sr-only">Request ID</label>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
          <input
            id="err-request"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste a support reference (request ID)"
            className="h-11 w-full rounded-lg border border-surface-border bg-white pl-9 pr-9 font-mono text-sm text-ink-900 placeholder:font-sans placeholder:text-ink-500 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
          />
          {requestId && (
            <button
              type="button"
              onClick={() => setFilter({ requestId: '' })}
              aria-label="Clear request ID"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="w-[8.5rem] shrink-0">
          <label htmlFor="err-method" className="sr-only">Method</label>
          <Combobox id="err-method" value={method} placeholder="Any method" options={METHOD_OPTIONS} onChange={(v) => setFilter({ method: v })} />
        </div>
        <div className="w-[9.5rem] shrink-0">
          <label htmlFor="err-status" className="sr-only">Status code</label>
          <Combobox id="err-status" value={statusCode} placeholder="Any 5xx" options={STATUS_OPTIONS} onChange={(v) => setFilter({ statusCode: v })} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFilter({ route: e.target.elements['err-route'].value.trim() });
          }}
          className="w-[12rem] shrink-0"
        >
          <label htmlFor="err-route" className="sr-only">Route prefix</label>
          <input
            id="err-route"
            type="search"
            defaultValue={route}
            placeholder="Route starts with…"
            className="h-11 w-full rounded-lg border border-surface-border bg-white px-3 font-mono text-[13px] text-ink-900 placeholder:font-sans placeholder:text-ink-500 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
          />
        </form>

        <div className="flex items-center gap-2">
          <label htmlFor="err-from" className="sr-only">From date</label>
          <input id="err-from" type="date" value={from} max={to || undefined} onChange={(e) => setFilter({ from: e.target.value })} className={dateInput} />
          <span className="text-xs text-ink-400">to</span>
          <label htmlFor="err-to" className="sr-only">To date</label>
          <input id="err-to" type="date" value={to} min={from || undefined} onChange={(e) => setFilter({ to: e.target.value })} className={dateInput} />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {list.isLoading ? (
          <SkeletonRows rows={8} />
        ) : list.error ? (
          <ErrorState
            title="We couldn't load the error log"
            message={apiError(list.error).message}
            requestId={apiError(list.error).requestId}
            onRetry={list.refetch}
          />
        ) : rows.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchIcon}
              title="No entries match"
              action={
                <Button variant="secondary" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                  Clear filters
                </Button>
              }
            >
              Nothing matches those filters. A request ID matches exactly; a route matches from the
              start of the path.
            </EmptyState>
          ) : (
            <EmptyState icon={ShieldIcon} title="No server errors">
              Nothing has failed in the last 90 days. That is the state this screen is for.
            </EmptyState>
          )
        ) : (
          <>
            {/* Phone cards — the table needs ~7 columns. */}
            <ul className="divide-y divide-surface-border md:hidden">
              {rows.map((row) => (
                <li key={row.id}>
                  <button type="button" onClick={() => openEntry(row.id)} className="w-full px-4 py-3 text-left transition-colors active:bg-ink-50">
                    <div className="flex items-center gap-2">
                      <StatusBadge code={row.statusCode} />
                      <span className="font-mono text-[12px] text-ink-700">{row.method}</span>
                      <span className="ml-auto text-[11px] tabular-nums text-ink-400">
                        {formatDate(row.occurredAt)} {formatTime(row.occurredAt)}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[12px] text-ink-900">{row.route}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">{row.message ?? '—'}</p>
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[10.5rem]" />
                  <col className="w-[4.5rem]" />
                  <col className="w-[5rem]" />
                  <col />
                  <col className="hidden w-[12rem] lg:table-column" />
                  <col />
                  <col className="hidden w-[9rem] xl:table-column" />
                </colgroup>
                <thead className="border-b border-surface-border bg-ink-50/60 text-[11px] uppercase tracking-wider text-ink-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Occurred</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Method</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Route</th>
                    <th scope="col" className="hidden px-4 py-3 font-semibold lg:table-cell">Request ID</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Message</th>
                    <th scope="col" className="hidden px-4 py-3 font-semibold xl:table-cell">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => openEntry(row.id)}
                      className="cursor-pointer transition-colors hover:bg-primary-50/50"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-[13px] tabular-nums text-ink-700">
                        {formatDate(row.occurredAt)} · {formatTime(row.occurredAt)}
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge code={row.statusCode} /></td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-ink-700">{row.method}</td>
                      <td className="max-w-0 px-4 py-2.5">
                        <span className="block truncate font-mono text-[12px] text-ink-900">{row.route}</span>
                      </td>
                      <td className="hidden max-w-0 px-4 py-2.5 lg:table-cell"><CopyableId value={row.requestId} /></td>
                      <td className="max-w-0 px-4 py-2.5">
                        <span className="block truncate text-[13px] text-ink-700">{row.message ?? '—'}</span>
                      </td>
                      <td className="hidden max-w-0 whitespace-nowrap px-4 py-2.5 xl:table-cell">
                        <span className="block truncate text-[13px] text-ink-600">
                          {row.user ? (row.user.name ?? row.user.id) : <span className="text-ink-400">—</span>}
                        </span>
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
              onPage={(p) => setFilter({ page: p > 1 ? String(p) : '', entry: entryId ?? '' })}
              onPageSize={(size) => { setPageSize(size); setFilter({ page: '', entry: entryId ?? '' }); }}
            />
          </>
        )}
      </div>

      <EntryDrawer id={entryId} onClose={closeEntry} />
    </AdminLayout>
  );
}
