import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { adminCatalogueApi, adminCatalogueKeys } from '../../api/adminCatalogue.js';
import { Button } from '../../components/ui/Button.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Field, inputClasses } from '../../components/ui/Field.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { ListIcon } from '../../components/ui/icons.jsx';
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

/** Turn `product.takedown` into "Product taken down". */
function actionLabel(action) {
  const [entity, ...rest] = action.split('.');
  const verb = rest.join(' ').replace(/[._]/g, ' ');
  const noun = entity.charAt(0).toUpperCase() + entity.slice(1);
  return `${noun} ${verb}`.trim();
}

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

export function AuditLog() {
  const [params, setParams] = useSearchParams();
  const [openId, setOpenId] = useState(null);

  const action = params.get('action') ?? '';
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
    page,
    pageSize: PAGE_SIZE,
  };

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
  const hasFilters = Boolean(action || from || to);

  return (
    <AdminLayout>
      <h1 className="mb-2 text-2xl font-bold text-ink-900">Audit log</h1>
      <p className="mb-6 text-sm text-muted">
        Every governance and catalogue action, oldest preserved. This record is append-only.
      </p>

      <div className="mb-5 rounded-lg border border-surface-border bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
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
          <div className="w-48">
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
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={() => setParams({})}>Clear filters</Button>
          )}
        </div>
        {inverted && (
          <p className="mt-3 text-sm text-danger" role="alert">
            The end date is before the start date — no window to search.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
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
                      onClick={() => setOpenId(row.id)}
                      className="cursor-pointer hover:bg-surface-subtle"
                    >
                      <td className="whitespace-nowrap border-b border-surface-border px-4 py-3 text-ink-600">
                        {timestamp(row.occurredAt)}
                      </td>
                      <td className="border-b border-surface-border px-4 py-3">
                        <span className="font-medium text-ink-900">{row.actor?.name ?? 'Unknown'}</span>
                        {row.actor?.role && (
                          <span className="ml-1.5 text-xs text-muted">
                            {row.actor.role === 'system' ? '· system' : `· ${row.actor.role}`}
                          </span>
                        )}
                      </td>
                      <td className="border-b border-surface-border px-4 py-3 text-ink-800">
                        {actionLabel(row.action)}
                      </td>
                      <td className="border-b border-surface-border px-4 py-3">
                        {/* Plain text, never a link — the target may have been
                            purged, and a link to a deleted row is a dead end. */}
                        <span className="text-ink-800">{row.target?.name ?? '—'}</span>
                        {row.target?.type && (
                          <span className="ml-1.5 text-xs text-muted">{row.target.type}</span>
                        )}
                      </td>
                      <td className="border-b border-surface-border px-4 py-3 text-ink-600">
                        {row.reason ?? '—'}
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
