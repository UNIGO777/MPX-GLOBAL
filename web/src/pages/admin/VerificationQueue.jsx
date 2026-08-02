import { useCallback, useEffect, useState } from 'react';
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
import { CheckCircleIcon, DocIcon } from '../../components/ui/icons.jsx';

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
  const [lists, setLists] = useState({ exporter: null, buyer: null });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState({}); // orgId -> {loading, data, error}
  const [decided, setDecided] = useState({}); // orgId -> 'gone' | 'approved' | 'rejected'
  const [processing, setProcessing] = useState(null); // orgId mid-request
  const [actionError, setActionError] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null); // org row
  const [reason, setReason] = useState('');

  const canDecide = tab === 'exporter' ? can(me, 'exporter:verify') : can(me, 'buyer:approve');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [exporters, buyers] = await Promise.all([
        adminApi.listOrgs({ side: 'exporter', verification: 'submitted', pageSize: 50 }),
        adminApi.listOrgs({ side: 'buyer', verification: 'submitted', pageSize: 50 }),
      ]);
      setLists({ exporter: exporters, buyer: buyers });
      setDecided({});
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Mockup cards show entity type / submitted date / doc count FLAT on the
  // card (no accordion), so each queue row's detail loads eagerly in parallel.
  // A row whose detail fails still renders — with dashes, never an error card.
  useEffect(() => {
    const pending = [...(lists.exporter?.organisations ?? []), ...(lists.buyer?.organisations ?? [])]
      .filter((o) => o.verification === 'submitted' && !detail[o.id]);
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
  }, [lists]);

  const decide = async (org, action, reasonText) => {
    setActionError(null);
    setProcessing(org.id);
    try {
      if (tab === 'exporter') {
        if (action === 'approve') await adminApi.verifyExporter(org.id);
        else await adminApi.rejectExporter(org.id, reasonText);
      } else if (action === 'approve') await adminApi.approveBuyer(org.id);
      else await adminApi.rejectBuyer(org.id, reasonText);
      setDecided((d) => ({ ...d, [org.id]: action === 'approve' ? 'approved' : 'rejected' }));
      setRejectTarget(null);
      setReason('');
    } catch (err) {
      const e = apiError(err, 'Could not record the decision.');
      if (e.status === 409) {
        // Someone else decided while this card sat open.
        setDecided((d) => ({ ...d, [org.id]: 'gone' }));
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

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900">Verification queue</h1>
        <p className="mt-1 text-sm text-muted">
          Companies whose documents are waiting for a decision.
        </p>
      </div>

      {/* Tabs — mockup labels */}
      <div role="tablist" aria-label="Queue" className="mb-4 flex gap-1 rounded-full border border-surface-border bg-white p-1 sm:w-fit">
        {[
          { key: 'exporter', label: 'Exporters to verify' },
          { key: 'buyer', label: 'Buyers to verify' },
        ].map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`h-9 rounded-full px-5 text-sm font-semibold transition-colors ${
              tab === t.key ? 'bg-primary-800 text-white' : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            {t.label}
            <span className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${tab === t.key ? 'bg-white/20' : 'bg-ink-100'}`}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

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

      <div className="max-w-5xl space-y-4">
        {loading && (
          <div className="rounded-lg border border-surface-border bg-white shadow-card">
            <SkeletonRows rows={4} />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-surface-border bg-white shadow-card">
            <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-lg border border-surface-border bg-white shadow-card">
            <EmptyState icon={CheckCircleIcon} title="Nothing to review">
              No {tab === 'exporter' ? 'exporter' : 'buyer'} submissions are waiting right now.
            </EmptyState>
          </div>
        )}

        {!loading &&
          !error &&
          rows.map((org) => {
            const state = decided[org.id];
            const d = detail[org.id];
            return (
              <div key={org.id} className="rounded-lg border border-surface-border bg-white shadow-card">
                {state ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div>
                      <p className="font-semibold text-ink-900">{org.name}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {state === 'gone'
                          ? 'This company is no longer awaiting review — another reviewer decided it.'
                          : state === 'approved'
                            ? 'Approved. The verified tick is now live.'
                            : 'Rejected. The applicant sees your reason and can resubmit.'}
                      </p>
                    </div>
                    {state === 'gone' && (
                      <Button variant="secondary" size="sm" onClick={load}>
                        Refresh queue
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Mockup card: title + amber "Awaiting review" chip, then a
                        flat meta row, actions on the right. */}
                    <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="truncate text-lg font-semibold text-ink-900">{org.name}</h3>
                          <span className="flex shrink-0 items-center gap-2 rounded bg-amber-50 px-2.5 py-1">
                            <span className="h-2 w-2 rounded-full bg-warning" />
                            <span className="text-xs font-semibold text-warning">Awaiting review</span>
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-x-12 gap-y-3">
                          {[
                            { k: 'Country', v: countryName(org.country) || '—' },
                            { k: 'Entity type', v: d?.data ? (ENTITY_LABELS[d.data.company?.entityType] ?? '—') : d?.failed ? '—' : '…' },
                            { k: 'Submitted', v: d?.data ? formatDate(d.data.verification?.submittedAt) : d?.failed ? '—' : '…' },
                          ].map(({ k, v }) => (
                            <div key={k} className="flex flex-col">
                              <span className="text-xs font-medium uppercase tracking-wide text-muted">{k}</span>
                              <span className="text-sm font-medium text-ink-900">{v}</span>
                            </div>
                          ))}
                          <div className="flex items-center gap-2">
                            <DocIcon className="h-4 w-4 text-ink-500" />
                            <span className="text-sm font-medium text-ink-900">
                              {d?.data ? `${d.data.verification?.kycDocumentCount ?? 0} documents` : d?.failed ? '— documents' : '…'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-3">
                        {can(me, 'kyc:view') && (
                          <Link
                            to={`/admin/verification/${org.id}/kyc`}
                            className="flex h-11 items-center gap-2 rounded-full border border-surface-border bg-white px-6 text-[15px] font-semibold text-ink-900 hover:bg-ink-50"
                          >
                            <DocIcon className="h-4 w-4" />
                            View documents
                          </Link>
                        )}
                        {canDecide && (
                          <>
                            <Button loading={processing === org.id} onClick={() => decide(org, 'approve')}>
                              {tab === 'exporter' ? 'Verify' : 'Approve'}
                            </Button>
                            <Button
                              variant="dangerOutline"
                              disabled={processing === org.id}
                              onClick={() => {
                                setReason('');
                                setRejectTarget(org);
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
      </div>

      {/* Reject modal — reason 3–500, shown to the applicant verbatim */}
      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title={`Reject ${rejectTarget?.name ?? ''}?`}
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
              Reject with this reason
            </Button>
          </>
        }
      >
        <label htmlFor="reject-reason" className="block text-sm font-medium text-ink-800">
          Reason
        </label>
        <textarea
          id="reject-reason"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={REASON_MAX}
          placeholder="Say exactly what was wrong and what to send instead."
          className={inputClasses(false, 'mt-1.5 h-auto py-2')}
        />
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
          <span>This is shown to the applicant, word for word.</span>
          <span>
            {reason.trim().length}/{REASON_MAX}
          </span>
        </div>
      </Modal>
    </AdminLayout>
  );
}
