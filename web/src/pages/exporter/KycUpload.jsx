import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { kycApi } from '../../api/kyc.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { config } from '../../config.js';
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
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { FileDrop } from '../../components/ui/FileDrop.jsx';
import {
  BuildingIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ClockIcon,
  DocIcon,
  InfoIcon,
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
// One FIXED row per accepted document type (owner request, 2026-08-10): the
// dropdown is gone — every type the entity can submit is listed as its own
// labelled slot, stacked in order. Rows are never added or removed; only their
// file changes. Uploading remains optional per row — the server takes any
// subset.
const rowsFor = (entityType) =>
  DOC_TYPES_BY_ENTITY[entityType].map((docType) => ({
    id: docType,
    docType,
    file: null,
    progress: 0,
    status: 'idle', // idle | uploading | done | error
    error: null,
  }));

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
      setRows(rowsFor(v.value.entityType ?? 'business'));
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
  const rejected = verification?.kycStatus === 'rejected';

  const patchRow = (id, patch) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const pickFile = (id, file) => {
    const clientError = checkKycFile(file);
    patchRow(id, { file, status: clientError ? 'error' : 'idle', error: clientError, progress: 0 });
  };

  const readyRows = rows.filter((r) => r.file && r.docType && r.status !== 'done' && !r.error);
  const canSubmit = readyRows.length > 0 && !submitting;

  /** Why the submit is disabled — never leave it greyed out unexplained. */
  const blocker = (() => {
    if (submitting || canSubmit) return null;
    if (rows.every((r) => !r.file)) return 'Add at least one document to continue.';
    return null;
  })();

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    let anyDone = rows.some((r) => r.status === 'done');
    let failed = 0;
    const untouched = rows.filter((r) => r.status !== 'done' && (!r.file || !r.docType || r.error)).length;
    for (const row of rows) {
      if (!row.file || !row.docType || row.status === 'done' || row.error) continue;
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
      <div className="max-w-[860px] space-y-4" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>,
    );
  }

  if (loadError) {
    return shell(
      <div className="max-w-[860px] rounded-xl border border-surface-border bg-white shadow-sm">
        <ErrorState message={loadError.message} requestId={loadError.requestId} onRetry={load} />
      </div>,
    );
  }

  // 🔴 The A22 gate, mirrored from the app's VerificationHub: the server refuses
  // uploads until name + country + address(line1/city/postalCode) exist
  // (PROFILE_INCOMPLETE). Until the company screen shipped, the web had NOWHERE
  // to send this person — the upload form itself was a dead end.
  if (verification && verification.profileComplete === false) {
    return shell(
      <div className="max-w-[860px] rounded-xl border border-surface-border bg-white p-8 text-center shadow-sm">
        <BuildingIcon className="mx-auto h-10 w-10 text-primary-600" />
        <h1 className="mt-3 text-xl font-bold text-ink-900">Complete your company profile first</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          We verify your documents against your registered details, so your company name, country
          and address need to be on file before you send anything.
        </p>
        <Button className="mt-6" onClick={() => navigate('/exporter/company')}>
          Complete company profile
        </Button>
      </div>,
    );
  }

  if (verification?.kycStatus === 'verified') {
    return shell(
      <div className="max-w-[860px] rounded-xl border border-surface-border bg-white p-8 text-center shadow-sm">
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
      <div className="max-w-[860px] rounded-xl border border-surface-border bg-white p-8 text-center shadow-sm">
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
      <div className="max-w-[860px] rounded-xl border border-surface-border bg-white p-8 text-center shadow-sm">
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
    <div className="max-w-[860px]">
      {/* Back link at the TOP, matching the buyer upload */}
      <button
        type="button"
        onClick={() => navigate('/exporter')}
        className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Back to verification status
      </button>

      <h1 className="mt-6 text-[32px] font-bold leading-tight text-ink-900">
        {rejected ? 'Send new documents' : 'Get verified'}
      </h1>
      <p className="mt-1 text-base text-muted">
        {rejected
          ? "Replace the documents that couldn't be verified."
          : `Send your ${entityType === 'business' ? 'business' : 'personal'} documents so our team can check them.`}
      </p>

      {rejected ? (
        <div className="mt-6 space-y-2">
          <Alert tone="danger">
            <p className="font-semibold">We couldn&apos;t verify your documents</p>
            <p className="mt-1">
              {verification.kycRejectionReason ?? 'Our team could not verify the documents you sent.'}
            </p>
          </Alert>
          {/* `kycSubmittedAt` is when the exporter SENT them. The payload has no
              reviewedAt/reviewer, so naming either would be invention. */}
          {verification.kycSubmittedAt && (
            <p className="text-xs text-muted">
              Sent {formatDate(verification.kycSubmittedAt)}. Upload replacement documents below
              and we&apos;ll review them again.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-6 flex gap-4 rounded-xl border border-primary-100 bg-primary-50 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary-600">
            <InfoIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[15px] font-bold text-primary-800">Why this matters</p>
            <p className="mt-1 text-[15px] leading-relaxed text-primary-800/80">
              Until you&apos;re verified you can keep three products live at a time. Once our team
              approves your documents, a verified tick appears on your public profile and the limit
              is removed. Your profile is already live either way.
            </p>
          </div>
        </div>
      )}

      {/* ONE card: account type (read-only) + documents */}
      <section className="mt-6 rounded-xl border border-surface-border bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-ink-900">Your account type</h2>
        {/* Set at signup and NEVER sent from here — the server uses the signup
            value and 400s a mismatch. Display only. */}
        <div className="mt-4 flex items-center gap-4 rounded-lg border border-surface-border bg-surface-subtle p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            {entityType === 'business' ? (
              <BuildingIcon className="h-5 w-5" />
            ) : (
              <UserIcon className="h-5 w-5" />
            )}
          </span>
          <span>
            <span className="block text-[15px] font-semibold text-ink-900">
              {ENTITY_LABELS[entityType]}
            </span>
            <span className="block text-[13px] text-muted">
              Set when you signed up — it decides which document types we accept.
            </span>
          </span>
        </div>

        <hr className="my-8 border-surface-border" />

        <h2 className="text-lg font-bold text-ink-900">Your documents</h2>
        <p className="mt-1 text-[13px] text-muted">
          PDF, JPG, PNG or WEBP. Up to {config.kyc.maxMb} MB per file. Send at least one
          document.
        </p>

        <div className="mt-5 space-y-5">
          {rows.map((row) => {
            const removable = Boolean(row.file);
            return (
              // Each document type is ONE card: header row (icon · label ·
              // status/clear), the dropzone full-width beneath, progress and
              // errors inside the same frame — the whole unit reads together.
              <div
                key={row.id}
                className={`rounded-xl border p-4 transition-colors ${
                  row.status === 'done'
                    ? 'border-success-300 bg-success-50/40'
                    : row.error
                      ? 'border-danger-200 bg-danger-50/40'
                      : 'border-surface-border bg-white'
                }`}
              >
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    <DocIcon className="h-4 w-4 text-primary-600" aria-hidden="true" />
                    {DOC_TYPE_LABELS[row.docType]}
                  </span>
                  {row.status === 'done' ? (
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-success">
                      <CheckCircleIcon className="h-4 w-4" /> Sent for review
                    </span>
                  ) : (
                    removable && (
                      <button
                        type="button"
                        aria-label={`Clear ${DOC_TYPE_LABELS[row.docType]} file`}
                        disabled={submitting}
                        onClick={() =>
                          patchRow(row.id, { file: null, error: null, status: 'idle', progress: 0 })
                        }
                        className="flex items-center gap-1 text-[13px] font-medium text-ink-500 transition-colors hover:text-danger disabled:cursor-not-allowed disabled:text-ink-300"
                      >
                        <TrashIcon className="h-4 w-4" /> Clear
                      </button>
                    )
                  )}
                </div>

                {row.status !== 'done' && (
                  <FileDrop
                    file={row.file}
                    accept={KYC_ACCEPT}
                    disabled={submitting}
                    onPick={(f) => pickFile(row.id, f)}
                  />
                )}

                {row.status === 'uploading' && (
                  <div
                    className="mt-2.5 h-1 overflow-hidden rounded-full bg-ink-200"
                    role="progressbar"
                    aria-valuenow={row.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full bg-primary-600 transition-all"
                      style={{ width: `${row.progress}%` }}
                    />
                  </div>
                )}

                {row.error && <p className="mt-2.5 text-[13px] font-medium text-danger">{row.error}</p>}
              </div>
            );
          })}

        </div>
      </section>

      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-4">
          <Button loading={submitting} disabled={!canSubmit} onClick={submit} className="min-w-[220px]">
            {submitting ? 'Sending…' : rejected ? 'Submit for review again' : 'Submit for review'}
          </Button>
          <Button variant="ghost" disabled={submitting} onClick={() => navigate('/exporter')}>
            Cancel
          </Button>
        </div>
        {blocker && <p className="mt-3 text-sm text-muted">{blocker}</p>}
      </div>
    </div>,
  );
}
