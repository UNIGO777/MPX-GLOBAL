import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { adminApi } from '../../api/admin.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { apiError, formatDate } from '../../lib/format.js';
import { countryName } from '../../lib/countries.js';
import { DOC_TYPES_BY_ENTITY, DOC_TYPE_LABELS, ENTITY_LABELS } from '../../lib/kycDocTypes.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { inputClasses } from '../../components/ui/Field.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import {
  CheckCircleIcon,
  ChevronLeftIcon,
  DocIcon,
  ExternalIcon,
  FileIcon,
  RefreshIcon,
  ShieldIcon,
  XIcon,
} from '../../components/ui/icons.jsx';

/**
 * KYC document viewer (`kyc:view`; mockup: admin_kyc_document_viewer_states).
 * GET /employee/orgs/:id/kyc/documents — :id is the ORG id, and every call is
 * audit-recorded server-side (the access note below is true, not theatre).
 * Signed URLs live ~120s: an expired preview flips to a Reload overlay that
 * re-fetches the whole set (each fetch = one audit row, which is correct — a
 * reload IS another access). PDFs render in an iframe, images in an <img>;
 * anything else gets an open-in-tab link.
 *
 * Verify/Reject: same employee endpoints as the queue, permission-gated per
 * side; a decision here is only offered while the org is `submitted`.
 */
/**
 * Cloudinary's `private_download_url` has NO extension in the path — it is
 *   .../image/download?...&format=pdf&...&signature=...
 * so sniffing the path sent every document to the "can't be previewed" branch.
 * Read the `format` param first; fall back to a path extension for any other
 * URL shape (a direct asset URL, or a future storage provider).
 */
const IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];

function fileFormat(url) {
  if (!url) return null;
  const fromParam = /[?&]format=([a-z0-9]+)/i.exec(url);
  if (fromParam) return fromParam[1].toLowerCase();
  const fromPath = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url);
  return fromPath ? fromPath[1].toLowerCase() : null;
}

const isImage = (url) => IMAGE_FORMATS.includes(fileFormat(url));
const isPdf = (url) => fileFormat(url) === 'pdf';

export function KycViewer() {
  const { orgId } = useParams();
  const { user: me } = useAuth();
  const [selected, setSelected] = useState(0);
  const [expired, setExpired] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [decidedNote, setDecidedNote] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [showSuperseded, setShowSuperseded] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [reason, setReason] = useState('');
  // Applicant name / country / submitted date live on the org record, not on
  // the KYC payload. Needs `organisation:read`, so it degrades to blank cells.

  /**
   * TanStack Query rather than a fetch in an effect (`web-frontend.md`).
   *
   * The org detail is supporting context — its failure must degrade the header,
   * never blank the document viewer — hence `allSettled` and rethrowing only
   * the documents' own failure.
   *
   * ⚠️ `staleTime: 0` and no background refetch: these are SIGNED URLs that
   * expire in ~120s, so a silently re-served cached payload would show a
   * moderator dead images. Reloading is explicit, via the Reload overlay.
   */
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'kyc', orgId],
    queryFn: async () => {
      const [kyc, detail] = await Promise.allSettled([
        adminApi.orgKycDocuments(orgId),
        adminApi.getOrg(orgId),
      ]);
      if (kyc.status === 'rejected') throw kyc.reason;
      return { data: kyc.value, org: detail.status === 'fulfilled' ? detail.value : null };
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const data = query.data?.data ?? null;
  const org = query.data?.org ?? null;
  const loading = query.isLoading;
  const error = query.error ? apiError(query.error) : null;
  const load = useCallback(async () => {
    setExpired(false);
    setSelected(0);
    await query.refetch();
  }, [query]);

  // Flip to the Reload overlay when the earliest signed URL dies (~120s).
  useEffect(() => {
    if (!data?.documents?.length) return undefined;
    const soonest = Math.min(...data.documents.map((d) => new Date(d.expiresAt).getTime()));
    const ms = soonest - Date.now();
    // An ALREADY-expired URL used to flip the flag synchronously here, which is
    // a cascading render. A zero-delay timer reaches the same state on the next
    // tick — indistinguishable to the moderator, and one render cheaper.
    const t = setTimeout(() => setExpired(true), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [data]);

  // Superseded documents are history — hidden behind a toggle (2026-08-19).
  const allDocs = data?.documents ?? [];
  const supersededDocs = allDocs.filter((d) => d.superseded);
  const docs = showSuperseded ? allDocs : allDocs.filter((d) => !d.superseded);
  const doc = docs[selected] ?? null;

  const decidableSide = data?.exporterSide ? 'exporter' : data?.buyerSide ? 'buyer' : null;
  const sidePath = decidableSide === 'exporter' ? 'exporters' : 'buyers';
  const hasReviewPerm =
    decidableSide && can(me, decidableSide === 'exporter' ? 'exporter:verify' : 'buyer:approve');
  // What this screen is deciding: a first-time submission, or a verified
  // company's pending profile change (2026-08-19). Never both — the states
  // are mutually exclusive by construction.
  const reviewMode =
    data?.kycStatus === 'submitted'
      ? 'first'
      : data?.pendingChanges?.state === 'awaiting_review'
        ? 'change'
        : null;
  const canDecide = Boolean(reviewMode) && hasReviewPerm;
  const canRevoke = data?.kycStatus === 'verified' && hasReviewPerm;
  const openRequests = (data?.documentRequests ?? []).filter((r) => !r.fulfilledAt);

  const decide = async (action, reasonText) => {
    setActionError(null);
    setProcessing(true);
    try {
      if (reviewMode === 'change') {
        if (action === 'approve') await adminApi.approveChange(sidePath, orgId);
        else await adminApi.rejectChange(sidePath, orgId, reasonText);
        setDecidedNote(
          action === 'approve'
            ? 'Changes approved — the new details are live and the tick continues.'
            : 'Changes rejected — the company sees your reason; its live profile is unchanged.',
        );
        await query.refetch(); // the diff, documents and rounds all moved
      } else {
        if (decidableSide === 'exporter') {
          if (action === 'approve') await adminApi.verifyExporter(orgId);
          else await adminApi.rejectExporter(orgId, reasonText);
        } else if (action === 'approve') await adminApi.approveBuyer(orgId);
        else await adminApi.rejectBuyer(orgId, reasonText);
        setDecidedNote(action === 'approve' ? 'Approved — the verified tick is now live.' : 'Rejected — the applicant sees your reason and can resubmit.');
        // Reflect the decision in the query cache — the single source of truth
        // for this screen now — instead of a parallel copy that a refetch would
        // silently overwrite.
        qc.setQueryData(['admin', 'kyc', orgId], (prev) =>
          (prev?.data
            ? { ...prev, data: { ...prev.data, kycStatus: action === 'approve' ? 'verified' : 'rejected' } }
            : prev));
      }
      setRejectOpen(false);
      setReason('');
    } catch (err) {
      const e = apiError(err, 'Could not record the decision.');
      if (e.status === 409) {
        setDecidedNote('This company is no longer awaiting review — another reviewer decided it.');
        setRejectOpen(false);
      } else setActionError(e);
    } finally {
      setProcessing(false);
    }
  };

  const reasonValid = reason.trim().length >= 3 && reason.trim().length <= 500;

  const [requestTypes, setRequestTypes] = useState([]);
  const effectiveEntity = data?.pendingChanges?.requested?.entityType ?? data?.entityType ?? null;
  const requestableTypes = effectiveEntity
    ? DOC_TYPES_BY_ENTITY[effectiveEntity]
    : [...new Set(Object.values(DOC_TYPES_BY_ENTITY).flat())];

  const submitRequest = async () => {
    setActionError(null);
    setProcessing(true);
    try {
      await adminApi.requestKycDocuments(sidePath, orgId, { docTypes: requestTypes, note: reason.trim() });
      setDecidedNote('Documents requested — the company sees your note on its verification page.');
      setRequestOpen(false);
      setRequestTypes([]);
      setReason('');
      await query.refetch();
    } catch (err) {
      setActionError(apiError(err, 'Could not request documents.'));
    } finally {
      setProcessing(false);
    }
  };

  const submitRevoke = async () => {
    setActionError(null);
    setProcessing(true);
    try {
      await adminApi.revokeVerification(sidePath, orgId, reason.trim());
      setDecidedNote('Verification revoked — the tick is withdrawn and the company is back in the review queue.');
      setRevokeOpen(false);
      setReason('');
      await query.refetch();
    } catch (err) {
      setActionError(apiError(err, 'Could not revoke the verification.'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AdminLayout>
      {/* --- floating action bar (M2 language): the decision is never a
          scroll away. Name / country / submitted come from the org record,
          which needs `organisation:read` — a reviewer holding only `kyc:view`
          still sees the documents, just with those cells blank. */}
      <div className="sticky top-0 z-20 mb-5 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-white/95 px-4 py-2.5 shadow-lift backdrop-blur">
          <div className="min-w-0">
            <Link
              to="/admin/verification"
              className="flex items-center gap-1 text-xs font-medium text-muted hover:text-primary-700"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" /> Verification queue
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="max-w-[36ch] truncate text-lg font-bold leading-tight text-ink-900">
                {org?.header?.name ?? 'KYC documents'}
              </h1>
              {data && <StatusChip status={data.kycStatus} />}
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
              {[
                data?.entityType ? ENTITY_LABELS[data.entityType] : null,
                countryName(org?.company?.country),
                org?.verification?.submittedAt
                  ? `Sent ${formatDate(org.verification.submittedAt)}`
                  : null,
                `${docs.length} file${docs.length === 1 ? '' : 's'}`,
              ]
                .filter(Boolean)
                .map((part, i) => (
                  <span key={part} className="flex items-center gap-2">
                    {i > 0 && <span aria-hidden="true" className="text-ink-300">·</span>}
                    {part}
                  </span>
                ))}
            </p>
          </div>
          {canDecide && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="dangerOutline"
                disabled={processing}
                onClick={() => {
                  setReason('');
                  setRejectOpen(true);
                }}
              >
                <XIcon className="h-4 w-4" /> {reviewMode === 'change' ? 'Reject changes' : 'Reject'}
              </Button>
              <Button size="sm" variant="success" loading={processing} onClick={() => decide('approve')}>
                <CheckCircleIcon className="h-4 w-4" />
                {reviewMode === 'change' ? 'Approve changes' : decidableSide === 'exporter' ? 'Verify' : 'Approve'}
              </Button>
            </div>
          )}
          {!canDecide && hasReviewPerm && data && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setReason(''); setRequestOpen(true); }}>
                Request documents
              </Button>
              {canRevoke && (
                <Button size="sm" variant="dangerOutline" onClick={() => { setReason(''); setRevokeOpen(true); }}>
                  Revoke verification
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* The old → new diff the change decision is about — beside the docs. */}
      {data?.pendingChanges && (
        <div className="mb-4 rounded-xl border border-primary-100 bg-primary-50/50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-800">
            Requested profile change · {data.pendingChanges.state === 'awaiting_review' ? 'awaiting review' : data.pendingChanges.state.replace('_', ' ')}
          </p>
          <dl className="mt-2 space-y-1">
            {data.pendingChanges.changedFields.map((f) => {
              const fmt = (v) =>
                f === 'address'
                  ? Object.values(v ?? {}).filter((x) => typeof x === 'string' && x).join(', ') || '—'
                  : String(v ?? '—');
              return (
                <div key={f} className="flex flex-wrap items-baseline gap-2 text-[13px]">
                  <dt className="font-semibold capitalize text-ink-800">{f === 'entityType' ? 'Entity type' : f}:</dt>
                  <dd className="text-ink-700">
                    <span className="line-through decoration-ink-300">{fmt(data.pendingChanges.current?.[f])}</span>
                    <span aria-hidden="true" className="mx-1 text-ink-400">→</span>
                    <span className="font-medium text-ink-900">{fmt(data.pendingChanges.requested?.[f])}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}

      {/* Open document requests — what was asked and whether it arrived. */}
      {openRequests.length > 0 && (
        <div className="mb-4 rounded-xl border border-warning-200 bg-warning-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-warning-800">Open document requests</p>
          <ul className="mt-1.5 space-y-1">
            {openRequests.map((r) => (
              <li key={r.id} className="text-[13px] text-ink-700">
                <span className="font-semibold">{r.docTypes.join(', ')}</span> — {r.note}
                <span className="ml-2 text-xs text-muted">({formatDate(r.requestedAt)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {decidedNote && (
        <div className="mb-4">
          <Alert tone="info">{decidedNote}</Alert>
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

      {loading && (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-surface-border bg-white shadow-card">
          <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />
        </div>
      )}

      {!loading && !error && docs.length === 0 && (
        <div className="rounded-2xl border border-surface-border bg-white shadow-card">
          <EmptyState icon={DocIcon} title="No documents">
            This company hasn&apos;t uploaded any KYC documents yet.
          </EmptyState>
        </div>
      )}

      {!loading && !error && docs.length > 0 && (
        <>
          <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            {/* Document list */}
            <div>
              <h2 className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
                Documents ({docs.length})
                {supersededDocs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setShowSuperseded((v) => !v); setSelected(0); }}
                    className="font-semibold normal-case tracking-normal text-primary-700 hover:underline"
                  >
                    {showSuperseded ? 'Hide previous' : `Show previous (${supersededDocs.length})`}
                  </button>
                )}
              </h2>
              <ul className="mt-3 space-y-3">
                {docs.map((d, i) => {
                  const on = selected === i;
                  return (
                    <li key={`${d.docType}-${d.uploadedAt}-${i}`}>
                      <button
                        type="button"
                        onClick={() => setSelected(i)}
                        aria-current={on || undefined}
                        className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                          on
                            ? 'border-primary-600 bg-white ring-1 ring-primary-600'
                            : 'border-surface-border bg-white hover:border-ink-400'
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                            on ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-500'
                          }`}
                        >
                          <FileIcon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-bold text-ink-900">
                            {DOC_TYPE_LABELS[d.docType] ?? d.docType}
                          </span>
                          <span className="block text-[13px] text-muted">
                            Uploaded {formatDate(d.uploadedAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-ink-100 p-4 text-[13px] leading-relaxed text-muted">
                <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0" />
                These documents are private. Your access to them is recorded for auditing.
              </p>
            </div>

            {/* Preview */}
            <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-3">
                <span className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
                  <FileIcon className="h-4 w-4 text-ink-500" />
                  {doc ? (DOC_TYPE_LABELS[doc.docType] ?? doc.docType) : ''}
                </span>
                {doc && !expired && (
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-9 items-center gap-2 rounded-lg border border-surface-border px-4 text-sm font-semibold text-ink-900 hover:bg-ink-50"
                  >
                    <ExternalIcon className="h-4 w-4" /> Open in new tab
                  </a>
                )}
              </div>

              <div className="relative min-h-[420px] bg-ink-50">
                {expired ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
                    <RefreshIcon className="h-8 w-8 text-ink-400" />
                    <h3 className="mt-3 text-base font-semibold text-ink-900">
                      This preview has expired
                    </h3>
                    <p className="mt-1 max-w-sm text-sm text-muted">
                      Document links only live for a couple of minutes. Reload to fetch fresh ones —
                      the access is recorded again.
                    </p>
                    <Button variant="secondary" size="sm" className="mt-4" onClick={load}>
                      <RefreshIcon className="h-4 w-4" /> Reload document
                    </Button>
                  </div>
                ) : doc && isImage(doc.signedUrl) ? (
                  <img
                    src={doc.signedUrl}
                    alt={`${DOC_TYPE_LABELS[doc.docType] ?? doc.docType} document`}
                    className="mx-auto max-h-[70vh] w-auto max-w-full p-4"
                  />
                ) : doc && isPdf(doc.signedUrl) ? (
                  <iframe
                    src={doc.signedUrl}
                    title={DOC_TYPE_LABELS[doc.docType] ?? doc.docType}
                    className="h-[70vh] w-full"
                  />
                ) : doc ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
                    <FileIcon className="h-8 w-8 text-ink-400" />
                    <h3 className="mt-3 text-base font-semibold text-ink-900">
                      This file can&apos;t be previewed here
                    </h3>
                    <a
                      href={doc.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-primary-800 px-4 text-sm font-semibold text-primary-800 hover:bg-primary-50"
                    >
                      <ExternalIcon className="h-4 w-4" /> Open in a new tab
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

        </>
      )}

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={`Reject verification for ${org?.header?.name ?? 'this company'}?`}
        danger
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!reasonValid}
              loading={processing}
              onClick={() => decide('reject', reason.trim())}
            >
              Reject with reason
            </Button>
          </>
        }
      >
        <label htmlFor="kyc-reject-reason" className="block text-sm font-semibold text-ink-900">
          Reason for rejection
        </label>
        <textarea
          id="kyc-reject-reason"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="Say exactly what was wrong and what to send instead."
          className={inputClasses(false, 'mt-2 h-auto py-2')}
        />
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
          <span>This is shown to the applicant — explain what they should fix.</span>
          <span>{reason.trim().length} / 500</span>
        </div>
      </Modal>

      {/* Request documents — the note is SHOWN TO THE COMPANY. */}
      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title={`Request documents from ${org?.header?.name ?? 'this company'}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRequestOpen(false)}>Cancel</Button>
            <Button
              disabled={requestTypes.length === 0 || !reasonValid}
              loading={processing}
              onClick={submitRequest}
            >
              Send request
            </Button>
          </>
        }
      >
        <p className="text-sm font-semibold text-ink-900">Which documents?</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {requestableTypes.map((t) => (
            <label key={t} className="flex items-center gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-800">
              <input
                type="checkbox"
                checked={requestTypes.includes(t)}
                onChange={(e) =>
                  setRequestTypes((cur) => (e.target.checked ? [...cur, t] : cur.filter((x) => x !== t)))
                }
                className="h-4 w-4 rounded border-surface-border text-primary-600 focus:ring-primary-300"
              />
              {DOC_TYPE_LABELS[t] ?? t}
            </label>
          ))}
        </div>
        <label htmlFor="kyc-request-note" className="mt-4 block text-sm font-semibold text-ink-900">
          Why you need them
        </label>
        <textarea
          id="kyc-request-note"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="e.g. The GST certificate on file is blurry — please upload a readable copy."
          className={inputClasses(false, 'mt-2 h-auto py-2')}
        />
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
          <span>This note is shown to the company on its verification page.</span>
          <span>{reason.trim().length} / 500</span>
        </div>
      </Modal>

      {/* Revoke — the counterpart of approve; mandatory reason, tick withdrawn. */}
      <Modal
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        title={`Revoke verification for ${org?.header?.name ?? 'this company'}?`}
        danger
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevokeOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={!reasonValid} loading={processing} onClick={submitRevoke}>
              Revoke verification
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-700">
          The verified tick is withdrawn immediately and the company returns to the review queue
          with its documents. Its profile and products stay live — this removes trust marking, not
          the company.
        </p>
        <label htmlFor="kyc-revoke-reason" className="mt-4 block text-sm font-semibold text-ink-900">
          Reason
        </label>
        <textarea
          id="kyc-revoke-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="Say what changed — the company reads this."
          className={inputClasses(false, 'mt-2 h-auto py-2')}
        />
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
          <span>Shown to the company, never public. Recorded in the audit log.</span>
          <span>{reason.trim().length} / 500</span>
        </div>
      </Modal>
    </AdminLayout>
  );
}
