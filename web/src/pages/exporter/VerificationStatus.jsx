import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
import { DocIcon, InfoIcon } from '../../components/ui/icons.jsx';

/**
 * Exporter home — verification status (mockup:
 * exporter_verification_all_states_stacked). Two loads: GET /me/verification
 * (the status) and the org's own PUBLIC profile via GET /exporters/:orgId — the
 * only self-org source until A22 (plan §7.4) — for the company name/country in
 * the header. The profile failing must not sink the page: the header degrades
 * to the person, exactly like the buyer panel.
 *
 * D1 truth in the copy: unverified = max 3 ACTIVE products (a limit, not a
 * gate — the profile is public from signup); verified = limit removed.
 */
const LIMIT_CALLOUT = {
  title: 'Your current limit: 3 active products',
  body: "Until you're verified you can keep up to 3 products live at a time. Verified exporters have no limit.",
};

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

/**
 * A status outside the four known ones used to render an EMPTY card. Say
 * something true instead, and keep the upload route reachable.
 */
const UNKNOWN_STATE = {
  title: 'Verification status unavailable',
  body: "We couldn't read the status of your verification just now. Your profile is still live — try refreshing, and contact us if it keeps happening.",
  cta: 'Start verification',
};

export function VerificationStatus() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [verification, setVerification] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, p] = await Promise.allSettled([
        kycApi.myVerification(),
        kycApi.publicExporter(user.orgId),
      ]);
      if (v.status === 'rejected') throw v.reason;
      setVerification(v.value);
      // Profile is header garnish — its failure degrades, never errors the page.
      setProfile(p.status === 'fulfilled' ? p.value : null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [user.orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const v = verification;
  const state = v ? (STATES[v.kycStatus] ?? UNKNOWN_STATE) : null;
  const showLimit = v && v.kycStatus !== 'verified';

  const headerSub = profile
    ? [countryName(profile.country), profile.entityType ? `${ENTITY_LABELS[profile.entityType]} account` : null]
        .filter(Boolean)
        .join(' · ')
    : 'Your exporter account on MPX Global';

  return (
    <PortalLayout nav={EXPORTER_NAV} subline={profile?.name}>
      {/* Mockup: 860px column, 32px title, 16px subline, 40px gap to the card */}
      <div className="mb-8 max-w-[860px]">
        <h1 className="text-[26px] font-bold text-ink-900 sm:text-[32px]">
          {profile?.name ?? `Welcome${user?.name ? `, ${user.name.split(/\s+/)[0]}` : ''}`}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-muted">
          {headerSub}
          {v?.kycStatus === 'verified' && <VerifiedTick verified verifiedAt={v.verifiedAt} />}
        </p>
      </div>

      <div className="max-w-[860px] space-y-6">
        <section className="rounded-xl border border-surface-border bg-white p-6 shadow-card sm:p-10">
          {loading && (
            <div className="space-y-4" role="status" aria-label="Loading verification status">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          )}

          {!loading && error && (
            <ErrorState message={error.message} requestId={error.requestId} onRetry={load} />
          )}

          {!loading && !error && v && state && (
            <>
              <StatusChip status={v.kycStatus} />
              {/* Mockup: 22px semibold title, 16px body capped at 680px */}
              <h2 className="mt-4 text-[22px] font-semibold leading-tight text-ink-900">
                {state.title}
              </h2>

              {v.kycStatus === 'rejected' ? (
                <>
                  {/* 3px left accent on the tint, same as the buyer panel */}
                  <div className="mt-4 rounded-r-lg border-l-[3px] border-danger bg-danger-50 p-5 text-[15px] leading-relaxed text-ink-900">
                    {v.kycRejectionReason ?? 'Our team could not verify the documents you sent.'}
                  </div>
                  {/* `kycSubmittedAt` is when the exporter SENT them — the payload
                      carries no reviewedAt, so "Reviewed" asserted a date the API
                      never returned. */}
                  {v.kycSubmittedAt && (
                    <p className="mt-3 text-xs text-muted">Sent {formatDate(v.kycSubmittedAt)}</p>
                  )}
                </>
              ) : (
                <p className="mt-3 max-w-[680px] text-base leading-relaxed text-muted">
                  {typeof state.body === 'function' ? state.body(v) : state.body}
                </p>
              )}

              {state.cta && (
                <Button size="lg" className="mt-6" onClick={() => navigate('/exporter/kyc')}>
                  {state.cta}
                </Button>
              )}

              {v.documents?.length > 0 && (
                <>
                  {/* Hairline separator, then 64px rows with a tinted glyph tile
                      — identical treatment to the buyer panel. */}
                  <div aria-hidden="true" className="my-7 h-px w-full bg-surface-border" />
                  <div>
                    <h3 className="text-base font-semibold text-ink-900">What you sent</h3>
                    <p className="mt-1 text-[13px] text-muted">
                      Your documents are private. We don&apos;t show them back to you here.
                    </p>
                    <ul className="mt-4 space-y-3">
                      {v.documents.map((d, i) => (
                        <li
                          key={`${d.docType}-${d.uploadedAt}-${i}`}
                          className="flex h-16 items-center gap-3 rounded-lg border border-surface-border bg-white px-4"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-ink-100">
                            <DocIcon className="h-[18px] w-[18px] text-ink-500" />
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
                  </div>
                </>
              )}
            </>
          )}
        </section>

        {/* D1 callout — mockup: warning tint, 12px radius, 24px padding, NO border */}
        {!loading && !error && showLimit && (
          <aside className="flex gap-4 rounded-xl bg-warning-50 p-6">
            <InfoIcon className="h-5 w-5 shrink-0 text-warning" />
            <div>
              <h3 className="text-[15px] font-bold text-ink-900">{LIMIT_CALLOUT.title}</h3>
              <p className="mt-1 text-sm text-ink-900/80">{LIMIT_CALLOUT.body}</p>
            </div>
          </aside>
        )}
      </div>
    </PortalLayout>
  );
}
