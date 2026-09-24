import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from '../../api/admin.js';
import { actionDot, actionLabel, actionTone, entityTypeLabel, roleLabel } from '../../lib/auditFormat.js';
import { adminCatalogueApi, adminCatalogueKeys } from '../../api/adminCatalogue.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { initialsOf } from '../../components/chat/CompanyAvatar.jsx';
import { Combobox } from '../../components/ui/Combobox.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { FilterChip } from '../../components/ui/FilterChip.jsx';
import { inputClasses } from '../../components/ui/Field.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { ChevronRightIcon, ListIcon, LockIcon, XIcon } from '../../components/ui/icons.jsx';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { cp } from '../../lib/consolePath.js';
import { PERMISSION_LABELS } from '../../lib/permissions.js';

/**
 * The audit log viewer (`/admin/audit` · `/staff/audit`, `audit:read`).
 *
 * 🔴 STRICTLY READ-ONLY. There is no edit control, no delete, no "clean up", no
 * archive and NO EXPORT anywhere on this screen — and there must never be. Audit
 * records are append-only at the database level (tracker C10); an interface that
 * implies otherwise is wrong even if the server would refuse it.
 *
 * 🔴 `target.name` IS NULLABLE and that is honest: most actions never recorded a
 * name, and a deleted target may have none. Render "—". Never invent one.
 *
 * Filters (m5 §6: actor · action · date range · target) live in the URL, so a
 * filtered view can be linked (the organisation page's "Open full record" does).
 * The Action and Target pickers are fed by `/admin/audit/facets` — the values
 * that actually occur in the log — so they never drift behind the code
 * (2026-09-24 redesign; the Action filter used to be a typed exact name).
 */
const PAGE_SIZE = 20; // the server caps this route at 50

function isoDay(d) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

/** Period presets → a from/to pair of YYYY-MM-DD (the server's own format). */
function presetRange(key) {
  const today = new Date();
  const back = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return isoDay(d);
  };
  if (key === 'today') return { from: isoDay(today), to: isoDay(today) };
  if (key === '7d') return { from: back(6), to: isoDay(today) };
  if (key === '30d') return { from: back(29), to: isoDay(today) };
  return { from: '', to: '' };
}

function periodOf(from, to) {
  if (!from && !to) return '';
  for (const key of ['today', '7d', '30d']) {
    const r = presetRange(key);
    if (r.from === from && r.to === to) return key;
  }
  return 'custom';
}

const PERIOD_OPTIONS = [
  { value: '', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range…' },
];

function timeOf(value) {
  return value ? new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
}
function fullStamp(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
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

/**
 * before/after as readable rows, not raw JSON. Values are already redacted at
 * the WRITE site (m5-rules §4 forbids KYC, tokens or contact details entering
 * an audit row), so nothing needs filtering here.
 */
function present(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
const FIELD_LABELS = { status: 'Status', reason: 'Reason', name: 'Name', slug: 'Web address', active: 'Active', kycStatus: 'Verification', assignedTo: 'Assigned to', by: 'Done by', ref: 'Reference' };
function diffRows(before, after) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  return keys.map((k) => ({
    key: k,
    field: FIELD_LABELS[k] ?? k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
    from: present(before?.[k]),
    to: present(after?.[k]),
    changed: before && after && k in (before ?? {}) && k in (after ?? {}) && present(before[k]) !== present(after[k]),
  }));
}

/** Where a target can be opened — only kinds with a page, and only with the grant for it. */
function targetHref(user, target) {
  if (!target?.id || !target?.name) return null;
  switch (target.type) {
    case 'Organisation':
      return can(user, 'organisation:read') ? cp(`/admin/organisations/${target.id}`) : null;
    case 'Conversation':
      return can(user, 'conversation:read') ? cp(`/admin/conversations/${target.id}`) : null;
    case 'ticket':
      return can(user, 'support:read') ? cp(`/admin/support/${target.id}`) : null;
    case 'lead':
      return can(user, 'lead:manage') ? cp(`/admin/leads/${target.id}`) : null;
    default:
      return null;
  }
}

export function AuditLog() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [openId, setOpenId] = useState(null);

  const action = params.get('action') ?? '';
  // Set by the organisation page's "Open full record": a company's history is
  // NOT entityType+entityId (a takedown's target is the Product), so it filters
  // by the entry's orgId instead (audit.validators.js).
  const orgId = params.get('orgId') ?? '';
  const actorId = params.get('actorId') ?? '';
  const entityType = params.get('entityType') ?? '';
  // The id half of the target PAIR (an id alone is a 400 — the index is the pair).
  const entityId = params.get('entityId') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [customOpen, setCustomOpen] = useState(periodOf(from, to) === 'custom');
  const period = customOpen ? 'custom' : periodOf(from, to);

  // An inverted range is a 400 from the server (deliberately — an empty page
  // would read as "no activity"). Catch it here so the screen explains.
  const inverted = Boolean(from && to && from > to);

  const query = {
    ...(action ? { action } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(orgId ? { orgId } : {}),
    ...(actorId ? { actorId } : {}),
    ...(entityType ? { entityType } : {}),
    ...(entityType && entityId ? { entityId } : {}),
    page,
    pageSize: PAGE_SIZE,
  };

  // Staff only — a buyer or exporter's own actions are recorded, but staff are
  // who this viewer is usually asked about. (Their rows still list normally.)
  const staff = useQuery({
    queryKey: ['admin', 'users', { role: 'employee,superadmin', pageSize: 100 }],
    queryFn: () => adminApi.listUsers({ role: 'employee,superadmin', pageSize: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const facets = useQuery({ queryKey: adminCatalogueKeys.auditFacets, queryFn: adminCatalogueApi.auditFacets, staleTime: 60 * 1000 });

  const actorOptions = [
    { value: '', label: 'Anyone' },
    ...(staff.data?.rows ?? []).map((u) => ({ value: u.id, label: u.name, hint: roleLabel(u.role) })),
  ];
  const actionOptions = [
    { value: '', label: 'Any action' },
    ...(facets.data?.actions ?? []).map((a) => ({ value: a, label: actionLabel(a), hint: a.split('.')[0] })),
  ];
  const targetOptions = [
    { value: '', label: 'Any target' },
    ...(facets.data?.entityTypes ?? []).map((t) => ({ value: t, label: entityTypeLabel(t) })),
  ];

  const list = useQuery({
    queryKey: adminCatalogueKeys.audit(query),
    queryFn: () => adminCatalogueApi.audit(query),
    enabled: !inverted,
    placeholderData: (prev) => prev,
  });

  const setFilter = (patch) => {
    const next = { ...Object.fromEntries(params), ...patch, page: '1' };
    for (const k of Object.keys(next)) if (!next[k]) delete next[k];
    setParams(next);
  };
  const clearAll = () => { setCustomOpen(false); setParams({}); };

  const rows = list.data?.entries ?? [];
  const total = list.data?.total ?? 0;
  const hasFilters = Boolean(action || from || to || orgId || actorId || entityType || entityId);

  // Group the page's rows by day (the server already sorts newest first).
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
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold leading-tight text-ink-900 sm:text-2xl">Audit log</h1>
            {list.isSuccess && (
              <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-ink-600">
                {total.toLocaleString()} {total === 1 ? 'entry' : 'entries'}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">Every staff and account action on the platform, as it happened.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-ink-900 px-3 py-1.5 text-[12px] font-semibold text-white sm:self-auto">
          <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Read-only · entries can never be changed or deleted
        </span>
      </header>

      {/* Filters: two searchable pickers + two chips, all in the URL. */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <Combobox id="audit-action" ariaLabel="Action" value={action} placeholder="Any action" options={actionOptions} onChange={(v) => setFilter({ action: v })} notFound="No action by that name" />
          <Combobox id="audit-actor" ariaLabel="Actor" value={actorId} placeholder="Anyone" options={actorOptions} onChange={(v) => setFilter({ actorId: v })} notFound="No staff member by that name" />
        </div>
        <div className="scrollbar-none -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
          <FilterChip
            label="Target"
            value={entityType}
            options={targetOptions}
            onChange={(v) => setFilter({ entityType: v, entityId: '' })}
          />
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

      {(period === 'custom' || orgId || entityId || inverted) && (
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          {period === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-surface-border bg-white px-3 py-2 shadow-sm">
              <label htmlFor="audit-from" className="text-[12.5px] font-semibold text-ink-600">From</label>
              <input id="audit-from" type="date" className={inputClasses(false, 'h-9 w-auto')} value={from} onChange={(e) => setFilter({ from: e.target.value })} />
              <label htmlFor="audit-to" className="text-[12.5px] font-semibold text-ink-600">to</label>
              <input id="audit-to" type="date" className={inputClasses(inverted, 'h-9 w-auto')} value={to} onChange={(e) => setFilter({ to: e.target.value })} />
            </div>
          )}
          {/* Scoped views announce themselves — otherwise one company's history
              reads exactly like the whole platform's. */}
          {orgId && (
            <ScopeChip onClear={() => setFilter({ orgId: '' })} clearLabel="Show the whole platform's record">
              One company&apos;s record ·{' '}
              <Link to={cp(`/admin/organisations/${orgId}`)} className="font-semibold hover:underline">open company</Link>
            </ScopeChip>
          )}
          {entityType && entityId && (
            <ScopeChip onClear={() => setFilter({ entityId: '' })} clearLabel="Show every target of this type">
              One {entityTypeLabel(entityType).toLowerCase()} · <span className="font-mono">{entityId.slice(-8)}</span>
            </ScopeChip>
          )}
          {inverted && (
            <p className="text-[13px] font-medium text-danger-700" role="alert">
              The end date is before the start date — there is no window to search.
            </p>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {list.isPending && !inverted && <SkeletonRows rows={8} />}
        {list.isError && (
          <ErrorState title="We couldn't load the audit log" requestId={list.error?.response?.data?.error?.requestId} onRetry={list.refetch} />
        )}
        {list.isSuccess && total === 0 && (
          <EmptyState
            icon={ListIcon}
            title={hasFilters ? 'Nothing matches these filters' : 'Nothing recorded yet'}
            action={hasFilters ? <Button variant="secondary" onClick={clearAll}>Clear all</Button> : undefined}
          >
            {hasFilters ? 'Try a wider period or another action.' : 'Actions will appear here as they happen.'}
          </EmptyState>
        )}

        {list.isSuccess && total > 0 && (
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
                        onClick={() => setOpenId(row.id)}
                        className="group flex w-full items-start gap-3.5 px-4 py-3 text-left transition-colors hover:bg-ink-50 focus-visible:bg-ink-50 focus-visible:outline-none sm:px-5"
                      >
                        <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white ${actionDot(row.action)}`} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-[14px] font-semibold text-ink-900">{actionLabel(row.action)}</span>
                            {row.target?.type && (
                              <span className="rounded-md bg-ink-50 px-1.5 py-px text-[11px] font-medium text-ink-600 ring-1 ring-inset ring-ink-200">
                                {entityTypeLabel(row.target.type)}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                            <span className="font-medium text-ink-700">{row.actor?.name ?? 'System'}</span>
                            {row.actor?.role ? ` · ${roleLabel(row.actor.role)}` : ''}
                            {row.target?.name ? <> · on <span className="text-ink-700">{row.target.name}</span></> : ''}
                          </span>
                          {row.reason && <span className="mt-1 block line-clamp-1 text-[12.5px] italic text-ink-600">“{row.reason}”</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[12px] tabular-nums text-muted">
                          {timeOf(row.occurredAt)}
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
              pageSize={PAGE_SIZE}
              total={total}
              onPage={(n) => setParams({ ...Object.fromEntries(params), page: String(n) })}
            />
          </>
        )}
      </div>

      <EntryDrawer id={openId} onClose={() => setOpenId(null)} user={user} onFilter={(patch) => { setOpenId(null); setFilter(patch); }} />
    </AdminLayout>
  );
}

function ScopeChip({ children, onClear, clearLabel }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1.5 text-[12.5px] font-medium text-primary-700 ring-1 ring-inset ring-primary-100">
      {children}
      <button type="button" onClick={onClear} aria-label={clearLabel} className="rounded-full p-0.5 text-primary-600 hover:bg-primary-100">
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/**
 * The entry, read-only: what happened, who, on what, the recorded changes, and
 * the technical trail. No action buttons of any kind — only "show similar"
 * filters, which read, never write.
 */
function EntryDrawer({ id, onClose, user, onFilter }) {
  const entry = useQuery({
    queryKey: adminCatalogueKeys.auditEntry(id),
    queryFn: () => adminCatalogueApi.auditEntry(id),
    enabled: Boolean(id),
  });
  const e = entry.data;
  const href = e ? targetHref(user, e.target) : null;
  const changes = e ? diffRows(e.before, e.after) : [];

  return (
    <Drawer open={Boolean(id)} onClose={onClose} icon={ListIcon} title="Audit entry" subtitle={e ? fullStamp(e.occurredAt) : undefined}>
      {entry.isPending && <SkeletonRows rows={5} />}
      {entry.isError && <ErrorState title="We couldn't load this entry" onRetry={entry.refetch} />}
      {e && (
        <div className="space-y-5">
          {/* What happened */}
          <div className="rounded-2xl border border-surface-border bg-surface-subtle/60 p-4">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${actionTone(e.action)}`}>{actionLabel(e.action)}</span>
            <p className="mt-2 font-mono text-[11.5px] text-muted">{e.action}</p>
            {e.reason && (
              <p className="mt-3 rounded-xl bg-white px-3 py-2 text-[13.5px] leading-relaxed text-ink-800 ring-1 ring-inset ring-surface-border">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-muted">Reason given</span>
                {e.reason}
              </p>
            )}
          </div>

          {/* Who and on what */}
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-surface-border p-3.5">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Done by</dt>
              <dd className="mt-2 flex items-center gap-2.5">
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[11px] font-bold text-white">
                  {initialsOf(e.actor?.name ?? 'System')}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-ink-900">{e.actor?.name ?? 'System'}</span>
                  <span className="block text-[12px] text-muted">{roleLabel(e.actor?.role)}</span>
                </span>
              </dd>
            </div>
            <div className="rounded-xl border border-surface-border p-3.5">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">On</dt>
              <dd className="mt-2 min-w-0">
                {href ? (
                  <Link to={href} onClick={onClose} className="block truncate text-[13.5px] font-semibold text-primary-700 hover:underline">
                    {e.target.name}
                  </Link>
                ) : (
                  <span className="block truncate text-[13.5px] font-semibold text-ink-900">{e.target?.name ?? '—'}</span>
                )}
                <span className="block text-[12px] text-muted">{entityTypeLabel(e.target?.type)}</span>
              </dd>
            </div>
          </dl>

          {/* Recorded changes */}
          {changes.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Recorded details</h3>
              <div className="overflow-hidden rounded-xl border border-surface-border">
                <table className="w-full table-fixed text-[13px]">
                  <thead>
                    <tr className="bg-ink-50 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                      <th className="w-[34%] px-3 py-2">Field</th>
                      <th className="px-3 py-2">Before</th>
                      <th className="px-3 py-2">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {changes.map((c) =>
                      c.key === 'permissions' ? (
                        <PermissionRow key={c.key} before={e.before?.permissions} after={e.after?.permissions} />
                      ) : (
                        <tr key={c.key} className={c.changed ? 'bg-warning-50/40' : ''}>
                          <td className="px-3 py-2 align-top font-medium text-ink-700">{c.field}</td>
                          <td className={`break-words px-3 py-2 align-top ${c.changed ? 'text-ink-500 line-through' : 'text-ink-600'}`}>{c.from}</td>
                          <td className="break-words px-3 py-2 align-top font-medium text-ink-900">{c.to}</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Read-only "show similar" — filters, never actions. */}
          <section>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Show similar</h3>
            <div className="flex flex-wrap gap-2">
              <SimilarButton onClick={() => onFilter({ action: e.action })}>Every “{actionLabel(e.action)}”</SimilarButton>
              {e.actor?.id && <SimilarButton onClick={() => onFilter({ actorId: e.actor.id })}>Everything by {e.actor.name ?? 'this person'}</SimilarButton>}
              {e.target?.type && e.target?.id && (
                <SimilarButton onClick={() => onFilter({ entityType: e.target.type, entityId: e.target.id })}>
                  This {entityTypeLabel(e.target.type).toLowerCase()}&apos;s history
                </SimilarButton>
              )}
            </div>
          </section>

          {/* Technical trail */}
          <section>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Technical details</h3>
            <dl className="divide-y divide-surface-border rounded-xl border border-surface-border text-[12.5px]">
              <Tech label="Occurred">{fullStamp(e.occurredAt)}</Tech>
              <Tech label="Recorded">{fullStamp(e.recordedAt)}</Tech>
              <Tech label="Request reference" mono>{e.requestId ?? '—'}</Tech>
              <Tech label="Target id" mono>{e.target?.id ?? '—'}</Tech>
              <Tech label="IP address" mono>{e.ipAddress ?? '—'}</Tech>
              <Tech label="Device">{e.userAgent ?? '—'}</Tech>
            </dl>
          </section>

          <p className="flex items-center gap-1.5 text-[12px] text-muted">
            <LockIcon className="h-3.5 w-3.5" aria-hidden="true" /> This entry is permanent — it cannot be edited or deleted.
          </p>
        </div>
      )}
    </Drawer>
  );
}

/**
 * A permission change in words, not codes: added / removed when both sides
 * were recorded, otherwise the list as granted. Spans the before/after columns
 * so the names get the width they need.
 */
function PermissionRow({ before, after }) {
  const name = (p) => PERMISSION_LABELS[p] ?? p;
  const b = Array.isArray(before) ? before : null;
  const a = Array.isArray(after) ? after : [];
  const added = b ? a.filter((p) => !b.includes(p)) : null;
  const removed = b ? b.filter((p) => !a.includes(p)) : null;
  return (
    <tr className="bg-warning-50/40">
      <td className="px-3 py-2 align-top font-medium text-ink-700">Permissions</td>
      <td colSpan={2} className="px-3 py-2 align-top">
        {b ? (
          <div className="space-y-1.5">
            {added.map((p) => (
              <p key={`+${p}`} className="flex items-start gap-1.5 text-[12.5px] font-medium text-success-700">
                <span aria-hidden="true">+</span>{name(p)}<span className="sr-only"> added</span>
              </p>
            ))}
            {removed.map((p) => (
              <p key={`-${p}`} className="flex items-start gap-1.5 text-[12.5px] font-medium text-danger-700 line-through">
                <span aria-hidden="true">−</span>{name(p)}<span className="sr-only"> removed</span>
              </p>
            ))}
            {added.length === 0 && removed.length === 0 && <p className="text-[12.5px] text-muted">No change</p>}
          </div>
        ) : (
          <>
            <p className="mb-1 text-[11.5px] text-muted">Granted ({a.length}):</p>
            <ul className="flex flex-wrap gap-1.5">
              {a.map((p) => (
                <li key={p} className="rounded-md bg-white px-2 py-0.5 text-[12px] font-medium text-ink-800 ring-1 ring-inset ring-surface-border">
                  {name(p)}
                </li>
              ))}
            </ul>
          </>
        )}
      </td>
    </tr>
  );
}

function SimilarButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-1 truncate rounded-lg border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-800 shadow-sm transition-colors hover:border-primary-300 hover:text-primary-700"
    >
      {children}
    </button>
  );
}

function Tech({ label, mono = false, children }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={`min-w-0 break-all text-right text-ink-800 ${mono ? 'font-mono text-[11.5px]' : ''}`}>{children}</dd>
    </div>
  );
}
