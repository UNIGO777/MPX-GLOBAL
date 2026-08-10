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
} from '../../lib/kycDocTypes.js';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { BUYER_NAV } from './buyerNav.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { FileDrop } from '../../components/ui/FileDrop.jsx';
import {
  BuildingIcon,
  CheckCircleIcon,
  DocIcon,
  ChevronLeftIcon,
  InfoIcon,
  TrashIcon,
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

  useEffect(() => {
    load();
  }, [load]);

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

  const pickFile = (id, file) => {
    const clientError = checkKycFile(file);
    patchRow(id, { file, status: clientError ? 'error' : 'idle', error: clientError, progress: 0 });
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

  const shell = (content) => <PortalLayout nav={BUYER_NAV}>{content}</PortalLayout>;

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

  return shell(
    <div className="max-w-[860px]">
      {/* Design: back link sits at the TOP of the page, not under the form */}
      <button
        type="button"
        onClick={() => navigate('/buyer/verification')}
        className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Back to verification status
      </button>

      <h1 className="mt-6 text-[32px] font-bold leading-tight text-ink-900">Upload your documents</h1>
      <p className="mt-1 text-base text-muted">Optional — this earns you a verified tick.</p>

      {verification?.kycStatus === 'pending' && (
        <div className="mt-6 flex gap-4 rounded-xl border border-primary-100 bg-primary-50 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary-600">
            <InfoIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[15px] font-bold text-primary-800">You don&apos;t have to do this</p>
            <p className="mt-1 text-[15px] leading-relaxed text-primary-800/80">
              Your account already works in full. Sending documents adds a verified tick to your
              profile, which helps suppliers take your enquiries seriously. You can do it now,
              later, or never.
            </p>
          </div>
        </div>
      )}

      {verification?.kycStatus === 'rejected' && verification.kycRejectionReason && (
        <div className="mt-6">
          <Alert tone="danger">{verification.kycRejectionReason}</Alert>
        </div>
      )}

      {/* ONE card holds the account kind AND the documents (design) */}
      <section className="mt-6 rounded-xl border border-surface-border bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-ink-900">What kind of account is this?</h2>
        {entityLocked ? (
          <p className="mt-3 text-[15px] text-muted">
            Your account is set up as{' '}
            <span className="font-semibold text-ink-900">{ENTITY_LABELS[entityType]}</span>. Your
            first upload fixed this, and it decides which document types we accept.
          </p>
        ) : (
          <div
            className="mt-4 grid gap-4 sm:grid-cols-2"
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
                  className={`flex items-center gap-4 rounded-lg border p-4 text-left transition-colors ${
                    on ? 'border-primary-600 bg-primary-50' : 'border-surface-border bg-white hover:border-ink-400'
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                      on ? 'bg-primary-100 text-primary-700' : 'bg-ink-100 text-ink-500'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink-900">{title}</span>
                    <span className="block text-[13px] text-muted">{desc}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      on ? 'border-primary-600' : 'border-ink-300'
                    }`}
                  >
                    {on && <span className="h-2.5 w-2.5 rounded-full bg-primary-600" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <hr className="my-8 border-surface-border" />

        <h2 className="text-lg font-bold text-ink-900">Your documents</h2>
        {/* Same per-document cap as the exporter side — one server setting
            (KYC_MAX_FILE_MB) governs both portals, so state it here too rather
            than let a buyer discover it by failing an upload. */}
        <p className="mt-1 text-[13px] text-muted">
          PDF, JPG, PNG or WEBP. Up to {config.kyc.maxMb} MB per file.
        </p>
        {!entityType && <p className="mt-3 text-[15px] text-muted">Choose your account kind first.</p>}

        {entityType && (
          <div className="mt-5 space-y-5">
            {rows.map((row) => {
              const removable = Boolean(row.file);
              return (
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
        )}
      </section>

      {/* Design footer: primary submit (grey until something is ready) + Cancel */}
      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-4">
          <Button loading={submitting} disabled={!canSubmit} onClick={submit} className="min-w-[220px]">
            {submitting ? 'Sending…' : 'Submit for review'}
          </Button>
          <Button
            variant="ghost"
            disabled={submitting}
            onClick={() => navigate('/buyer/verification')}
          >
            Cancel
          </Button>
        </div>
        {blocker && <p className="mt-3 text-sm text-muted">{blocker}</p>}
      </div>
    </div>,
  );
}
