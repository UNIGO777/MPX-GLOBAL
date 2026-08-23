import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { adminApi } from '../../api/admin.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { apiError, formatDate } from '../../lib/format.js';
import { countryName } from '../../lib/countries.js';
import { ENTITY_LABELS } from '../../lib/kycDocTypes.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { inputClasses } from '../../components/ui/Field.jsx';
import { CheckCircleIcon, CheckIcon, DocIcon, InfoIcon, RefreshIcon } from '../../components/ui/icons.jsx';

/**
 * Verification queue (mockup: admin_verification_queue_stacked_with_modal).
 * ORG-centric — every :id sent to a decision endpoint is the ORGANISATION id
 * (the users list would duplicate multi-org companies). List needs
 * `organisation:read`; decisions need `exporter:verify` / `buyer:approve`
 * (buttons hidden without them; the server re-checks regardless).
 *
 * ⚠️ The list sorts by takedownCount then newest — "oldest first" is
 * approximated, noted in the plan. A 409 on decide means someone else got
 * there first: the card flips to "no longer awaiting review" with a refresh.
 */
const REASON_MIN = 3;
const REASON_MAX = 500;

export function VerificationQueue() {
  const { user: me } = useAuth();

  const [tab, setTab] = useState('exporter'); // 'exporter' | 'buyer'

  const [detail, setDetail] = useState({}); // orgId -> {loading, data, error}
  const [processing, setProcessing] = useState(null); // orgId mid-request
  const [actionError, setActionError] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null); // org row
  const [reason, setReason] = useState('');
  const [staleNotice, setStaleNotice] = useState(false);

  const canDecide = tab === 'exporter' ? can(me, 'exporter:verify') : can(me, 'buyer:approve');

  /**
   * TanStack Query rather than a fetch in an effect (`web-frontend.md` mandates
   * it for server data). Both sides load together because the two tabs are one
   * queue — switching tabs must not re-fetch or re-spinner.
   */
  const qc = useQueryClient();
  const queue = useQuery({
    queryKey: ['admin', 'verification', 'queue'],
    queryFn: async () => {
      // One list per side, TWO kinds in it (owner, 2026-08-19): first-time
      // submissions and change re-verifications, chipped apart on the card.
      const [exFirst, buyFirst, exChange, buyChange] = await Promise.all([
        adminApi.listOrgs({ side: 'exporter', verification: 'submitted', pageSize: 50 }),
        adminApi.listOrgs({ side: 'buyer', verification: 'submitted', pageSize: 50 }),
        adminApi.listOrgs({ side: 'exporter', verification: 'change_pending', pageSize: 50 }),
        adminApi.listOrgs({ side: 'buyer', verification: 'change_pending', pageSize: 50 }),
      ]);
      const merge = (first, change) => ({
        organisations: [
          ...(first?.organisations ?? []).map((o) => ({ ...o, kind: 'first' })),
          ...(change?.organisations ?? []).map((o) => ({ ...o, kind: 'change' })),
        ],
        total: (first?.total ?? 0) + (change?.total ?? 0),
      });
      return { exporter: merge(exFirst, exChange), buyer: merge(buyFirst, buyChange) };
    },
  });

  const lists = queue.data ?? { exporter: null, buyer: null };
  const loading = queue.isLoading;
  const error = queue.error ? apiError(queue.error) : null;
  const load = useCallback(async () => {
    setStaleNotice(false);
    await queue.refetch();
  }, [queue]);

  // Mockup cards show entity type / submitted date / doc count FLAT on the card
  // (no accordion), and the LIST view carries none of those — so each row needs
  // its own detail call. Scoped to the VISIBLE tab on purpose: fetching both
  // meant up to 100 detail requests per page load, each of which fans out to
  // users + audit + products + chats server-side. The other tab loads when it
  // is opened. A row whose detail fails still renders — dashes, never an error.
  useEffect(() => {
    const pending = (lists[tab]?.organisations ?? [])
      .filter((o) => (o.verification === 'submitted' || o.kind === 'change') && !detail[o.id]);
    if (pending.length === 0) return;
    pending.forEach(async (org) => {
      setDetail((d) => ({ ...d, [org.id]: { loading: true } }));
      try {
        const data = await adminApi.getOrg(org.id);
        setDetail((d) => ({ ...d, [org.id]: { data } }));
      } catch {
        setDetail((d) => ({ ...d, [org.id]: { failed: true } }));
      }
    });
    // `detail` is deliberately not a dependency — it is written inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists, tab]);

  const decide = async (org, action, reasonText) => {
    setActionError(null);
    setProcessing(org.id);
    try {
      const sidePath = tab === 'exporter' ? 'exporters' : 'buyers';
      if (org.kind === 'change') {
        if (action === 'approve') await adminApi.approveChange(sidePath, org.id);
        else await adminApi.rejectChange(sidePath, org.id, reasonText);
      } else if (tab === 'exporter') {
        if (action === 'approve') await adminApi.verifyExporter(org.id);
        else await adminApi.rejectExporter(org.id, reasonText);
      } else if (action === 'approve') await adminApi.approveBuyer(org.id);
      else await adminApi.rejectBuyer(org.id, reasonText);
      setStaleNotice(false);
      // Decided rows leave the queue immediately. Written into the query cache
      // rather than a parallel `useState` copy, so there is exactly one source
      // of truth for this list and a later refetch cannot resurrect the row.
      qc.setQueryData(['admin', 'verification', 'queue'], (l) =>
        (l ? {
          ...l,
          [tab]: {
            ...l[tab],
            organisations: (l[tab]?.organisations ?? []).filter((o) => o.id !== org.id),
            total: Math.max(0, (l[tab]?.total ?? 1) - 1),
          },
        } : l));
      setRejectTarget(null);
      setReason('');
    } catch (err) {
      const e = apiError(err, 'Could not record the decision.');
      if (e.status === 409) {
        // Someone else decided while this card sat open.
        setStaleNotice(true);
        setRejectTarget(null);
        setReason('');
      } else {
        setActionError(e);
      }
    } finally {
      setProcessing(null);
    }
  };

  const current = lists[tab];
  const rows = (current?.organisations ?? []).filter((o) => o.verification === 'submitted');
  const counts = {
    exporter: lists.exporter?.total ?? 0,
    buyer: lists.buyer?.total ?? 0,
  };

  const reasonValid = reason.trim().length >= REASON_MIN && reason.trim().length <= REASON_MAX;

  // role="tab" promises arrow-key movement and one tab stop; without it the
  // roles describe behaviour the control does not have.
  const tabRefs = useRef({});
  const onTabKeyDown = (e) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const keys = ['exporter', 'buyer'];
    const next = keys[(keys.indexOf(tab) + delta + keys.length) % keys.length];
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <AdminLayout>
      <div className="mb-5">
        <h1 className="text-2xl font-bold leading-tight text-ink-900">Verification queue</h1>
        <p className="mt-1 text-sm text-muted">
          Review submitted documents and decide who gets a verified tick.
        </p>
      </div>

      {/* Stat tiles ARE the tabs (M2 language, 2026-08-11) — same tablist
          semantics and arrow-key behaviour as the underline strip they replace. */}
      <div
        role="tablist"
        aria-label="Queue"
        onKeyDown={onTabKeyDown}
        className="grid grid-cols-2 gap-3 sm:max-w-[440px]"
      >
        {[
          { key: 'exporter', label: 'Exporters to verify' },
          { key: 'buyer', label: 'Buyers to verify' },
        ].map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              ref={(el) => (tabRefs.current[t.key] = el)}
              role="tab"
              id={`queue-tab-${t.key}`}
              aria-controls="queue-panel"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setTab(t.key)}
              className={`rounded-xl border p-3.5 text-left transition-all ${
                on
                  ? 'border-primary-600 bg-primary-50 shadow-card ring-1 ring-primary-600'
                  : 'border-surface-border bg-white hover:border-primary-400 hover:shadow-card'
              }`}
            >
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                {t.label}
              </span>
              <span className="mt-0.5 block text-2xl font-bold leading-tight text-ink-900">
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* The panel the tabs control — labelled by whichever tab is selected. */}
      <div id="queue-panel" role="tabpanel" aria-labelledby={`queue-tab-${tab}`}>
      <p className="mb-4 mt-4 text-sm text-muted">
        {rows.length} {tab === 'exporter' ? 'exporter' : 'buyer'}
        {rows.length === 1 ? '' : 's'} awaiting review
      </p>

      {/* A 409 means someone else decided while this page was open. */}
      {staleNotice && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-border bg-white px-5 py-4 shadow-card">
          <div className="flex items-start gap-3">
            <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" />
            <div>
              <p className="text-[15px] font-semibold text-ink-900">
                This account is no longer awaiting review
              </p>
              <p className="mt-0.5 text-sm text-muted">
                Someone else has already decided on it. Refresh to update the queue.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={load}>
            <RefreshIcon className="h-4 w-4" /> Refresh
          </Button>
        </div>
      )}

      {actionError && (
        <div className="mb-4">
          <Alert tone="danger">
            {actionError.message}
            {actionError.requestId && (
              <span className="ml-2 font-mono text-xs opacity-70">{actionError.requestId}</span>
            )}
          </Alert>
        </div>
      )}

      <div className="space-y-4">
        {loading && (
          <div className="rounded-2xl border border-surface-border bg-white shadow-card">
            <SkeletonRows rows={4} />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-surface-border bg-white shadow-card">
            <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-2xl border border-surface-border bg-white shadow-card">
            <EmptyState icon={CheckCircleIcon} title="Nothing to review">
              Every {tab === 'exporter' ? 'exporter' : 'buyer'} in the queue has been reviewed. New
              submissions will appear here as they arrive.
            </EmptyState>
          </div>
        )}

        {!loading &&
          !error &&
          rows.map((org) => {
            const d = detail[org.id];
            const meta = [
              { k: 'Country', v: countryName(org.country) || '—' },
              {
                k: 'Entity type',
                v: d?.data ? (ENTITY_LABELS[d.data.company?.entityType] ?? '—') : d?.failed ? '—' : '…',
              },
              {
                k: 'Submitted',
                v: d?.data ? formatDate(d.data.verification?.submittedAt) : d?.failed ? '—' : '…',
              },
            ];
            const docCount = d?.data ? (d.data.verification?.kycDocumentCount ?? 0) : null;
            return (
              <div
                key={org.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-surface-border bg-white px-4 py-4 shadow-card sm:px-5"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-sm font-bold text-primary-700"
                  >
                    {org.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="truncate text-base font-bold text-ink-900">{org.name}</h2>
                      {org.kind === 'change' ? (
                        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                          <span className="text-[11px] font-semibold text-primary-800">Change re-verification</span>
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-warning-50 px-2.5 py-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                          <span className="text-[11px] font-semibold text-warning-800">Awaiting review</span>
                        </span>
                      )}
                    </div>
                    {/* The old → new diff a change decision is ABOUT. Verified
                        company keeps trading either way; only these move. */}
                    {org.kind === 'change' && d?.data?.pendingChanges && (
                      <dl className="mt-2 space-y-0.5 rounded-lg bg-primary-50/50 px-3 py-2">
                        {d.data.pendingChanges.changedFields.map((f) => {
                          const fmt = (v) =>
                            f === 'address'
                              ? Object.values(v ?? {}).filter((x) => typeof x === 'string' && x).join(', ') || '—'
                              : String(v ?? '—');
                          return (
                            <div key={f} className="flex flex-wrap items-baseline gap-1.5 text-[12.5px]">
                              <dt className="font-semibold capitalize text-ink-800">
                                {f === 'entityType' ? 'Entity type' : f}:
                              </dt>
                              <dd className="text-ink-600">
                                <span className="line-through decoration-ink-300">{fmt(d.data.pendingChanges.current[f])}</span>
                                <span aria-hidden="true" className="mx-1 text-ink-400">→</span>
                                <span className="font-medium text-ink-900">{fmt(d.data.pendingChanges.requested[f])}</span>
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    )}
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted">
                      {meta.map(({ k, v }, i) => (
                        <span key={k} className="flex items-center gap-2">
                          {i > 0 && <span aria-hidden="true" className="text-ink-300">·</span>}
                          <span>
                            <span className="sr-only">{k}: </span>
                            {v}
                          </span>
                        </span>
                      ))}
                      <span aria-hidden="true" className="text-ink-300">·</span>
                      <span className="flex items-center gap-1.5">
                        <DocIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {docCount === null
                          ? 'Loading documents…'
                          : `${docCount} document${docCount === 1 ? '' : 's'}`}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Phones: the cluster takes its own full-width row (a shrink-0
                    cluster beside flex-1 text overflowed the card and clipped
                    "Verify" off-screen — QA, 2026-08-14). sm+: unchanged. */}
                <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
                  {can(me, 'kyc:view') && (
                    <Link
                      to={`/admin/verification/${org.id}/kyc`}
                      className="flex h-9 w-full items-center justify-center gap-2 rounded-full border border-surface-border bg-white px-4 text-sm font-semibold text-ink-900 transition-colors hover:bg-ink-50 sm:w-auto"
                    >
                      <DocIcon className="h-4 w-4" />
                      View documents
                    </Link>
                  )}
                  {canDecide && (
                    <>
                      <Button
                        size="sm"
                        variant="dangerOutline"
                        className="flex-1 sm:flex-initial"
                        disabled={processing === org.id}
                        onClick={() => {
                          setReason('');
                          setRejectTarget(org);
                        }}
                      >
                        {org.kind === 'change' ? 'Reject changes' : 'Reject'}
                      </Button>
                      <Button
                        size="sm"
                        variant="success"
                        className="flex-1 sm:flex-initial"
                        loading={processing === org.id}
                        onClick={() => decide(org, 'approve')}
                      >
                        <CheckIcon className="h-4 w-4" />
                        {org.kind === 'change' ? 'Approve changes' : tab === 'exporter' ? 'Verify' : 'Approve'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reject modal — reason 3–500, shown to the applicant verbatim */}
      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title={
          rejectTarget?.kind === 'change'
            ? `Reject the profile changes for ${rejectTarget?.name ?? ''}?`
            : `Reject verification for ${rejectTarget?.name ?? ''}?`
        }
        danger
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!reasonValid}
              loading={processing === rejectTarget?.id}
              onClick={() => decide(rejectTarget, 'reject', reason.trim())}
            >
              Reject with reason
            </Button>
          </>
        }
      >
        <label htmlFor="reject-reason" className="block text-sm font-semibold text-ink-900">
          Reason for rejection
        </label>
        <textarea
          id="reject-reason"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={REASON_MAX}
          placeholder="Say exactly what was wrong and what to send instead."
          className={inputClasses(false, 'mt-2 h-auto py-2')}
        />
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
          <span>This is shown to the applicant — explain what they should fix.</span>
          <span>
            {reason.trim().length} / {REASON_MAX}
          </span>
        </div>
      </Modal>
    </AdminLayout>
  );
}
