import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { adminApi } from '../../api/admin.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { apiError, formatDate } from '../../lib/format.js';
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
  ChevronLeftIcon,
  DocIcon,
  ExternalIcon,
  FileIcon,
  RefreshIcon,
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
const isImage = (url) => /\.(jpe?g|png|webp)(\?|$)/i.test(url);
const isPdf = (url) => /\.pdf(\?|$)/i.test(url);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpired(false);
    try {
      const result = await adminApi.orgKycDocuments(orgId);
      setData(result);
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
      <div className="mb-6">
        <Link
          to="/admin/verification"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Back to queue
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-ink-900">KYC documents</h1>
          {data && <StatusChip status={data.kycStatus} />}
          {data?.entityType && (
            <span className="text-sm text-muted">{ENTITY_LABELS[data.entityType]} account</span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          Access to these documents is recorded — every view writes an audit entry.
        </p>
      </div>

      {decidedNote && (
        <div className="mb-4 max-w-3xl">
          <Alert tone="info">{decidedNote}</Alert>
        </div>
      )}
      {actionError && (
        <div className="mb-4 max-w-3xl">
          <Alert tone="danger">
            {actionError.message}
            {actionError.requestId && (
              <span className="ml-2 font-mono text-xs opacity-70">{actionError.requestId}</span>
            )}
          </Alert>
        </div>
      )}

      {loading && (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      )}

      {!loading && error && (
        <div className="max-w-3xl rounded-lg border border-surface-border bg-white shadow-card">
          <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />
        </div>
      )}

      {!loading && !error && docs.length === 0 && (
        <div className="max-w-3xl rounded-lg border border-surface-border bg-white shadow-card">
          <EmptyState icon={DocIcon} title="No documents">
            This company hasn&apos;t uploaded any KYC documents yet.
          </EmptyState>
        </div>
      )}

      {!loading && !error && docs.length > 0 && (
        <div className="grid items-start gap-4 lg:grid-cols-[280px_1fr]">
          {/* Document list */}
          <div className="rounded-lg border border-surface-border bg-white p-3 shadow-card">
            <h2 className="px-3 pb-2 pt-1 text-sm font-semibold text-ink-900">
              Documents ({docs.length})
            </h2>
            <ul className="space-y-1">
              {docs.map((d, i) => (
                <li key={`${d.docType}-${d.uploadedAt}-${i}`}>
                  <button
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-current={selected === i || undefined}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm ${
                      selected === i ? 'bg-primary-50 font-medium text-primary-800' : 'text-ink-800 hover:bg-ink-50'
                    }`}
                  >
                    <FileIcon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate">{DOC_TYPE_LABELS[d.docType] ?? d.docType}</span>
                      <span className="block text-xs font-normal text-muted">
                        Uploaded {formatDate(d.uploadedAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {canDecide && (
              <div className="mt-3 space-y-2 border-t border-surface-border pt-3">
                <Button fullWidth size="sm" loading={processing} onClick={() => decide('approve')}>
                  {decidableSide === 'exporter' ? 'Verify company' : 'Approve buyer'}
                </Button>
                <Button
                  fullWidth
                  variant="dangerOutline"
                  size="sm"
                  disabled={processing}
                  onClick={() => {
                    setReason('');
                    setRejectOpen(true);
                  }}
                >
                  Reject
                </Button>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="relative min-h-96 overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
            {expired ? (
              <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center">
                <RefreshIcon className="h-8 w-8 text-ink-400" />
                <h2 className="mt-3 text-base font-semibold text-ink-900">This preview has expired</h2>
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
              <iframe src={doc.signedUrl} title={DOC_TYPE_LABELS[doc.docType] ?? doc.docType} className="h-[70vh] w-full" />
            ) : doc ? (
              <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center">
                <FileIcon className="h-8 w-8 text-ink-400" />
                <h2 className="mt-3 text-base font-semibold text-ink-900">
                  This file can&apos;t be previewed here
                </h2>
                <a
                  href={doc.signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full border border-primary-800 px-4 text-sm font-semibold text-primary-800 hover:bg-primary-50"
                >
                  <ExternalIcon className="h-4 w-4" /> Open in a new tab
                </a>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject this submission?"
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
              Reject with this reason
            </Button>
          </>
        }
      >
        <label htmlFor="kyc-reject-reason" className="block text-sm font-medium text-ink-800">
          Reason
        </label>
        <textarea
          id="kyc-reject-reason"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="Say exactly what was wrong and what to send instead."
          className={inputClasses(false, 'mt-1.5 h-auto py-2')}
        />
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
          <span>This is shown to the applicant, word for word.</span>
          <span>{reason.trim().length}/500</span>
        </div>
      </Modal>
    </AdminLayout>
  );
}
