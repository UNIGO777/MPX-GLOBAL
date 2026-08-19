import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from '../../api/admin.js';
import { actionLabel, actionTone } from '../../lib/auditFormat.js';
import { adminCatalogueApi, adminCatalogueKeys } from '../../api/adminCatalogue.js';
import { Combobox } from '../../components/ui/Combobox.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { ListIcon, XIcon } from '../../components/ui/icons.jsx';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';

/**
 * M2 web screen 11 — the audit log viewer (`/admin/audit`).
 *
 * 🔴 STRICTLY READ-ONLY. There is no edit control, no delete, no "clean up", no
 * archive and NO EXPORT anywhere on this screen — and there must never be. Audit
 * records are append-only at the database level (tracker C10); an interface that
 * implies otherwise is wrong even if the server would refuse it.
 *
 * 🔴 `target.name` IS NULLABLE and that is honest. Most actions never recorded a
 * name — a takedown stores its reason, a publish stores its status — so a target
 * that has since been deleted may have none. Render "—". Never invent one.
 *
 * A PURGED product's row is self-contained: the row is gone, so the entry's own
 * snapshot (§A8: product name + seller company) is all that survives. Those rows
 * therefore render as plain text, never as a link to something that no longer
 * exists.
 */
const PAGE_SIZE = 20; // the server caps this route at 50


function timestamp(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * before/after as readable rows, not raw JSON — the design shows
 * "Status: Live → Live · Taken down", which a non-developer can act on.
 * Values are already redacted at the WRITE site (m5-rules §4 forbids KYC, tokens
 * or contact details entering an audit row), so nothing needs filtering here.
 */
function present(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
const LABELS = { status: 'Status', reason: 'Reason', name: 'Name', slug: 'Web address', active: 'Active', kycStatus: 'Verification' };
function diffRows(before, after) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  return keys.map((k) => ({
    field: LABELS[k] ?? k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
    from: present(before?.[k]),
    to: present(after?.[k]),
  }));
}

/**
 * The targets an audit row can carry. Not read from the server: there is no
 * endpoint that enumerates them, and an allowlist here is better than a free
 * text box that 400s on a typo. Add to this when a new entity starts writing
 * audit rows.
 */
const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'Any target' },
  { value: 'Organisation', label: 'Organisation' },
  { value: 'User', label: 'User' },
  { value: 'Product', label: 'Product' },
  { value: 'Conversation', label: 'Conversation' },
  { value: 'Category', label: 'Category' },
];

export function AuditLog() {
  const [params, setParams] = useSearchParams();
  const [openId, setOpenId] = useState(null);

  const action = params.get('action') ?? '';
  /**
   * An organisation filter arrives from the Organisation detail's "Open full
   * record". The endpoint indexes `orgId` precisely because a company's history
   * is NOT expressible as entityType+entityId — a product takedown carries
   * entityType 'Product' with the exporter's orgId, so filtering by target
   * would miss most of a company's own record (audit.validators.js).
   */
  const orgId = params.get('orgId') ?? '';
  /**
   * §6 lists FOUR filters — actor · action · date range · target — and only the
   * middle two were built. The endpoint has always accepted `actorId`, and a
   * target as the PAIR `entityType` + `entityId` (the pair is what makes it an
   * index lookup, so `entityId` alone is a 400).
   *
   * The actor is a picker, not an id box: nobody types an ObjectId from memory,
   * and the set of possible actors is exactly the staff list.
   */
  const actorId = params.get('actorId') ?? '';
  const entityType = params.get('entityType') ?? '';
  const entityId = params.get('entityId') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  // An inverted range is a 400 from the server (deliberately — an empty page
  // would read as "no activity", the opposite of the truth). Catch it here so
  // the screen explains rather than showing a bare error.
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

  /**
   * Everyone who can act. Staff only — a buyer or exporter never writes an audit
   * row, so listing them would be a picker full of names that can never match.
   */
  const staff = useQuery({
    queryKey: ['admin', 'users', { role: 'employee,superadmin', pageSize: 100 }],
    queryFn: () => adminApi.listUsers({ role: 'employee,superadmin', pageSize: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const actorOptions = [
    { value: '', label: 'Any actor' },
    ...(staff.data?.rows ?? []).map((u) => ({ value: u.id, label: `${u.name} · ${u.role}` })),
  ];

  const list = useQuery({
    queryKey: adminCatalogueKeys.audit(query),
    queryFn: () => adminCatalogueApi.audit(query),
    enabled: !inverted,
    placeholderData: (prev) => prev,
  });

  const entry = useQuery({
    queryKey: adminCatalogueKeys.auditEntry(openId),
    queryFn: () => adminCatalogueApi.auditEntry(openId),
    enabled: Boolean(openId),
  });

  const setFilter = (patch) => {
    const next = { ...Object.fromEntries(params), ...patch, page: '1' };
    for (const k of Object.keys(next)) if (!next[k]) delete next[k];
    setParams(next);
  };

  const rows = list.data?.entries ?? [];
  const total = list.data?.total ?? 0;
  const hasFilters = Boolean(action || from || to || orgId || actorId || entityType || entityId);

  return (
    <AdminLayout>
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold text-ink-900">Audit log</h1>
          {list.isSuccess && (
            <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
              {total.toLocaleString()} entries
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          Every governance and catalogue action, oldest preserved. This record is append-only.
        </p>
      </div>

      <div className="mb-5 rounded-2xl border border-surface-border bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-48">
            <Field label="From">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  className={inputClasses(false)}
                  value={from}
                  onChange={(e) => setFilter({ from: e.target.value })}
                />
              )}
            </Field>
          </div>
          <div className="w-full sm:w-48">
            <Field label="To">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  className={inputClasses(inverted)}
                  value={to}
                  onChange={(e) => setFilter({ to: e.target.value })}
                />
              )}
            </Field>
          </div>
          <div className="min-w-[200px] flex-1">
            <Field label="Action" helper="Exact match, e.g. product.takedown">
              {(id) => (
                <input
                  id={id}
                  className={inputClasses(false)}
                  placeholder="All actions"
                  defaultValue={action}
                  onKeyDown={(e) => e.key === 'Enter' && setFilter({ action: e.currentTarget.value })}
                  onBlur={(e) => e.target.value !== action && setFilter({ action: e.target.value })}
                />
              )}
            </Field>
          </div>
          <div className="min-w-[200px] flex-1">
            <Field label="Actor">
              {(id) => (
                <Combobox
                  id={id}
                  value={actorId}
                  placeholder="Any actor"
                  options={actorOptions}
                  onChange={(v) => setFilter({ actorId: v })}
                />
              )}
            </Field>
          </div>
          <div className="w-full sm:w-44">
            <Field label="Target type">
              {(id) => (
                <Combobox
                  id={id}
                  value={entityType}
                  placeholder="Any target"
                  options={ENTITY_TYPE_OPTIONS}
                  onChange={(v) => setFilter({ entityType: v, ...(v ? {} : { entityId: '' }) })}
                />
              )}
            </Field>
          </div>
          <div className="min-w-[200px] flex-1">
            {/* 🔴 Disabled until a type is chosen: `entityId` without
                `entityType` is a 400 by design — the index is the PAIR, and an
                id alone would scan every collection. */}
            <Field
              label="Target ID"
              helper={entityType ? 'Paste the id' : 'Pick a target type first'}
            >
              {(id) => (
                <input
                  id={id}
                  disabled={!entityType}
                  className={inputClasses(false)}
                  placeholder={entityType ? `${entityType} id` : '—'}
                  defaultValue={entityId}
                  onKeyDown={(e) => e.key === 'Enter' && setFilter({ entityId: e.currentTarget.value.trim() })}
                  onBlur={(e) => e.target.value.trim() !== entityId && setFilter({ entityId: e.target.value.trim() })}
                />
              )}
            </Field>
          </div>
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={() => setParams({})}>Clear filters</Button>
          )}
        </div>

        {/* There is no organisation picker on this screen, so a scoped record
            has to announce itself — otherwise one company's history is
            indistinguishable from the whole platform's. */}
        {orgId && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-[12px] font-medium text-primary-800 ring-1 ring-inset ring-primary-100">
              One company&apos;s record
              <Link
                to={`/admin/organisations/${orgId}`}
                className="font-semibold text-primary-700 hover:underline"
              >
                open company
              </Link>
              <button
                type="button"
                onClick={() => setFilter({ orgId: '' })}
                aria-label="Show the whole platform's record"
                className="rounded-full p-0.5 text-primary-600 hover:bg-primary-100 hover:text-primary-800"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        )}
        {inverted && (
          <p className="mt-3 text-sm text-danger" role="alert">
            The end date is before the start date — no window to search.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {list.isPending && !inverted && <SkeletonRows rows={8} />}
        {list.isError && (
          <ErrorState
            title="We couldn't load the audit log"
            requestId={list.error?.response?.data?.error?.requestId}
            onRetry={list.refetch}
          />
        )}

        {list.isSuccess && total === 0 && (
          <EmptyState
            icon={ListIcon}
            title="No activity in this period"
            action={hasFilters ? <Button variant="secondary" onClick={() => setParams({})}>Clear filters</Button> : undefined}
          >
            {hasFilters ? 'Nothing was recorded with those filters.' : 'Nothing has been recorded yet.'}
          </EmptyState>
        )}

        {list.isSuccess && total > 0 && (
          <>
            {/* Phones get CARDS, not a sideways-scrolling table. Same tap →
                drawer behaviour; real buttons, so keyboard access is native. */}
            <ul className="divide-y divide-surface-border md:hidden">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(row.id)}
                    className="w-full p-4 text-left transition-colors hover:bg-surface-subtle/60"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${actionTone(row.action)}`}
                      >
                        {actionLabel(row.action)}
                      </span>
                      <span className="text-[11px] text-muted">{timestamp(row.occurredAt)}</span>
                    </div>
                    <p className="mt-2 text-sm">
                      <span className="font-medium text-ink-900">{row.actor?.name ?? 'Unknown'}</span>
                      {row.actor?.role && <span className="text-muted"> · {row.actor.role}</span>}
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink-700">
                      {row.target?.name ?? '—'}
                      {row.target?.type && <span className="text-muted"> · {row.target.type}</span>}
                    </p>
                    {row.reason && (
                      <p className="mt-1 line-clamp-2 text-[13px] text-muted">{row.reason}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="bg-ink-50 text-left text-xs uppercase tracking-wide text-muted">
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">When</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Actor</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Action</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Target</th>
                    <th className="border-b border-surface-border px-4 py-3 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      // Keyboard-openable: rows are the only path to the detail
                      // drawer, so a mouse must not be a requirement.
                      tabIndex={0}
                      role="button"
                      aria-label={`Open audit entry: ${actionLabel(row.action)}`}
                      onClick={() => setOpenId(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setOpenId(row.id);
                        }
                      }}
                      className="cursor-pointer transition-colors hover:bg-surface-subtle/60 focus-visible:bg-surface-subtle/60 focus-visible:outline-none"
                    >
                      <td className="whitespace-nowrap border-b border-surface-border px-4 py-3 text-ink-600">
                        {timestamp(row.occurredAt)}
                      </td>
                      <td className="border-b border-surface-border px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-bold text-primary-700"
                          >
                            {(row.actor?.name ?? '?')
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((w) => w[0].toUpperCase())
                              .join('') || '?'}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink-900">
                              {row.actor?.name ?? 'Unknown'}
                            </p>
                            {row.actor?.role && (
                              <p className="text-xs text-muted">{row.actor.role}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap border-b border-surface-border px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${actionTone(row.action)}`}
                        >
                          {actionLabel(row.action)}
                        </span>
                      </td>
                      <td className="border-b border-surface-border px-4 py-3">
                        {/* Plain text, never a link — the target may have been
                            purged, and a link to a deleted row is a dead end. */}
                        <span className="text-ink-800">{row.target?.name ?? '—'}</span>
                        {row.target?.type && (
                          <span className="ml-1.5 text-xs text-muted">{row.target.type}</span>
                        )}
                      </td>
                      <td className="max-w-[280px] border-b border-surface-border px-4 py-3 text-ink-600">
                        <span className="line-clamp-2">{row.reason ?? '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPage={(n) => setParams({ ...Object.fromEntries(params), page: String(n) })}
            />
          </>
        )}
      </div>

      {/* Read-only detail. No action buttons of any kind. */}
      <Drawer
        open={Boolean(openId)}
        onClose={() => setOpenId(null)}
        title="Audit entry"
        subtitle={entry.data ? actionLabel(entry.data.action) : undefined}
      >
        {entry.isPending && <SkeletonRows rows={4} />}
        {entry.data && (
          <dl className="space-y-3 text-sm">
            {[
              ['When', timestamp(entry.data.occurredAt)],
              ['Actor', `${entry.data.actor?.name ?? 'Unknown'}${entry.data.actor?.role ? ` · ${entry.data.actor.role}` : ''}`],
              ['Target', entry.data.target?.name ?? entry.data.target?.id ?? '—'],
              ['Type', entry.data.target?.type ?? '—'],
              ['Reason', entry.data.reason ?? '—'],
              ['Reference', entry.data.requestId ?? '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-surface-border pb-2">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-medium text-ink-900">{value}</dd>
              </div>
            ))}
            {(entry.data.before || entry.data.after) && (
              <div className="pt-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  Recorded changes
                </p>
                <div className="space-y-2">
                  {diffRows(entry.data.before, entry.data.after).map(({ field, from, to }) => (
                    <div key={field} className="rounded-lg bg-surface-subtle p-3">
                      <p className="text-xs font-medium text-muted">{field}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-ink-500 line-through">{from}</span>
                        <span aria-hidden="true" className="text-ink-400">→</span>
                        <span className="font-medium text-ink-900">{to}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </dl>
        )}
      </Drawer>
    </AdminLayout>
  );
}
