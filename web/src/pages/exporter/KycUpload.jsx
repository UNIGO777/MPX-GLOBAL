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
  normalizeKycFile,
} from '../../lib/kycDocTypes.js';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { EXPORTER_NAV } from './exporterNav.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { DocSlotRow } from '../../components/kyc/DocSlotRow.jsx';
import {
  BuildingIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ClockIcon,
  DocIcon,
  InfoIcon,
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
      // Documents support the entity type they'll be REVIEWED against — the
      // pending one when a profile change is switching identity (2026-08-19).
      let slots = rowsFor(v.value.pendingChanges?.values?.entityType ?? v.value.entityType ?? 'business');
      // A verified org with ONLY an open request may upload exactly what was
      // asked — the server refuses anything else, so nothing else is offered.
      const open = (v.value.documentRequests ?? []).filter((r) => !r.fulfilledAt);
      if (v.value.kycStatus === 'verified' && !v.value.pendingChanges && open.length > 0) {
        const asked = new Set(open.flatMap((r) => r.docTypes));
        slots = slots.filter((r) => asked.has(r.docType));
      }
      setRows(slots);
    } catch (err) {
      setLoadError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [user.orgId]);

  /**
   * ⚠️ Deliberate exception, not an oversight.
   *
   * This seeds an EDITABLE form from fetched data, which React's compiler rules
   * flag because the value is copied into state rather than derived. The
   * sanctioned fix is to split the form into a wrapper (query + loading/error)
   * and a body keyed by record id, so the initial state IS the data.
   *
   * Not done here on purpose: this screen handles document uploads and its
   * fields carry validation that changed recently, so restructuring it buys a
   * compiler hint at the cost of real regression risk in a security-relevant
   * flow. Revisit when this screen is next worked on properly.
   */
  /* eslint-disable react-hooks/set-state-in-effect -- see note above */
  useEffect(() => {
    load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // The entity type documents are reviewed against (pending wins — 2026-08-19).
  const entityType =
    verification?.pendingChanges?.values?.entityType ?? verification?.entityType ?? 'business';
  const rejected = verification?.kycStatus === 'rejected';
  const pendingChange = verification?.pendingChanges ?? null;
  const openRequests = (verification?.documentRequests ?? []).filter((r) => !r.fulfilledAt);

  const patchRow = (id, patch) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const pickFile = async (id, file) => {
    // Camera captures may need an in-browser re-encode (HEIC / oversized JPEG).
    const picked = await normalizeKycFile(file);
    const clientError = checkKycFile(picked);
    patchRow(id, { file: picked, status: clientError ? 'error' : 'idle', error: clientError, progress: 0 });
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

  const shell = (content, wide = false) => (
    <PortalLayout nav={EXPORTER_NAV} subline={profile?.name} wide={wide}>
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

  if (verification?.kycStatus === 'verified' && !pendingChange && openRequests.length === 0) {
    return shell(
      <div className="max-w-[860px] rounded-xl border border-surface-border bg-white p-8 text-center shadow-sm">
        <CheckCircleIcon className="mx-auto h-10 w-10 text-success" />
        <h1 className="mt-3 text-xl font-bold text-ink-900">You&apos;re verified</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Your documents were approved on {formatDate(verification.verifiedAt)}. Your verified tick
          is live on your profile and your product limit has been removed. There&apos;s nothing more
          to send.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => navigate('/exporter/verification')}>
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
        <Button className="mt-6" onClick={() => navigate('/exporter/verification')}>
          Back to verification
        </Button>
      </div>,
    );
  }

  // An A22 demotion (verified details changed) re-queues the org as `submitted`
  // with its previously APPROVED documents — recognisable because those carry
  // `verifiedAt`. The exporter may genuinely need to send an updated file (say,
  // a new address proof), and the server accepts uploads in `submitted`, so in
  // that case the form stays available (QA, 2026-08-14: "only showing
  // reverify"). A plain first submission keeps the wait panel below.
  const demoted =
    verification?.kycStatus === 'submitted' &&
    (verification?.documents ?? []).some((d) => d.verifiedAt);

  // In review — nothing more to send; the form never renders (mockup).
  // (Verified orgs never reach this branch — their status is 'verified'.)
  if (verification?.kycStatus === 'submitted' && !demoted) {
    return shell(
      <div className="max-w-[860px] rounded-xl border border-surface-border bg-white p-8 text-center shadow-sm">
        <ClockIcon className="mx-auto h-10 w-10 text-warning" />
        <h1 className="mt-3 text-xl font-bold text-ink-900">Your documents are with our team</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          We received them on {formatDate(verification.kycSubmittedAt)}. There&apos;s nothing more
          to send for now — we&apos;ll email you when the review is done.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => navigate('/exporter/verification')}>
          Back to verification
        </Button>
      </div>,
    );
  }

  const addedCount = rows.filter((r) => r.status === 'done' || (r.file && !r.error)).length;

  return shell(
    <div>
      {/* --- floating action bar (M2 language): Submit is never a scroll away --- */}
      <div className="sticky top-0 z-20 mb-5 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-white/95 px-4 py-2.5 shadow-lift backdrop-blur">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate('/exporter/verification')}
              className="flex items-center gap-1 text-xs font-medium text-muted hover:text-primary-700"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              Verification status
            </button>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold leading-tight text-ink-900">
                {pendingChange
                  ? 'Documents for your profile change'
                  : openRequests.length > 0 && verification?.kycStatus === 'verified'
                    ? 'Requested documents'
                    : rejected
                      ? 'Send new documents'
                      : demoted
                        ? 'Send updated documents'
                        : 'Get verified'}
              </h1>
              <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
                {addedCount}/{rows.length} added
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {blocker && <span className="hidden text-xs text-muted md:block">{blocker}</span>}
            <Button variant="ghost" size="sm" disabled={submitting} onClick={() => navigate('/exporter/verification')}>
              Cancel
            </Button>
            <Button size="sm" loading={submitting} disabled={!canSubmit} onClick={submit}>
              {submitting ? 'Sending…' : rejected ? 'Submit again' : 'Submit for review'}
            </Button>
          </div>
        </div>
      </div>

      {pendingChange && (
        <Alert tone="warning" className="mb-5">
          <p className="font-semibold">These documents support your profile change</p>
          <p className="mt-1">
            Your live profile and verified badge stay unchanged. Our team reviews the new details
            against what you upload here{pendingChange.state === 'rejected'
              ? ' — your previous submission was not approved, so send corrected documents'
              : ''}.
          </p>
        </Alert>
      )}

      {openRequests.map((r) => (
        <Alert key={r.id} tone="warning" className="mb-5">
          <p className="font-semibold">
            Our team asked for: {r.docTypes.map((t) => DOC_TYPE_LABELS[t] ?? t).join(', ')}
          </p>
          <p className="mt-1">{r.note}</p>
        </Alert>
      ))}

      {demoted && (
        <Alert tone="info" className="mb-5">
          <p className="font-semibold">Your details changed — we&apos;re re-checking your documents</p>
          <p className="mt-1">
            The documents you already sent are being reviewed against your updated details. If one
            of them changed too (for example a new address proof), upload the updated file below —
            otherwise there&apos;s nothing more you need to send.
          </p>
        </Alert>
      )}

      {rejected && (
        <div className="mb-5 space-y-2">
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
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ============ main: the document slots ============ */}
        <section className="min-w-0 rounded-2xl border border-surface-border bg-white shadow-card">
          <header className="flex items-start gap-3 border-b border-ink-100 px-6 py-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <DocIcon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <h2 className="text-[15px] font-bold text-ink-900">Your documents</h2>
              <p className="text-[13px] text-muted">
                Send at least one — any of these works. Up to {config.kyc.maxMb} MB per file.
              </p>
            </span>
          </header>
          <ul className="space-y-3 p-5">
            {rows.map((row) => (
              <DocSlotRow
                key={row.id}
                label={DOC_TYPE_LABELS[row.docType]}
                file={row.file}
                status={row.status}
                progress={row.progress}
                error={row.error}
                disabled={submitting}
                accept={KYC_ACCEPT}
                onPick={(f) => pickFile(row.id, f)}
                onClear={() => patchRow(row.id, { file: null, error: null, status: 'idle', progress: 0 })}
              />
            ))}
          </ul>
          {/* The bar hides the blocker below md — repeat it here so a phone
              user still learns why Submit is disabled. */}
          {blocker && <p className="px-5 pb-4 text-sm text-muted md:hidden">{blocker}</p>}
        </section>

        {/* ============ context rail ============ */}
        <aside className="space-y-4 lg:sticky lg:top-[84px]">
          <section className="rounded-xl border border-surface-border bg-white p-4 shadow-card">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
              Account type
            </h3>
            {/* Set at signup and NEVER sent from here — the server uses the
                signup value and 400s a mismatch. Display only. */}
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                {entityType === 'business' ? (
                  <BuildingIcon className="h-5 w-5" />
                ) : (
                  <UserIcon className="h-5 w-5" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-900">
                  {ENTITY_LABELS[entityType]}
                </span>
                <span className="block text-xs text-muted">
                  Set at signup — decides which documents we accept.
                </span>
              </span>
            </div>
          </section>

          <section className="rounded-xl border border-surface-border bg-white p-4 shadow-card">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
              Why verify
            </h3>
            <p className="text-[13px] leading-relaxed text-ink-700">
              Until you&apos;re verified you can keep three products live at a time. Once approved,
              a verified tick appears on your public profile and the limit is removed. Your profile
              is already live either way.
            </p>
          </section>

          <section className="rounded-xl border border-surface-border bg-white p-4 shadow-card">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
              What happens next
            </h3>
            <ul className="space-y-2 text-[13px] text-ink-700">
              <li className="flex gap-2">
                <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                <span>
                  We check documents against your{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/exporter/company')}
                    className="font-medium text-primary-700 hover:underline"
                  >
                    registered details
                  </button>
                  .
                </span>
              </li>
              <li className="flex gap-2">
                <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                <span>Reviews usually take two to three working days.</span>
              </li>
              <li className="flex gap-2">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                <span>We email you when it&apos;s done.</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>,
    true,
  );
}
