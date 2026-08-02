import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { kycApi } from '../../api/kyc.js';
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
import { Select } from '../../components/ui/Select.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { FileDrop } from '../../components/ui/FileDrop.jsx';
import {
  BuildingIcon,
  CheckCircleIcon,
  FileIcon,
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
      setRows([newRow(v.entityType ?? 'business')]);
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
  const docTypes = entityType ? DOC_TYPES_BY_ENTITY[entityType] : [];

  const chooseEntity = (value) => {
    if (entityLocked || submitting) return;
    setEntityType(value);
    // Doc types differ per entity — reset selections that no longer apply.
    setRows((rs) =>
      rs.map((r) =>
        DOC_TYPES_BY_ENTITY[value].includes(r.docType)
          ? r
          : { ...r, docType: DOC_TYPES_BY_ENTITY[value][0] },
      ),
    );
  };

  const patchRow = (id, patch) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const pickFile = (id, file) => {
    const clientError = checkKycFile(file);
    patchRow(id, { file, status: clientError ? 'error' : 'idle', error: clientError, progress: 0 });
  };

  const readyRows = rows.filter((r) => r.file && r.status !== 'done' && !r.error);
  const canSubmit = Boolean(entityType) && readyRows.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    let sentEntity = entityLocked; // entityType goes only on the first accepted upload
    let anyDone = rows.some((r) => r.status === 'done');
    let failed = 0;
    // Rows the loop won't touch (no file yet, or a client-side file error the
    // user still has to fix) keep the confirmation panel from showing.
    const untouched = rows.filter((r) => r.status !== 'done' && (!r.file || r.error)).length;
    for (const row of rows) {
      if (!row.file || row.status === 'done' || row.error) continue;
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

  // Already verified — the server would 409 any upload; say so instead of a form.
  if (verification?.kycStatus === 'verified') {
    return shell(
      <div className="max-w-2xl rounded-lg border border-surface-border bg-white p-8 text-center shadow-card">
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
      <div className="max-w-2xl rounded-lg border border-surface-border bg-white p-8 text-center shadow-card">
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
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-ink-900 sm:text-[28px]">Upload your documents</h1>
      <p className="mt-1 text-sm text-muted">Optional — this earns you a verified tick.</p>

      {verification?.kycStatus === 'pending' && (
        <div className="mt-5 rounded-lg border border-primary-100 bg-primary-50 p-4">
          <h3 className="text-sm font-semibold text-primary-800">You don&apos;t have to do this</h3>
          <p className="mt-1 text-sm leading-relaxed text-primary-800">
            Your account already works in full. Sending documents adds a verified tick to your
            profile, which helps suppliers take your enquiries seriously — but nothing is locked
            without it.
          </p>
        </div>
      )}

      {verification?.kycStatus === 'rejected' && verification.kycRejectionReason && (
        <div className="mt-5">
          <Alert tone="danger">{verification.kycRejectionReason}</Alert>
        </div>
      )}

      {/* Entity choice — buyer picks on first upload; locked once the org has one */}
      <section className="mt-6 rounded-lg border border-surface-border bg-white p-6 shadow-card">
        <h2 className="text-lg font-bold text-ink-900">What kind of account is this?</h2>
        {entityLocked ? (
          <p className="mt-2 text-sm text-muted">
            Your account is set up as{' '}
            <span className="font-semibold text-ink-900">{ENTITY_LABELS[entityType]}</span>. This
            was fixed by your first upload and decides which document types we accept.
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Entity type">
              {[
                { value: 'business', title: 'Business', desc: 'For registered companies', Icon: BuildingIcon },
                { value: 'individual', title: 'Individual', desc: 'For independent traders', Icon: UserIcon },
              ].map(({ value, title, desc, Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={entityType === value}
                  disabled={submitting}
                  onClick={() => chooseEntity(value)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    entityType === value
                      ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600'
                      : 'border-surface-border bg-white hover:border-ink-300'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${entityType === value ? 'text-primary-700' : 'text-ink-500'}`} />
                  <p className="mt-2 text-sm font-semibold text-ink-900">{title}</p>
                  <p className="mt-0.5 text-xs text-muted">{desc}</p>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              This locks with your first upload and decides which document types we ask for.
            </p>
          </>
        )}
      </section>

      {/* Document rows */}
      <section className="mt-5 rounded-lg border border-surface-border bg-white p-6 shadow-card">
        <h2 className="text-lg font-bold text-ink-900">Your documents</h2>
        {!entityType && (
          <p className="mt-2 text-sm text-muted">Choose your account kind first.</p>
        )}

        {entityType && (
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
        )}
      </section>

      <div className="mt-6 flex items-center gap-3">
        <Button loading={submitting} disabled={!canSubmit} onClick={submit}>
          {submitting ? "Sending…" : "Submit for review"}
        </Button>
        <Button variant="ghost" disabled={submitting} onClick={() => navigate('/buyer/verification')}>
          Back to verification status
        </Button>
      </div>
    </div>,
  );
}
