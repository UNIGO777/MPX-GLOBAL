import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { adminApi } from '../../api/admin.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roleHome.js';
import { apiError, formatDate } from '../../lib/format.js';
import { countryName } from '../../lib/countries.js';
import { ALL_DOC_TYPES, DOC_TYPE_LABELS, ENTITY_LABELS, docTypesFor } from '../../lib/kycDocTypes.js';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { FlashMessage } from '../../components/ui/FlashMessage.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { inputClasses } from '../../components/ui/Field.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import {
  BuildingIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  DocIcon,
  ExternalIcon,
  FileIcon,
  GlobeIcon,
  InfoIcon,
  RefreshIcon,
  ShieldIcon,
  TrashIcon,
  XIcon,
} from '../../components/ui/icons.jsx';
import { CompanyAvatar } from '../../components/chat/CompanyAvatar.jsx';
import { cp } from '../../lib/consolePath.js';

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
  // Two kinds of note (2026-09-24, web-design "Confirmations disappear"):
  // what the reviewer JUST did hides itself; a state change someone else
  // caused (409) stays until the next action.
  const [decidedNote, setDecidedNote] = useState(null);
  const [staleNote, setStaleNote] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [showSuperseded, setShowSuperseded] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
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

  const orgName = org?.header?.name;
  useEffect(() => {
    const previous = document.title;
    document.title = `${orgName ? `${orgName} · ` : ''}KYC documents — MPX Global`;
    return () => { document.title = previous; };
  }, [orgName]);
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
  const currentDocs = allDocs.filter((d) => !d.superseded);
  // Current first, previous AFTER them (2026-09-24) — they used to be mixed into
  // one list and looked identical, so an old file read as a live one.
  const docs = showSuperseded ? [...currentDocs, ...supersededDocs] : currentDocs;
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
    setStaleNote(null);
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
        setStaleNote('This company is no longer awaiting review — another reviewer decided it.');
        setRejectOpen(false);
      } else setActionError(e);
    } finally {
      setProcessing(false);
    }
  };

  const reasonValid = reason.trim().length >= 3 && reason.trim().length <= 500;

  const [requestTypes, setRequestTypes] = useState([]);
  // Requestable types follow the COUNTRY as well as the entity type since
  // 2026-09-23 — asking an Indian company for a "trade licence", or a German one
  // for GST, would be a request its upload endpoint then refuses.
  const effectiveEntity = data?.pendingChanges?.requested?.entityType ?? data?.entityType ?? null;
  const effectiveCountry = data?.pendingChanges?.requested?.country ?? data?.country ?? null;
  const requestableTypes = effectiveEntity
    ? docTypesFor({ country: effectiveCountry, entityType: effectiveEntity })
    : ALL_DOC_TYPES;

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

  /**
   * Destroy the selected document. The reviewer's case for this is finding
   * something we must not hold — an Aadhaar in a PAN slot — so it deletes the
   * FILE, not just the row, and the org's status is deliberately untouched.
   */
  const submitRemove = async () => {
    if (!doc) return;
    setActionError(null);
    setProcessing(true);
    try {
      await adminApi.removeKycDocument(sidePath, orgId, doc.id, reason.trim());
      setDecidedNote('Document deleted — the file is gone from storage. The removal is in the audit log.');
      setRemoveOpen(false);
      setReason('');
      // The list shrinks under us; `selected` could now point past its end.
      setSelected(0);
      await query.refetch();
    } catch (err) {
      setActionError(apiError(err, 'Could not delete the document.'));
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
      <Link
        to={cp('/admin/verification')}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink-600 hover:text-primary-700"
      >
        <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
        Verification queue
      </Link>

      {/* --- floating action bar (M2 language): the decision is never a
          scroll away. Name / country / submitted come from the org record,
          which needs `organisation:read` — a reviewer holding only `kyc:view`
          still sees the documents, just with those cells blank.
          Redesigned 2026-09-24: the company's mark, facts with icons, and on
          phones the actions take their own full-width row. */}
      <div className="z-20 mb-5 pt-1 sm:sticky sm:top-0">
        <div className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-white/95 p-4 shadow-lift backdrop-blur sm:flex-row sm:items-center sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <CompanyAvatar name={org?.header?.name ?? 'KYC'} logo={org?.company?.logo} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 break-words text-lg font-bold leading-tight text-ink-900 sm:truncate">
                  {org?.header?.name ?? 'KYC documents'}
                </h1>
                {data && <StatusChip status={data.kycStatus} />}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-600">
                {data?.entityType && ENTITY_LABELS[data.entityType] && (
                  <span className="inline-flex items-center gap-1.5">
                    <BuildingIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
                    {ENTITY_LABELS[data.entityType]}
                  </span>
                )}
                {countryName(org?.company?.country) && (
                  <span className="inline-flex items-center gap-1.5">
                    <GlobeIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
                    {countryName(org.company.country)}
                  </span>
                )}
                {org?.verification?.submittedAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
                    Sent {formatDate(org.verification.submittedAt)}
                  </span>
                )}
              </p>
            </div>
          </div>
          {canDecide && (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
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
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
              <Button
                size="sm"
                variant="secondary"
                className={canRevoke ? '' : 'col-span-2'}
                onClick={() => { setReason(''); setRequestOpen(true); }}
              >
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
        <section className="mb-4 overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
          <h2 className="flex items-center gap-2 border-b border-surface-border bg-primary-50/50 px-4 py-2.5 text-[13px] font-semibold text-primary-800 sm:px-5">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary-500" />
            Requested profile change
            <span className="font-medium text-primary-700/80">
              · {data.pendingChanges.state === 'awaiting_review' ? 'awaiting review' : data.pendingChanges.state.replace('_', ' ')}
            </span>
          </h2>
          <dl className="space-y-1.5 px-4 py-3 sm:px-5">
            {data.pendingChanges.changedFields.map((f) => {
              const fmt = (v) =>
                f === 'address'
                  ? Object.values(v ?? {}).filter((x) => typeof x === 'string' && x).join(', ') || '—'
                  : f === 'entityType'
                    ? (ENTITY_LABELS[v] ?? String(v ?? '—'))
                    : f === 'country'
                      ? (countryName(v) ?? String(v ?? '—'))
                      : String(v ?? '—');
              return (
                <div key={f} className="grid gap-0.5 text-[13px] sm:grid-cols-[8rem_1fr] sm:gap-3">
                  <dt className="font-semibold capitalize text-ink-700">{f === 'entityType' ? 'Entity type' : f}</dt>
                  <dd className="min-w-0 text-ink-600">
                    <span className="line-through decoration-ink-300">{fmt(data.pendingChanges.current?.[f])}</span>
                    <span aria-hidden="true" className="mx-1.5 text-ink-400">→</span>
                    <span className="font-semibold text-ink-900">{fmt(data.pendingChanges.requested?.[f])}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}

      {/* Open document requests — what was asked and whether it arrived.
          Document types by NAME (they used to print the raw key, "gst"). */}
      {openRequests.length > 0 && (
        <section className="mb-4 rounded-2xl border border-warning-200 bg-warning-50/70 px-4 py-3 sm:px-5">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-warning-800">
            <InfoIcon className="h-4 w-4" aria-hidden="true" />
            Waiting on the company
          </h2>
          <ul className="mt-2 space-y-2">
            {openRequests.map((r) => (
              <li key={r.id} className="text-[13px] leading-relaxed text-ink-700">
                <span className="font-semibold text-ink-900">
                  {r.docTypes.map((t) => DOC_TYPE_LABELS[t] ?? t).join(', ')}
                </span>
                <span className="ml-2 text-xs text-muted">requested {formatDate(r.requestedAt)}</span>
                {r.note && <span className="block text-ink-600">{r.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {decidedNote && (
        <FlashMessage className="mb-4" onDismiss={() => setDecidedNote(null)}>
          {decidedNote}
        </FlashMessage>
      )}
      {staleNote && (
        <div className="mb-4">
          <Alert tone="info">{staleNote}</Alert>
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
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
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
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-5">
          {/* `minmax(0,1fr)` on phones too: the sideways file row inside an auto
              track stretched the grid past the screen and cut the preview off. */}
          {/* Document list — ONE card with compact rows (2026-09-24; each file
              used to be its own tall card). Below lg it becomes a sideways row
              of file chips, so the preview is not pushed a screen down. */}
          <section className="min-w-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-surface-border lg:bg-white lg:shadow-card">
            <div className="mb-2 flex items-center justify-between gap-3 lg:mb-0 lg:border-b lg:border-surface-border lg:px-4 lg:py-3">
              <h2 className="text-[13px] font-semibold text-ink-700">
                Documents <span className="font-medium text-muted">({currentDocs.length})</span>
              </h2>
              {supersededDocs.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setShowSuperseded((v) => !v); setSelected(0); }}
                  className="text-[12.5px] font-semibold text-primary-700 hover:underline"
                >
                  {showSuperseded ? 'Hide previous' : `Show previous (${supersededDocs.length})`}
                </button>
              )}
            </div>
            <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:space-y-0 lg:divide-y lg:divide-surface-border lg:overflow-visible lg:p-0">
              {docs.map((d, i) => {
                const on = selected === i;
                const old = Boolean(d.superseded);
                return (
                  <li key={`${d.docType}-${d.uploadedAt}-${i}`} className="shrink-0 lg:shrink">
                    {/* The first previous file opens its own group. */}
                    {old && i === currentDocs.length && (
                      <p className="hidden border-y border-surface-border bg-ink-50 px-4 py-2 text-[11.5px] font-semibold text-ink-500 lg:block">
                        Previous uploads ({supersededDocs.length})
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelected(i)}
                      aria-current={on || undefined}
                      className={`flex w-full items-center gap-3 text-left transition-colors max-lg:rounded-full max-lg:border max-lg:py-1.5 max-lg:pl-1.5 max-lg:pr-4 lg:px-4 lg:py-3 ${
                        old ? 'max-lg:border-dashed' : ''
                      } ${
                        on
                          ? old
                            ? 'max-lg:border-ink-400 max-lg:bg-ink-100 lg:bg-ink-100/80 lg:shadow-[inset_3px_0_0_theme(colors.ink.400)]'
                            : 'max-lg:border-primary-600 max-lg:bg-primary-50 lg:bg-primary-50/70 lg:shadow-[inset_3px_0_0_theme(colors.primary.600)]'
                          : old
                            ? 'max-lg:border-ink-300 max-lg:bg-ink-50 lg:bg-ink-50/60 hover:bg-ink-100/70'
                            : 'max-lg:border-ink-200 max-lg:bg-white hover:bg-ink-50'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full lg:h-9 lg:w-9 lg:rounded-lg ${
                          old
                            ? 'border border-dashed border-ink-300 bg-white text-ink-400'
                            : on
                              ? 'bg-primary-600 text-white'
                              : 'bg-ink-100 text-ink-500'
                        }`}
                      >
                        <FileIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block truncate text-[13.5px] font-semibold ${
                            old ? 'text-ink-500' : on ? 'text-primary-800' : 'text-ink-900'
                          }`}
                        >
                          {DOC_TYPE_LABELS[d.docType] ?? d.docType}
                        </span>
                        <span className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-muted">
                          {old && (
                            <span className="rounded bg-ink-200/70 px-1 py-px text-[10px] font-bold uppercase tracking-wide text-ink-600">
                              Replaced
                            </span>
                          )}
                          {formatDate(d.uploadedAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 hidden items-start gap-2 border-t border-surface-border px-4 py-3 text-[12px] leading-relaxed text-muted lg:mt-0 lg:flex">
              <ShieldIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Private documents. Your access is recorded for auditing.
            </p>
          </section>

          {/* Preview */}
          <section className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
            <div className="flex items-center justify-between gap-2 border-b border-surface-border px-4 py-2.5 sm:px-5">
              <span className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-ink-900">
                <FileIcon className="h-4 w-4 shrink-0 text-ink-500" />
                <span className="truncate">{doc ? (DOC_TYPE_LABELS[doc.docType] ?? doc.docType) : ''}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {doc && !expired && (
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open in new tab"
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-ink-200 px-3 text-sm font-semibold text-ink-800 hover:bg-ink-50 sm:px-4"
                  >
                    <ExternalIcon className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Open</span>
                  </a>
                )}
                {/* Gated on the SIDE review permission, not `canDecide`: a
                    verified org with nothing pending has no decision to make,
                    and is exactly where an Aadhaar might still be sitting. */}
                {doc && hasReviewPerm && (
                  <button
                    type="button"
                    onClick={() => { setReason(''); setRemoveOpen(true); }}
                    aria-label="Delete document"
                    className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold text-danger-700 hover:bg-danger-50"
                  >
                    <TrashIcon className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                )}
              </span>
            </div>

            {doc?.superseded && (
              <div className="flex items-start gap-2.5 border-b border-surface-border bg-ink-100/70 px-4 py-2.5 text-[13px] text-ink-700 sm:px-5">
                <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
                <span>
                  <span className="font-semibold text-ink-900">Previous upload.</span> The company has
                  replaced this file — it is kept for the record and is not part of the current review.
                </span>
              </div>
            )}

            {/* 🔴 The reviewer IS the masking control. The upload screen asks
                for a masked Aadhaar; nothing in the system can verify that, so
                this is where an unmasked one gets caught. Shown only for the
                Aadhaar docType so it stays meaningful rather than wallpaper. */}
            {doc?.docType === 'aadhaar' && (
              <div className="px-4 pt-4 sm:px-5">
                <Alert tone="warning" title="Check this is a MASKED Aadhaar">
                  Only the last 4 digits may be visible — the first 8 should read XXXX. If the full
                  number is showing, do not verify it: use{' '}
                  <span className="font-semibold">Delete</span> above, then ask for a
                  masked copy. We are not permitted to hold a full Aadhaar number.
                </Alert>
              </div>
            )}

            <div className="relative min-h-[300px] bg-ink-50 sm:min-h-[420px]">
              {expired ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center sm:min-h-[420px]">
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
                <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center sm:min-h-[420px]">
                  <FileIcon className="h-8 w-8 text-ink-400" />
                  <h3 className="mt-3 text-base font-semibold text-ink-900">
                    This file can&apos;t be previewed here
                  </h3>
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-primary-700 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50"
                  >
                    <ExternalIcon className="h-4 w-4" /> Open in a new tab
                  </a>
                </div>
              ) : null}
            </div>
            {/* Phones: the privacy note lives under the preview (the list's
                footer is hidden there). */}
            <p className="flex items-start gap-2 border-t border-surface-border px-4 py-2.5 text-[12px] text-muted lg:hidden">
              <ShieldIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Private documents. Your access is recorded for auditing.
            </p>
          </section>
        </div>
      )}

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={
          reviewMode === 'change'
            ? `Reject the profile changes for ${org?.header?.name ?? 'this company'}?`
            : `Reject verification for ${org?.header?.name ?? 'this company'}?`
        }
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
        <div className="mt-1.5 flex items-start justify-between gap-3 text-xs text-muted">
          <span>This is shown to the applicant — explain what they should fix.</span>
          <span className="shrink-0 whitespace-nowrap tabular-nums">{reason.trim().length} / 500</span>
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
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
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
        <div className="mt-1.5 flex items-start justify-between gap-3 text-xs text-muted">
          <span>This note is shown to the company on its verification page.</span>
          <span className="shrink-0 whitespace-nowrap tabular-nums">{reason.trim().length} / 500</span>
        </div>
      </Modal>

      {/* Delete a document — the only irreversible action on this screen. The
          copy says so plainly rather than relying on the red button alone. */}
      <Modal
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title={`Delete this ${doc ? (DOC_TYPE_LABELS[doc.docType] ?? doc.docType) : 'document'}?`}
        danger
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoveOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={!reasonValid} loading={processing} onClick={submitRemove}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-700">
          <span className="font-semibold text-ink-900">This cannot be undone.</span> The file is
          erased from storage, not hidden — use this when we must not be holding the document at
          all, such as an Aadhaar sent in place of a PAN.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">
          Nothing else changes: the company keeps its other documents and its current status. If
          you need a replacement, use <span className="font-semibold">Request documents</span>{' '}
          afterwards so the company knows what to send.
        </p>
        <label htmlFor="kyc-remove-reason" className="mt-4 block text-sm font-semibold text-ink-900">
          Reason
        </label>
        <textarea
          id="kyc-remove-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="Why is this being deleted? e.g. Aadhaar uploaded in the PAN slot — not accepted."
          className={inputClasses(false, 'mt-2 h-auto py-2')}
        />
        <div className="mt-1.5 flex items-start justify-between gap-3 text-xs text-muted">
          <span>Kept permanently in the audit log — the record outlives the file.</span>
          <span className="shrink-0 whitespace-nowrap tabular-nums">{reason.trim().length} / 500</span>
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
        <div className="mt-1.5 flex items-start justify-between gap-3 text-xs text-muted">
          <span>Shown to the company, never public. Recorded in the audit log.</span>
          <span className="shrink-0 whitespace-nowrap tabular-nums">{reason.trim().length} / 500</span>
        </div>
      </Modal>
    </AdminLayout>
  );
}
