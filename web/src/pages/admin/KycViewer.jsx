import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { adminApi } from '../../api/admin.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { apiError, formatDate } from '../../lib/format.js';
import { countryName } from '../../lib/countries.js';
import { DOC_TYPE_LABELS, ENTITY_LABELS } from '../../lib/kycDocTypes.js';
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

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);
  const [expired, setExpired] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [decidedNote, setDecidedNote] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  // Applicant name / country / submitted date live on the org record, not on
  // the KYC payload. Needs `organisation:read`, so it degrades to blank cells.
  const [org, setOrg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpired(false);
    try {
      const [kyc, detail] = await Promise.allSettled([
        adminApi.orgKycDocuments(orgId),
        adminApi.getOrg(orgId),
      ]);
      if (kyc.status === 'rejected') throw kyc.reason;
      setData(kyc.value);
      setOrg(detail.status === 'fulfilled' ? detail.value : null);
      setSelected(0);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  // Flip to the Reload overlay when the earliest signed URL dies (~120s).
  useEffect(() => {
    if (!data?.documents?.length) return undefined;
    const soonest = Math.min(...data.documents.map((d) => new Date(d.expiresAt).getTime()));
    const ms = soonest - Date.now();
    if (ms <= 0) {
      setExpired(true);
      return undefined;
    }
    const t = setTimeout(() => setExpired(true), ms);
    return () => clearTimeout(t);
  }, [data]);

  const docs = data?.documents ?? [];
  const doc = docs[selected] ?? null;

  const decidableSide = data?.exporterSide ? 'exporter' : data?.buyerSide ? 'buyer' : null;
  const canDecide =
    data?.kycStatus === 'submitted' &&
    decidableSide &&
    can(me, decidableSide === 'exporter' ? 'exporter:verify' : 'buyer:approve');

  const decide = async (action, reasonText) => {
    setActionError(null);
    setProcessing(true);
    try {
      if (decidableSide === 'exporter') {
        if (action === 'approve') await adminApi.verifyExporter(orgId);
        else await adminApi.rejectExporter(orgId, reasonText);
      } else if (action === 'approve') await adminApi.approveBuyer(orgId);
      else await adminApi.rejectBuyer(orgId, reasonText);
      setDecidedNote(action === 'approve' ? 'Approved — the verified tick is now live.' : 'Rejected — the applicant sees your reason and can resubmit.');
      setData((d) => (d ? { ...d, kycStatus: action === 'approve' ? 'verified' : 'rejected' } : d));
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

  return (
    <AdminLayout>
      <Link
        to="/admin/verification"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700"
      >
        <ChevronLeftIcon className="h-4 w-4" /> Back to verification queue
      </Link>

      {/* Applicant summary bar. Name / country / submitted come from the org
          record, which needs `organisation:read` — a reviewer holding only
          `kyc:view` still sees the documents, just with those cells blank. */}
      <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-surface-border bg-white px-6 py-4 shadow-sm">
        {[
          { k: 'Applicant', v: org?.header?.name },
          { k: 'Entity', v: data?.entityType ? ENTITY_LABELS[data.entityType] : null },
          { k: 'Country', v: countryName(org?.company?.country) },
          { k: 'Submitted', v: org?.verification?.submittedAt ? formatDate(org.verification.submittedAt) : null },
        ].map(({ k, v }) => (
          <div key={k} className="border-surface-border pr-8 [&:not(:last-child)]:border-r">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{k}</p>
            <p className="mt-0.5 text-[15px] font-semibold text-ink-900">{v || '—'}</p>
          </div>
        ))}
        <p className="flex items-center gap-2 text-[15px] text-ink-900">
          <DocIcon className="h-4 w-4 text-ink-500" />
          {docs.length} file{docs.length === 1 ? '' : 's'}
        </p>
        <span className="ml-auto">
          {data && <StatusChip status={data.kycStatus} />}
        </span>
      </div>

      {decidedNote && (
        <div className="mt-4">
          <Alert tone="info">{decidedNote}</Alert>
        </div>
      )}
      {actionError && (
        <div className="mt-4">
          <Alert tone="danger">
            {actionError.message}
            {actionError.requestId && (
              <span className="ml-2 font-mono text-xs opacity-70">{actionError.requestId}</span>
            )}
          </Alert>
        </div>
      )}

      {loading && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      )}

      {!loading && error && (
        <div className="mt-6 rounded-xl border border-surface-border bg-white shadow-sm">
          <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />
        </div>
      )}

      {!loading && !error && docs.length === 0 && (
        <div className="mt-6 rounded-xl border border-surface-border bg-white shadow-sm">
          <EmptyState icon={DocIcon} title="No documents">
            This company hasn&apos;t uploaded any KYC documents yet.
          </EmptyState>
        </div>
      )}

      {!loading && !error && docs.length > 0 && (
        <>
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-[320px_1fr]">
            {/* Document list */}
            <div>
              <h2 className="text-lg font-bold text-ink-900">Documents ({docs.length})</h2>
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
            <div className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-sm">
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

          {/* Decision bar (design puts it under both columns) */}
          {canDecide && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-surface-border bg-white px-6 py-4 shadow-sm">
              <p className="flex items-center gap-2.5 text-sm text-muted">
                <ShieldIcon className="h-4 w-4 shrink-0" />
                These documents are private. Your access to them is recorded.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="dangerOutline"
                  disabled={processing}
                  onClick={() => {
                    setReason('');
                    setRejectOpen(true);
                  }}
                >
                  <XIcon className="h-4 w-4" /> Reject
                </Button>
                <Button variant="success" loading={processing} onClick={() => decide('approve')}>
                  <CheckCircleIcon className="h-4 w-4" />
                  {decidableSide === 'exporter' ? 'Verify' : 'Approve'}
                </Button>
              </div>
            </div>
          )}
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
    </AdminLayout>
  );
}
