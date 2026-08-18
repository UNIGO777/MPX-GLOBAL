import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { kycApi } from '../../api/kyc.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiError, formatDate } from '../../lib/format.js';
import { countryName } from '../../lib/countries.js';
import { DOC_TYPE_LABELS, ENTITY_LABELS } from '../../lib/kycDocTypes.js';
import { PortalLayout } from '../../layouts/PortalLayout.jsx';
import { EXPORTER_NAV } from './exporterNav.js';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { StatusChip } from '../../components/ui/StatusChip.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import {
  CheckIcon,
  ClockIcon,
  DocIcon,
  ExternalIcon,
  InfoIcon,
  XIcon,
} from '../../components/ui/icons.jsx';

/**
 * Exporter home — verification status. REDESIGNED 2026-08-11 to the M2
 * language: the single copy-card became a STATUS HUB — the main card carries a
 * four-step VERIFICATION JOURNEY (Profile → Documents → Review → Verified) with
 * live per-step states, and the rail holds what used to crowd the card: the
 * sent-documents list, the D1 limit callout, and the public-page link.
 *
 * Two loads: GET /me/verification (the status) and the org's own PUBLIC profile
 * via GET /exporters/:orgId for the header. The profile failing must not sink
 * the page: the header degrades to the person.
 *
 * D1 truth in the copy: unverified = max 3 ACTIVE products (a limit, not a
 * gate — the profile is public from signup); verified = limit removed.
 */
const STATES = {
  pending: {
    title: 'Get verified to sell without limits',
    body: 'Send your business documents and our team will check them. Once approved, a verified tick appears on your public profile and your product limit is removed. Your profile is already live — verification adds trust, it never hides you.',
    cta: 'Start verification',
  },
  submitted: {
    title: 'Your documents are with our team',
    body: (v) =>
      `We received them on ${formatDate(v.kycSubmittedAt)}. Reviews usually take two to three working days. Your profile stays live while we check, and we'll email you as soon as it's done.`,
  },
  verified: {
    title: "You're verified",
    body: (v) =>
      `Your documents were approved on ${formatDate(v.verifiedAt)}. Your verified tick is live on your profile and your product limit has been removed. Buyers can see the tick when they browse your listings.`,
  },
  rejected: {
    title: "We couldn't verify your documents",
    cta: 'Upload new documents',
  },
};

/** A status outside the four known ones — say something true, keep upload reachable. */
const UNKNOWN_STATE = {
  title: 'Verification status unavailable',
  body: "We couldn't read the status of your verification just now. Your profile is still live — try refreshing, and contact us if it keeps happening.",
  cta: 'Start verification',
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
   * TanStack Query rather than a hand-rolled fetch in an effect —
   * `web-frontend.md` mandates it for server data, and it removes the mount
   * effect that set state synchronously (a cascading render).
   *
   * The two calls stay in ONE query because they fill one screen: the
   * verification is required, while the public profile is header garnish whose
   * failure must degrade rather than error the page — hence `allSettled` and
   * the rethrow of only the first.
   */
  const query = useQuery({
    queryKey: ['me', 'verification', 'with-profile', user.orgId],
    queryFn: async () => {
      const [v, p] = await Promise.allSettled([
        kycApi.myVerification(),
        kycApi.publicExporter(user.orgId),
      ]);
      if (v.status === 'rejected') throw v.reason;
      return { verification: v.value, profile: p.status === 'fulfilled' ? p.value : null };
    },
  });

  const verification = query.data?.verification ?? null;
  const profile = query.data?.profile ?? null;
  const loading = query.isLoading;
  const error = query.error ? apiError(query.error) : null;
  const load = query.refetch;

  const v = verification;
  const status = v?.kycStatus;
  const baseState = v ? (STATES[status] ?? UNKNOWN_STATE) : null;

  // A22 demotion: verified details changed, so the org is back in `submitted`
  // with its previously APPROVED documents (they carry `verifiedAt`). Same
  // status, different situation — say so, and surface the update-documents
  // path the plain in-review state deliberately hides (QA, 2026-08-14).
  const demoted = status === 'submitted' && (v?.documents ?? []).some((d) => d.verifiedAt);
  const state = demoted
    ? {
        ...baseState,
        title: 'Your details changed — we’re re-checking your documents',
        body: (vv) =>
          `In review since ${formatDate(vv.kycSubmittedAt)}. We're checking the documents you already sent against your updated details. If one of them changed too — a new address proof, for example — you can upload the updated file; otherwise there's nothing more to send.`,
        cta: 'Upload updated documents',
      }
    : baseState;
  const showLimit = v && status !== 'verified';

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

  const headerSub = profile
    ? [countryName(profile.country), profile.entityType ? `${ENTITY_LABELS[profile.entityType]} account` : null]
        .filter(Boolean)
        .join(' · ')
    : 'Your exporter account on MPX Global';

  return (
    <PortalLayout nav={EXPORTER_NAV} subline={profile?.name} wide>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-ink-900">
            {profile?.name ?? `Welcome${user?.name ? `, ${user.name.split(/\s+/)[0]}` : ''}`}
          </h1>
          {status === 'verified' && <VerifiedTick verified verifiedAt={v.verifiedAt} />}
        </div>
        <p className="mt-1 text-sm text-muted">{headerSub}</p>
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
                {/* `kycSubmittedAt` is when the exporter SENT them — the payload
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
              <Button className="mt-5" onClick={() => navigate('/exporter/kyc')}>
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
                    to="/exporter/company"
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
                    ? `${v.documents?.length ?? 0} document${(v.documents?.length ?? 0) === 1 ? '' : 's'} sent`
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
                    ? `On your public profile since ${formatDate(v.verifiedAt)}.`
                    : 'Shown on your public profile and every listing; product limit removed.'
                }
                last
              />
            </ol>
          </section>

          {/* ============ context rail ============ */}
          <aside className="space-y-4 lg:sticky lg:top-6">
            {v.documents?.length > 0 && (
              <RailCard label="What you sent">
                <ul className="space-y-2.5">
                  {v.documents.map((d, i) => (
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

            {/* D1 callout — a LIMIT, not a gate; gone entirely once verified. */}
            {showLimit && (
              <section className="rounded-xl bg-warning-50 p-4">
                <div className="flex gap-3">
                  <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                  <div>
                    <h3 className="text-sm font-bold text-ink-900">
                      Current limit: 3 active products
                    </h3>
                    <p className="mt-1 text-[13px] text-ink-900/80">
                      Until you&apos;re verified you can keep up to 3 products live at a time.
                      Verified exporters have no limit.
                    </p>
                    <Link
                      to="/exporter/products"
                      className="mt-2 inline-flex text-[13px] font-semibold text-primary-700 hover:underline"
                    >
                      Manage your products →
                    </Link>
                  </div>
                </div>
              </section>
            )}

            {profile?.slug && (
              <RailCard label="Your public page">
                <p className="text-[13px] text-ink-700">
                  Live from signup — verification adds the tick, it never hides you.
                </p>
                <Link
                  to={`/supplier/${profile.slug}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline"
                >
                  View public page <ExternalIcon className="h-4 w-4" />
                </Link>
              </RailCard>
            )}
          </aside>
        </div>
      )}
    </PortalLayout>
  );
}
