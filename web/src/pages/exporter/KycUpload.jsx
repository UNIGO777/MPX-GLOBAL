import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { kycApi } from '../../api/kyc.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiError, formatDate } from '../../lib/format.js';
import {
  DOC_TYPE_LABELS,
  DOC_TYPES_BY_ENTITY,
  ENTITY_LABELS,
  KYC_ACCEPT,
  checkKycFile,
} from '../../lib/kycDocTypes.js';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { EXPORTER_NAV } from './exporterNav.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { FileDrop } from '../../components/ui/FileDrop.jsx';
import {
  BuildingIcon,
  CheckCircleIcon,
  ClockIcon,
  FileIcon,
  TrashIcon,
  UserIcon,
} from '../../components/ui/icons.jsx';

/**
 * Exporter KYC upload + resubmit — ONE page, the reason banner is what varies
 * (mockups: exporter_verification_stacked_states + _resubmit_state).
 *
 * Differences from the buyer page, all contract-driven (kyc.service.js):
 * - entityType is READ-ONLY from signup and NEVER sent — the server uses the
 *   signup value and 400s a mismatch. The account-type card only displays it.
 * - `submitted` replaces the form with an in-review panel ("nothing more to
 *   send for now") — per the mockup, unlike the buyer page.
 * - `rejected` = the same form under a "Send new documents" heading + the
 *   verbatim reason; a successful resubmit confirms "Back in review"
 *   (server-side the same POST flips rejected→submitted and clears the reason).
 */
let rowSeq = 0;
const newRow = (entity) => ({
  id: ++rowSeq,
  docType: DOC_TYPES_BY_ENTITY[entity]?.[0] ?? 'other',
  file: null,
  progress: 0,
  status: 'idle', // idle | uploading | done | error
  error: null,
});

export function KycUpload() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [verification, setVerification] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [rows, setRows] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [v, p] = await Promise.allSettled([
        kycApi.myVerification(),
        kycApi.publicExporter(user.orgId),
      ]);
      if (v.status === 'rejected') throw v.reason;
      setVerification(v.value);
      setProfile(p.status === 'fulfilled' ? p.value : null);
      setRows([newRow(v.value.entityType ?? 'business')]);
    } catch (err) {
      setLoadError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [user.orgId]);

  useEffect(() => {
    load();
  }, [load]);

  // Exporters set this at signup — always present; guard anyway so a bad record
  // degrades to the business list instead of a blank page.
  const entityType = verification?.entityType ?? 'business';
  const docTypes = DOC_TYPES_BY_ENTITY[entityType];
  const rejected = verification?.kycStatus === 'rejected';

  const patchRow = (id, patch) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const pickFile = (id, file) => {
    const clientError = checkKycFile(file);
    patchRow(id, { file, status: clientError ? 'error' : 'idle', error: clientError, progress: 0 });
  };

  const readyRows = rows.filter((r) => r.file && r.status !== 'done' && !r.error);
  const canSubmit = readyRows.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    let anyDone = rows.some((r) => r.status === 'done');
    let failed = 0;
    const untouched = rows.filter((r) => r.status !== 'done' && (!r.file || r.error)).length;
    for (const row of rows) {
      if (!row.file || row.status === 'done' || row.error) continue;
      patchRow(row.id, { status: 'uploading', progress: 0, error: null });
      try {
        // No entityType — ever. The server uses the signup value (mismatch 400s).
        await kycApi.uploadDocument({
          file: row.file,
          docType: row.docType,
          onProgress: (p) => patchRow(row.id, { progress: p }),
        });
        anyDone = true;
        patchRow(row.id, { status: 'done', progress: 100 });
      } catch (err) {
        failed += 1;
        patchRow(row.id, { status: 'error', error: apiError(err, 'Upload failed. Try again.').message });
      }
    }
    setSubmitting(false);
    if (failed === 0 && untouched === 0 && anyDone) setFinished(true);
  };

  const shell = (content) => (
    <PortalLayout nav={EXPORTER_NAV} subline={profile?.name}>
      {content}
    </PortalLayout>
  );

  if (loading) {
    return shell(
      <div className="max-w-2xl space-y-4" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>,
    );
  }

  if (loadError) {
    return shell(
      <div className="max-w-2xl rounded-lg border border-surface-border bg-white shadow-card">
        <ErrorState message={loadError.message} requestId={loadError.requestId} onRetry={load} />
      </div>,
    );
  }

  if (verification?.kycStatus === 'verified') {
    return shell(
      <div className="max-w-2xl rounded-lg border border-surface-border bg-white p-8 text-center shadow-card">
        <CheckCircleIcon className="mx-auto h-10 w-10 text-success" />
        <h1 className="mt-3 text-xl font-bold text-ink-900">You&apos;re verified</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Your documents were approved on {formatDate(verification.verifiedAt)}. Your verified tick
          is live on your profile and your product limit has been removed. There&apos;s nothing more
          to send.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => navigate('/exporter')}>
          Back to verification
        </Button>
      </div>,
    );
  }

  // A resubmit confirms differently from a first submission.
  if (finished) {
    return shell(
      <div className="max-w-2xl rounded-lg border border-surface-border bg-white p-8 text-center shadow-card">
        <CheckCircleIcon className="mx-auto h-10 w-10 text-success" />
        <h1 className="mt-3 text-xl font-bold text-ink-900">
          {rejected ? 'Back in review' : 'Documents sent'}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          We received your {rejected ? 'new ' : ''}documents. Reviews usually take two to three
          working days and we&apos;ll email you when it&apos;s done. Your profile stays live in the
          meantime.
        </p>
        <Button className="mt-6" onClick={() => navigate('/exporter')}>
          Back to verification
        </Button>
      </div>,
    );
  }

  // In review — nothing more to send; the form never renders (mockup).
  if (verification?.kycStatus === 'submitted') {
    return shell(
      <div className="max-w-2xl rounded-lg border border-surface-border bg-white p-8 text-center shadow-card">
        <ClockIcon className="mx-auto h-10 w-10 text-warning" />
        <h1 className="mt-3 text-xl font-bold text-ink-900">Your documents are with our team</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          We received them on {formatDate(verification.kycSubmittedAt)}. There&apos;s nothing more
          to send for now — we&apos;ll email you when the review is done.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => navigate('/exporter')}>
          Back to verification
        </Button>
      </div>,
    );
  }

  return shell(
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-ink-900 sm:text-[28px]">
        {rejected ? 'Send new documents' : 'Get verified'}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {rejected
          ? "Replace the documents that couldn't be verified."
          : `Send your ${entityType === 'business' ? 'business' : 'personal'} documents so our team can check them.`}
      </p>

      {rejected ? (
        <div className="mt-5 space-y-2">
          <Alert tone="danger">
            <p className="font-semibold">We couldn&apos;t verify your documents</p>
            <p className="mt-1">
              {verification.kycRejectionReason ?? 'Our team could not verify the documents you sent.'}
            </p>
          </Alert>
          {verification.kycSubmittedAt && (
            <p className="text-xs text-muted">
              Reviewed {formatDate(verification.kycSubmittedAt)} by the MPX verification team.
              Upload replacement documents below and we&apos;ll review them again.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-primary-100 bg-primary-50 p-4">
          <h3 className="text-sm font-semibold text-primary-800">Why this matters</h3>
          <p className="mt-1 text-sm leading-relaxed text-primary-800">
            Until you&apos;re verified you can keep three products live at a time. Once our team
            approves your documents, a verified tick appears on your public profile and the limit
            is removed. Your profile is already live either way.
          </p>
        </div>
      )}

      {/* Account type — display only; set at signup, the server enforces it */}
      <section className="mt-6 rounded-lg border border-surface-border bg-white p-6 shadow-card">
        <h2 className="text-lg font-bold text-ink-900">Your account type</h2>
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-surface-border bg-surface-subtle px-4 py-3">
          {entityType === 'business' ? (
            <BuildingIcon className="h-5 w-5 text-primary-700" />
          ) : (
            <UserIcon className="h-5 w-5 text-primary-700" />
          )}
          <div>
            <p className="text-sm font-semibold text-ink-900">{ENTITY_LABELS[entityType]}</p>
            <p className="text-xs text-muted">
              Set when you signed up — it decides which document types we accept.
            </p>
          </div>
        </div>
      </section>

      {/* Document rows */}
      <section className="mt-5 rounded-lg border border-surface-border bg-white p-6 shadow-card">
        <h2 className="text-lg font-bold text-ink-900">Your documents</h2>
        <p className="mt-1 text-xs text-muted">
          PDF, JPG, PNG or WEBP. Up to 10 MB per file. Send at least one document.
        </p>

        <div className="mt-4 space-y-4">
          {rows.map((row) => (
            <div key={row.id} className="rounded-lg border border-surface-border p-4">
              <div className="grid gap-3 sm:grid-cols-[240px_1fr_auto]">
                <Select
                  label="Document type"
                  value={row.docType}
                  disabled={submitting || row.status === 'done'}
                  onChange={(e) => patchRow(row.id, { docType: e.target.value })}
                  options={docTypes.map((t) => ({ value: t, label: DOC_TYPE_LABELS[t] }))}
                />
                <div className="flex items-end">
                  <FileDrop
                    file={row.file}
                    accept={KYC_ACCEPT}
                    disabled={submitting || row.status === 'done'}
                    onPick={(f) => pickFile(row.id, f)}
                  />
                </div>
                {rows.length > 1 && row.status !== 'done' && (
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      aria-label="Remove this document"
                      disabled={submitting}
                      onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {row.file && row.status === 'done' && (
                <p className="mt-2 flex items-center gap-2 text-sm text-ink-800">
                  <FileIcon className="h-4 w-4 shrink-0 text-ink-500" />
                  <span className="truncate font-medium">{row.file.name}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                    <CheckCircleIcon className="h-4 w-4" /> Sent
                  </span>
                </p>
              )}

              {row.status === 'uploading' && (
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100"
                  role="progressbar"
                  aria-valuenow={row.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-primary-600 transition-all"
                    style={{ width: `${row.progress}%` }}
                  />
                </div>
              )}

              {row.error && <p className="mt-2 text-[13px] font-medium text-danger">{row.error}</p>}
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={() => setRows((rs) => [...rs, newRow(entityType)])}
          >
            + Add another document
          </Button>
        </div>
      </section>

      <div className="mt-6 flex items-center gap-3">
        <Button loading={submitting} disabled={!canSubmit} onClick={submit}>
          {submitting ? "Sending…" : rejected ? "Submit for review again" : "Submit for review"}
        </Button>
        <Button variant="ghost" disabled={submitting} onClick={() => navigate('/exporter')}>
          Back
        </Button>
      </div>
    </div>,
  );
}
