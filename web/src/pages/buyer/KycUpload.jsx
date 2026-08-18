import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { kycApi } from '../../api/kyc.js';
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
import { BUYER_NAV } from './buyerNav.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { DocSlotRow } from '../../components/kyc/DocSlotRow.jsx';
import {
  BuildingIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  InfoIcon,
  UserIcon,
} from '../../components/ui/icons.jsx';

/**
 * Buyer KYC upload (mockup: buyer_document_upload_banner_added).
 *
 * Contract (kyc.service.js): ONE file per request — multipart `document` +
 * `docType`, plus `entityType` on the FIRST upload when the org has none (buyer
 * chooses here; it locks server-side after that, mismatch 400s). Rows upload
 * sequentially with per-row progress and per-row VERBATIM server errors — one
 * failed row never rolls back an earlier success. docType options come from the
 * backend enum ONLY (the mockup's VAT / Export License list is invalid).
 * Already-verified accounts short-circuit: the server 409s uploads, so the form
 * never renders.
 */
// One FIXED row per accepted document type (owner request, 2026-08-10) — the
// dropdown is gone. Rows exist only once an entity type is chosen, because the
// type decides the list.
const rowsFor = (entityType) =>
  (entityType ? DOC_TYPES_BY_ENTITY[entityType] : []).map((docType) => ({
    id: docType,
    docType,
    file: null,
    progress: 0,
    status: 'idle', // idle | uploading | done | error
    error: null,
  }));

const ENTITY_OPTIONS = [
  { value: 'business', title: 'Business', desc: 'For registered companies', Icon: BuildingIcon },
  { value: 'individual', title: 'Individual', desc: 'For independent traders', Icon: UserIcon },
];

export function KycUpload() {
  const navigate = useNavigate();

  const [verification, setVerification] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [entityType, setEntityType] = useState(null); // buyer's choice until server locks it
  const [rows, setRows] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const v = await kycApi.myVerification();
      setVerification(v);
      setEntityType(v.entityType ?? null);
      setRows(rowsFor(v.entityType ?? null));
    } catch (err) {
      setLoadError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

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

  const entityLocked = Boolean(verification?.entityType);

  const chooseEntity = (value) => {
    if (entityLocked || submitting) return;
    setEntityType(value);
    // The row list IS the entity's document list now — switching reseeds it.
    // Picked files drop with it: they were chosen for types that no longer apply.
    setRows(rowsFor(value));
  };

  // role="radio" promises radiogroup keys: one tab stop, arrows to move between
  // options. Without this the roles describe behaviour the cards don't have.
  const entityRefs = useRef({});
  const onEntityKeyDown = (e) => {
    const delta = ['ArrowRight', 'ArrowDown'].includes(e.key)
      ? 1
      : ['ArrowLeft', 'ArrowUp'].includes(e.key)
        ? -1
        : 0;
    if (!delta || entityLocked || submitting) return;
    e.preventDefault();
    const i = ENTITY_OPTIONS.findIndex((o) => o.value === entityType);
    const next = ENTITY_OPTIONS[(Math.max(i, 0) + delta + ENTITY_OPTIONS.length) % ENTITY_OPTIONS.length];
    chooseEntity(next.value);
    entityRefs.current[next.value]?.focus();
  };

  const patchRow = (id, patch) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const pickFile = async (id, file) => {
    // Camera captures may need an in-browser re-encode (HEIC / oversized JPEG).
    const picked = await normalizeKycFile(file);
    const clientError = checkKycFile(picked);
    patchRow(id, { file: picked, status: clientError ? 'error' : 'idle', error: clientError, progress: 0 });
  };

  const readyRows = rows.filter((r) => r.file && r.docType && r.status !== 'done' && !r.error);
  const canSubmit = Boolean(entityType) && readyRows.length > 0 && !submitting;

  /**
   * Why the submit is disabled. A dead button with no explanation is a bug —
   * the document type now starts unchosen, so "file added but still greyed
   * out" is the easy trap.
   */
  const blocker = (() => {
    if (submitting || canSubmit) return null;
    if (!entityType) return 'Choose what kind of account this is to continue.';
    if (rows.every((r) => !r.file)) return 'Add at least one document to continue.';
    return null;
  })();

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    let sentEntity = entityLocked; // entityType goes only on the first accepted upload
    let anyDone = rows.some((r) => r.status === 'done');
    let failed = 0;
    // Rows the loop won't touch (no file yet, or a client-side file error the
    // user still has to fix) keep the confirmation panel from showing.
    const untouched = rows.filter((r) => r.status !== 'done' && (!r.file || !r.docType || r.error)).length;
    for (const row of rows) {
      if (!row.file || !row.docType || row.status === 'done' || row.error) continue;
      patchRow(row.id, { status: 'uploading', progress: 0, error: null });
      try {
        await kycApi.uploadDocument({
          file: row.file,
          docType: row.docType,
          entityType: sentEntity ? undefined : entityType,
          onProgress: (p) => patchRow(row.id, { progress: p }),
        });
        sentEntity = true;
        anyDone = true;
        patchRow(row.id, { status: 'done', progress: 100 });
      } catch (err) {
        failed += 1;
        patchRow(row.id, { status: 'error', error: apiError(err, 'Upload failed. Try again.').message });
      }
    }
    setSubmitting(false);
    if (anyDone) setVerification((v) => (v ? { ...v, entityType: entityType ?? v.entityType } : v));
    if (failed === 0 && untouched === 0 && anyDone) setFinished(true);
  };

  const shell = (content, wide = false) => (
    <PortalLayout nav={BUYER_NAV} wide={wide}>{content}</PortalLayout>
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

  // A22 gate — same rule as the exporter side; the buyer variant of the company
  // screen carries exactly the fields the server checks.
  if (verification && verification.profileComplete === false) {
    return shell(
      <div className="max-w-[860px] rounded-xl border border-surface-border bg-white p-8 text-center shadow-sm">
        <BuildingIcon className="mx-auto h-10 w-10 text-primary-600" />
        <h1 className="mt-3 text-xl font-bold text-ink-900">Complete your company profile first</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Verification is optional — but if you want the tick, we need your registered company
          name, country and address on file before reviewing documents.
        </p>
        <Button className="mt-6" onClick={() => navigate('/buyer/company')}>
          Complete company profile
        </Button>
      </div>,
    );
  }

  // Already verified — the server would 409 any upload; say so instead of a form.
  if (verification?.kycStatus === 'verified') {
    return shell(
      <div className="max-w-[860px] rounded-xl border border-surface-border bg-white p-8 text-center shadow-sm">
        <CheckCircleIcon className="mx-auto h-10 w-10 text-success" />
        <h1 className="mt-3 text-xl font-bold text-ink-900">You&apos;re verified</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Your documents were approved on {formatDate(verification.verifiedAt)} and your verified
          tick is showing on your profile. There&apos;s nothing more to send.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => navigate('/buyer/verification')}>
          Back to verification
        </Button>
      </div>,
    );
  }

  if (finished) {
    return shell(
      <div className="max-w-[860px] rounded-xl border border-surface-border bg-white p-8 text-center shadow-sm">
        <CheckCircleIcon className="mx-auto h-10 w-10 text-success" />
        <h1 className="mt-3 text-xl font-bold text-ink-900">Documents sent</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Your documents are with our team. Reviews usually take two to three working days — you can
          keep using your account as normal in the meantime.
        </p>
        <Button className="mt-6" onClick={() => navigate('/buyer/verification')}>
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
              onClick={() => navigate('/buyer/verification')}
              className="flex items-center gap-1 text-xs font-medium text-muted hover:text-primary-700"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              Verification status
            </button>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold leading-tight text-ink-900">Upload your documents</h1>
              {rows.length > 0 && (
                <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
                  {addedCount}/{rows.length} added
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {blocker && <span className="hidden text-xs text-muted md:block">{blocker}</span>}
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={() => navigate('/buyer/verification')}
            >
              Cancel
            </Button>
            <Button size="sm" loading={submitting} disabled={!canSubmit} onClick={submit}>
              {submitting ? 'Sending…' : 'Submit for review'}
            </Button>
          </div>
        </div>
      </div>

      {verification?.kycStatus === 'rejected' && verification.kycRejectionReason && (
        <div className="mb-5">
          <Alert tone="danger">{verification.kycRejectionReason}</Alert>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ============ main: account kind, then the document slots ============ */}
        <section className="min-w-0 rounded-2xl border border-surface-border bg-white shadow-card">
          <div className="border-b border-ink-100 p-5 sm:p-6">
            <h2 className="text-[15px] font-bold text-ink-900">What kind of account is this?</h2>
            {entityLocked ? (
              <p className="mt-2 text-sm text-muted">
                Your account is set up as{' '}
                <span className="font-semibold text-ink-900">{ENTITY_LABELS[entityType]}</span>.
                Your first upload fixed this, and it decides which document types we accept.
              </p>
            ) : (
              <div
                className="mt-4 grid gap-3 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Account kind"
                onKeyDown={onEntityKeyDown}
              >
                {ENTITY_OPTIONS.map(({ value, title, desc, Icon }) => {
                  const on = entityType === value;
                  return (
                    <button
                      key={value}
                      ref={(el) => (entityRefs.current[value] = el)}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      tabIndex={on || (!entityType && value === ENTITY_OPTIONS[0].value) ? 0 : -1}
                      disabled={submitting}
                      onClick={() => chooseEntity(value)}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                        on
                          ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600'
                          : 'border-surface-border bg-white hover:border-primary-400 hover:shadow-card'
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          on ? 'bg-primary-600 text-white' : 'bg-primary-50 text-primary-600'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink-900">{title}</span>
                        <span className="block text-xs text-muted">{desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6">
            <h2 className="text-[15px] font-bold text-ink-900">Your documents</h2>
            <p className="mt-0.5 text-[13px] text-muted">
              {entityType
                ? `Send at least one — any of these works. Up to ${config.kyc.maxMb} MB per file.`
                : 'Choose your account kind first — it decides which documents we accept.'}
            </p>
            {entityType && (
              <ul className="mt-4 space-y-3">
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
            )}
            {/* The bar hides the blocker below md — repeat it here so a phone
                user still learns why Submit is disabled. */}
            {blocker && <p className="mt-4 text-sm text-muted md:hidden">{blocker}</p>}
          </div>
        </section>

        {/* ============ context rail ============ */}
        <aside className="space-y-4 lg:sticky lg:top-[84px]">
          <section className="rounded-xl border border-surface-border bg-white p-4 shadow-card">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
              Why verify
            </h3>
            <p className="text-[13px] leading-relaxed text-ink-700">
              You don&apos;t have to do this — your account already works in full. Sending documents
              adds a verified tick to your profile, which helps suppliers take your enquiries
              seriously. Now, later, or never.
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
                    onClick={() => navigate('/buyer/company')}
                    className="font-medium text-primary-700 hover:underline"
                  >
                    registered details
                  </button>
                  .
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                <span>Reviews take two to three working days — we email you when it&apos;s done.</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>,
    true,
  );
}
