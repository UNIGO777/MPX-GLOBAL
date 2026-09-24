import { Fragment, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { reportsApi, reportsKeys } from '../../api/support.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiError, formatDate } from '../../lib/format.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { initialsOf } from '../../components/chat/CompanyAvatar.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { BoxIcon, ChatIcon, ChevronDownIcon, DownloadIcon, HandshakeIcon, HelpIcon, ShieldIcon } from '../../components/ui/icons.jsx';

/**
 * `/admin/reports` — what each staff member did (Step 1e, quote Module 6
 * "per-employee reports"). Counted from the append-only audit log.
 * A superadmin sees the whole team; an employee sees only their own row —
 * the server enforces that, this page only labels it.
 *
 * The eleven server columns are grouped into five work areas so the page reads
 * at a glance; a row expands to the full breakdown, and the CSV keeps every
 * column.
 */
const WINDOWS = [7, 30, 90];

const AREAS = [
  { key: 'verification', label: 'Verification', Icon: ShieldIcon, tone: 'bg-emerald-50 text-emerald-700', cols: ['verifications', 'documents', 'kycViews'] },
  { key: 'catalogue', label: 'Catalogue', Icon: BoxIcon, tone: 'bg-amber-50 text-amber-700', cols: ['takedowns', 'catalogue'] },
  { key: 'chat', label: 'Chat moderation', Icon: ChatIcon, tone: 'bg-violet-50 text-violet-700', cols: ['chatModeration', 'chatReads'] },
  { key: 'support', label: 'Support & notes', Icon: HelpIcon, tone: 'bg-sky-50 text-sky-700', cols: ['ticketReplies', 'ticketsResolved', 'notes'] },
  { key: 'leads', label: 'Supplier requests', Icon: HandshakeIcon, tone: 'bg-primary-50 text-primary-700', cols: ['suppliersConnected'] },
];

/** Short words for the breakdown lines under each number — [one, many]. */
const SHORT = {
  verifications: ['decided', 'decided'],
  documents: ['doc request', 'doc requests'],
  kycViews: ['KYC viewed', 'KYC viewed'],
  takedowns: ['takedown', 'takedowns'],
  catalogue: ['edit', 'edits'],
  chatModeration: ['blocked / warned', 'blocked / warned'],
  chatReads: ['read', 'read'],
  ticketReplies: ['reply', 'replies'],
  ticketsResolved: ['resolved', 'resolved'],
  notes: ['note', 'notes'],
  suppliersConnected: ['connected', 'connected'],
};

function toCsv(report) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Name', 'Email', 'Role', ...report.columns.map((c) => c.label), 'Total'];
  const lines = report.rows.map((r) => [r.name, r.email, r.role, ...report.columns.map((c) => r.counts[c.key]), r.total]);
  return [head, ...lines].map((l) => l.map(cell).join(',')).join('\r\n');
}

const areaTotal = (counts, area) => area.cols.reduce((n, k) => n + (counts[k] ?? 0), 0);

/** "15 blocked / warned · 116 read" — only the non-zero parts. */
function breakdown(counts, area) {
  return area.cols
    .filter((k) => counts[k] > 0)
    .map((k) => `${counts[k].toLocaleString()} ${SHORT[k][counts[k] === 1 ? 0 : 1]}`)
    .join(' · ');
}

export function Reports() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [open, setOpen] = useState(null);
  const [showIdle, setShowIdle] = useState(false);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Reports — MPX Global';
    return () => { document.title = previous; };
  }, []);

  const q = useQuery({ queryKey: reportsKeys.staff({ days }), queryFn: () => reportsApi.staff({ days }), placeholderData: (p) => p });
  const r = q.data;
  const team = r?.scope === 'team';

  const download = () => {
    const blob = new Blob([`\uFEFF${toCsv(r)}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mpx-staff-report-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rows = r ? [...r.rows].sort((a, b) => b.total - a.total) : [];
  const active = rows.filter((x) => x.total > 0);
  const idle = rows.filter((x) => x.total === 0);
  const max = Math.max(1, ...rows.map((x) => x.total));
  const teamCounts = r
    ? Object.fromEntries(r.columns.map((c) => [c.key, r.rows.reduce((n, row) => n + row.counts[c.key], 0)]))
    : {};
  const teamTotal = rows.reduce((n, x) => n + x.total, 0);
  const shown = showIdle ? [...active, ...idle] : active;

  return (
    <AdminLayout>
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Reports</h1>
          <p className="mt-1 text-sm text-muted">
            {team ? 'What each staff member did' : 'What you did'} — counted from the audit log
            {r ? `, ${formatDate(r.since)} to today` : ''}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Period" className="inline-flex rounded-lg border border-ink-200 bg-white p-0.5 shadow-sm">
            {WINDOWS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days === d}
                onClick={() => setDays(d)}
                className={`h-9 rounded-md px-3.5 text-[13px] font-semibold transition-colors ${days === d ? 'bg-primary-600 text-white' : 'text-ink-600 hover:bg-ink-50'}`}
              >
                {d} days
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!r}
            onClick={download}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3.5 text-[13px] font-semibold text-ink-800 shadow-sm hover:bg-ink-50 disabled:opacity-50"
          >
            <DownloadIcon className="h-4 w-4" aria-hidden="true" /> CSV
          </button>
        </div>
      </header>

      {q.isLoading && <SkeletonRows rows={5} />}
      {q.error && <ErrorState message={apiError(q.error).message} onRetry={q.refetch} />}

      {r && (
        <>
          {/* Area totals — the team's, or just yours. */}
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {AREAS.map((a) => {
              const n = areaTotal(teamCounts, a);
              const detail = breakdown(teamCounts, a);
              return (
                <div key={a.key} className="rounded-2xl border border-surface-border bg-white p-4 shadow-card">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.tone}`} aria-hidden="true">
                      <a.Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[12.5px] font-semibold text-ink-700">{a.label}</span>
                  </div>
                  <p className={`mt-2.5 text-2xl font-bold tabular-nums ${n ? 'text-ink-900' : 'text-ink-300'}`}>{n.toLocaleString()}</p>
                  <p className="mt-0.5 min-h-[1rem] text-[11.5px] leading-snug text-muted">{detail || 'Nothing in this period'}</p>
                </div>
              );
            })}
          </div>

          <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
            <div className="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-3 sm:px-5">
              <h2 className="text-[15px] font-bold text-ink-900">{team ? 'By staff member' : 'Your activity'}</h2>
              <span className="text-[12px] text-muted">
                {teamTotal.toLocaleString()} actions{team ? ` · ${active.length} of ${rows.length} staff active` : ''}
              </span>
            </div>

            {active.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted">
                {team ? `No recorded staff actions in the last ${days} days.` : `You have no recorded actions in the last ${days} days.`}
              </p>
            )}

            {/* Wide screens: one row per person, the five areas as columns. */}
            {shown.length > 0 && (
              <table className="hidden w-full table-fixed text-left lg:table">
                <thead>
                  <tr className="border-b border-surface-border bg-ink-50/60 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                    <th scope="col" className="w-[21%] px-5 py-2.5">Staff</th>
                    {AREAS.map((a) => (
                      <th key={a.key} scope="col" className="px-3 py-2.5">{a.label}</th>
                    ))}
                    <th scope="col" className="w-[14%] px-5 py-2.5">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {shown.map((row) => {
                    const isOpen = open === row.id;
                    return (
                      <Fragment key={row.id}>
                        <tr
                          onClick={() => setOpen(isOpen ? null : row.id)}
                          // Keyboard: the row is the toggle (Enter / Space), and says so.
                          tabIndex={0}
                          aria-expanded={isOpen}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(isOpen ? null : row.id); }
                          }}
                          className={`cursor-pointer align-top transition-colors hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-600/40 ${row.id === user?.id ? 'bg-primary-50/30' : ''}`}
                        >
                          <td className="px-5 py-3.5">
                            <Person row={row} you={row.id === user?.id} open={isOpen} />
                          </td>
                          {AREAS.map((a) => {
                            const n = areaTotal(row.counts, a);
                            return (
                              <td key={a.key} className="px-3 py-3.5">
                                <p className={`text-[15px] font-bold tabular-nums ${n ? 'text-ink-900' : 'text-ink-300'}`}>{n.toLocaleString()}</p>
                                {n > 0 && <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{breakdown(row.counts, a)}</p>}
                              </td>
                            );
                          })}
                          <td className="px-5 py-3.5">
                            <p className="text-[15px] font-bold tabular-nums text-ink-900">{row.total.toLocaleString()}</p>
                            <Bar value={row.total} max={max} />
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-surface-subtle/60">
                            <td colSpan={AREAS.length + 2} className="px-5 py-4">
                              <FullBreakdown row={row} columns={r.columns} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Below lg: a card per person. */}
            <ul className="divide-y divide-surface-border lg:hidden">
              {shown.map((row) => {
                const isOpen = open === row.id;
                return (
                  <li key={row.id} className={row.id === user?.id ? 'bg-primary-50/30' : ''}>
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : row.id)} className="w-full px-4 py-3.5 text-left">
                      <div className="flex items-center justify-between gap-3">
                        <Person row={row} you={row.id === user?.id} open={isOpen} />
                        <span className="shrink-0 text-right">
                          <span className="block text-[15px] font-bold tabular-nums text-ink-900">{row.total.toLocaleString()}</span>
                          <span className="block text-[11px] text-muted">actions</span>
                        </span>
                      </div>
                      <Bar value={row.total} max={max} />
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {AREAS.filter((a) => areaTotal(row.counts, a) > 0).map((a) => (
                          <span key={a.key} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${a.tone}`}>
                            <a.Icon className="h-3 w-3" aria-hidden="true" />
                            {a.label} {areaTotal(row.counts, a).toLocaleString()}
                          </span>
                        ))}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-surface-border bg-surface-subtle/60 px-4 py-3.5">
                        <FullBreakdown row={row} columns={r.columns} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {team && idle.length > 0 && (
              <button
                type="button"
                onClick={() => setShowIdle((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 border-t border-surface-border px-5 py-3 text-[13px] font-semibold text-ink-600 hover:bg-ink-50 hover:text-primary-700"
              >
                {showIdle ? 'Hide' : 'Show'} {idle.length} staff with no activity
                <ChevronDownIcon className={`h-4 w-4 transition-transform ${showIdle ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            )}
          </section>

          <p className="mt-3 text-xs text-muted">
            Click a person for the full breakdown. Sign-ins and a company&apos;s own actions are not counted.{' '}
            {team ? 'Only super admins see the whole team.' : 'Only super admins see other staff members.'}
          </p>
        </>
      )}
    </AdminLayout>
  );
}

function Person({ row, you, open }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${row.total > 0 ? 'bg-ink-900' : 'bg-ink-300'}`}
      >
        {initialsOf(row.name)}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="break-words text-[13.5px] font-semibold leading-tight text-ink-900">{row.name}</span>
          {you && <span className="shrink-0 text-[11px] font-semibold text-primary-700">(you)</span>}
          <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
        <span className="block text-[11.5px] text-muted">{row.role === 'superadmin' ? 'Super admin' : 'Employee'}</span>
      </span>
    </span>
  );
}

/** Share of the busiest person's total — a quick sense of who carried the load. */
function Bar({ value, max }) {
  return (
    <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
      <span className="block h-full rounded-full bg-primary-600" style={{ width: `${Math.round((value / max) * 100)}%` }} />
    </span>
  );
}

/** Every server column, grouped by area — what the CSV holds, on screen. */
function FullBreakdown({ row, columns }) {
  const label = Object.fromEntries(columns.map((c) => [c.key, c.label]));
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {AREAS.map((a) => (
        <div key={a.key}>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-500">
            <a.Icon className="h-3.5 w-3.5" aria-hidden="true" /> {a.label}
          </p>
          <dl className="space-y-1">
            {a.cols.map((k) => (
              <div key={k} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <dt className="text-ink-600">{label[k] ?? k}</dt>
                <dd className={`font-semibold tabular-nums ${row.counts[k] ? 'text-ink-900' : 'text-ink-300'}`}>{row.counts[k]}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
