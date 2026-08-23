import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { kycApi } from '../../api/kyc.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiError, formatDate } from '../../lib/format.js';
import { DOC_TYPE_LABELS } from '../../lib/kycDocTypes.js';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { BUYER_NAV } from './buyerNav.js';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import {
  CheckIcon,
  ClockIcon,
  DocIcon,
  InfoIcon,
  XIcon,
} from '../../components/ui/icons.jsx';

/**
 * Buyer home — verification status. REDESIGNED 2026-08-11 to the M2 language,
 * mirroring the exporter hub: main card = state + a four-step VERIFICATION
 * JOURNEY with live derived markers; rail = the sent-documents list and the D3
 * "this is optional" card.
 *
 * The copy leans on D3 truth throughout: the account already works in full;
 * verification is an optional tick, never a gate. Rejection reason renders
 * VERBATIM (the reviewer wrote it for the applicant).
 */
const STATES = {
  pending: {
    title: "You haven't sent any documents",
    body: 'Verification is optional and your account already works in full. If you send your business documents, our team reviews them and adds a verified tick to your profile — suppliers use that tick to decide which enquiries to answer first.',
    cta: 'Upload documents',
  },
  submitted: {
    title: 'Your documents are with our team',
    body: (v) =>
      `We received them on ${formatDate(v.kycSubmittedAt)}. Reviews usually take two to three working days, and we'll email you as soon as it's done. You can keep using your account as normal in the meantime.`,
  },
  verified: {
    title: "You're verified",
    body: (v) =>
      `Your documents were approved on ${formatDate(v.verifiedAt)}. The verified tick now shows on your profile whenever you contact a supplier.`,
  },
  rejected: {
    title: "We couldn't verify your documents",
    cta: 'Upload new documents',
  },
};

/** A status outside the four known ones — say something true, keep upload reachable. */
const UNKNOWN_STATE = {
  title: 'Verification status unavailable',
  body: "We couldn't read the status of your verification just now. Your account works as normal — try refreshing, and contact us if it keeps happening.",
  cta: 'Upload documents',
};

/** One journey step: state ∈ done | active | failed | todo. */
function JourneyStep({ state, title, meta, last = false, children }) {
  const marker =
    state === 'done' ? (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-500 text-white">
        <CheckIcon className="h-4 w-4" />
      </span>
    ) : state === 'active' ? (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-warning-100 text-warning-700">
        <ClockIcon className="h-4 w-4" />
      </span>
    ) : state === 'failed' ? (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-danger-100 text-danger">
        <XIcon className="h-4 w-4" />
      </span>
    ) : (
      <span className="h-8 w-8 rounded-full border-2 border-ink-200 bg-white" />
    );

  return (
    <li className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3.5">
      <div className="flex flex-col items-center">
        <span aria-hidden="true">{marker}</span>
        {!last && (
          <span
            aria-hidden="true"
            className={`my-1 w-px flex-1 ${state === 'done' ? 'bg-success-300' : 'bg-ink-200'}`}
          />
        )}
      </div>
      <div className={last ? 'pb-1' : 'pb-6'}>
        <p
          className={`pt-1.5 text-sm font-semibold ${
            state === 'todo' ? 'text-muted' : 'text-ink-900'
          }`}
        >
          {title}
        </p>
        {meta && <p className="mt-0.5 text-[13px] text-muted">{meta}</p>}
        {children}
      </div>
    </li>
  );
}

function RailCard({ label, children }) {
  return (
    <section className="rounded-xl border border-surface-border bg-white p-4 shadow-card">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </h3>
      {children}
    </section>
  );
}

export function VerificationStatus() {
  const navigate = useNavigate();
  const { user } = useAuth();

  /**
   * TanStack Query, not a hand-rolled fetch in an effect.
   *
   * `web-frontend.md` mandates it for all server data, and it removes the
   * effect that called `setState` synchronously on mount (a cascading render).
   * Caching also means returning to this tab does not re-show a spinner for
   * data that is already known.
   */
  const query = useQuery({ queryKey: ['me','verification'], queryFn: kycApi.myVerification });
  const verification = query.data ?? null;
  const loading = query.isLoading;
  const error = query.error ? apiError(query.error) : null;
  const load = query.refetch;

  const v = verification;
  const status = v?.kycStatus;
  // Verification-redesign (2026-08-19): superseded docs are history, not the
  // current set — hidden here; open requests and pending changes get cards.
  const currentDocs = (v?.documents ?? []).filter((d) => !d.superseded);
  const openRequests = (v?.documentRequests ?? []).filter((r) => !r.fulfilledAt);
  const state = v ? (STATES[status] ?? UNKNOWN_STATE) : null;
  const firstName = user?.name?.split(/\s+/)[0] ?? '';

  // Journey step states, all derived — no invented data.
  const profileDone = v ? v.profileComplete !== false : false;
  const docsSent =
    ['submitted', 'verified', 'rejected'].includes(status) || (v?.documents?.length ?? 0) > 0;
  const reviewState =
    status === 'verified'
      ? 'done'
      : status === 'submitted'
        ? 'active'
        : status === 'rejected'
          ? 'failed'
          : 'todo';

  return (
    <PortalLayout nav={BUYER_NAV} wide>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-ink-900">
            Welcome{firstName ? `, ${firstName}` : ''}
          </h1>
          {status === 'verified' && <VerifiedTick verified verifiedAt={v.verifiedAt} />}
        </div>
        <p className="mt-1 text-sm text-muted">Your buyer account on MPX Global</p>
      </div>

      {loading && (
        <div className="max-w-[860px] space-y-4" role="status" aria-label="Loading verification status">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}

      {!loading && error && (
        <div className="max-w-[860px] rounded-2xl border border-surface-border bg-white shadow-card">
          <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />
        </div>
      )}

      {!loading && !error && v && (v.revocation || v.pendingChanges || openRequests.length > 0) && (
        <div className="mb-5 max-w-[860px] space-y-3">
          {v.revocation && (
            <Alert tone="danger" title="Your verification was withdrawn">
              {v.revocation.reason} — our team is re-reviewing your documents. Your account keeps
              working in the meantime.
            </Alert>
          )}
          {v.pendingChanges && (
            <Alert tone="warning" title={
              v.pendingChanges.state === 'awaiting_documents'
                ? 'Profile change — documents needed'
                : v.pendingChanges.state === 'rejected'
                  ? 'Profile change — not approved'
                  : 'Profile change — under review'
            }>
              {v.pendingChanges.state === 'rejected' && v.pendingChanges.rejectionReason
                ? `${v.pendingChanges.rejectionReason} — update the details from your company profile, or cancel the change there.`
                : 'Your live profile and verified badge stay unchanged until our team approves the new details.'}{' '}
              {v.pendingChanges.state === 'awaiting_documents' && (
                <Link to="/buyer/kyc" className="font-semibold underline">Upload the supporting documents</Link>
              )}
              {v.pendingChanges.state === 'rejected' && (
                <Link to="/buyer/company" className="font-semibold underline">Open company profile</Link>
              )}
            </Alert>
          )}
          {openRequests.map((r) => (
            <Alert key={r.id} tone="warning" title="Our team asked for documents">
              {r.note}{' '}
              <Link to="/buyer/kyc" className="font-semibold underline">Upload them here</Link>
            </Alert>
          ))}
        </div>
      )}

      {!loading && !error && v && state && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ============ main: state + the journey ============ */}
          <section className="min-w-0 rounded-2xl border border-surface-border bg-white p-6 shadow-card sm:p-8">
            <StatusChip status={status} />
            <h2 className="mt-4 text-[22px] font-semibold leading-tight text-ink-900">
              {state.title}
            </h2>

            {status === 'rejected' ? (
              <>
                <div className="mt-4 rounded-r-lg border-l-[3px] border-danger bg-danger-50 p-5 text-[15px] leading-relaxed text-ink-900">
                  {v.kycRejectionReason ?? 'Our team could not verify the documents you sent.'}
                </div>
                {/* `kycSubmittedAt` is when the buyer SENT them — the payload
                    carries no reviewedAt, so naming one would be invention. */}
                {v.kycSubmittedAt && (
                  <p className="mt-3 text-xs text-muted">Sent {formatDate(v.kycSubmittedAt)}</p>
                )}
              </>
            ) : (
              <p className="mt-3 max-w-[680px] text-[15px] leading-relaxed text-muted">
                {typeof state.body === 'function' ? state.body(v) : state.body}
              </p>
            )}

            {state.cta && (
              <Button className="mt-5" onClick={() => navigate('/buyer/kyc')}>
                {state.cta}
              </Button>
            )}

            {/* The journey — every state is DERIVED from the payload. */}
            <div aria-hidden="true" className="my-7 h-px w-full bg-surface-border" />
            <h3 className="mb-5 text-base font-semibold text-ink-900">How verification works</h3>
            <ol>
              <JourneyStep
                state={profileDone ? 'done' : 'active'}
                title="Company profile"
                meta={
                  profileDone
                    ? 'Your registered details are on file.'
                    : 'Name, country and address first — we check documents against them.'
                }
              >
                {!profileDone && (
                  <Link
                    to="/buyer/company"
                    className="mt-1.5 inline-block text-sm font-medium text-primary-700 hover:underline"
                  >
                    Complete profile →
                  </Link>
                )}
              </JourneyStep>
              <JourneyStep
                state={docsSent ? 'done' : profileDone ? 'active' : 'todo'}
                title="Send documents"
                meta={
                  docsSent
                    ? `${currentDocs.length} document${currentDocs.length === 1 ? '' : 's'} sent`
                    : 'Any one accepted document is enough to start the review.'
                }
              />
              <JourneyStep
                state={reviewState}
                title="Our team reviews"
                meta={
                  reviewState === 'failed'
                    ? 'See the reason above — send replacements and we review again.'
                    : reviewState === 'active'
                      ? 'Usually two to three working days.'
                      : reviewState === 'done'
                        ? 'Approved.'
                        : 'We email you when it’s done.'
                }
              />
              <JourneyStep
                state={status === 'verified' ? 'done' : 'todo'}
                title="Verified tick goes live"
                meta={
                  status === 'verified'
                    ? `On your profile since ${formatDate(v.verifiedAt)}.`
                    : 'Shown to suppliers whenever you contact them.'
                }
                last
              />
            </ol>
          </section>

          {/* ============ context rail ============ */}
          <aside className="space-y-4 lg:sticky lg:top-6">
            {currentDocs.length > 0 && (
              <RailCard label="What you sent">
                <ul className="space-y-2.5">
                  {currentDocs.map((d, i) => (
                    <li key={`${d.docType}-${d.uploadedAt}-${i}`} className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                        <DocIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900">
                          {DOC_TYPE_LABELS[d.docType] ?? d.docType}
                        </p>
                        <p className="text-xs text-muted">Uploaded {formatDate(d.uploadedAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-muted">
                  Your documents are private — we don&apos;t show them back to you here.
                </p>
              </RailCard>
            )}

            {/* D3 truth: never pressure — the account is whole without it. */}
            {status !== 'verified' && (
              <section className="rounded-xl bg-surface-subtle p-4">
                <div className="flex gap-3">
                  <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                  <div>
                    <h3 className="text-sm font-bold text-ink-900">Entirely optional</h3>
                    <p className="mt-1 text-[13px] text-ink-900/80">
                      Your account already works in full — browse, enquire and chat without
                      verification. The tick just helps suppliers prioritise your enquiries.
                    </p>
                  </div>
                </div>
              </section>
            )}
          </aside>
        </div>
      )}
    </PortalLayout>
  );
}
