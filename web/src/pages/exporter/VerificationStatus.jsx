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
  const state = v ? STATES[v.kycStatus] : null;
  const showLimit = v && v.kycStatus !== 'verified';

  const headerSub = profile
    ? [countryName(profile.country), profile.entityType ? `${ENTITY_LABELS[profile.entityType]} account` : null]
        .filter(Boolean)
        .join(' · ')
    : 'Your exporter account on MPX Global';

  return (
    <PortalLayout nav={EXPORTER_NAV} subline={profile?.name}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 sm:text-[28px]">
          {profile?.name ?? `Welcome${user?.name ? `, ${user.name.split(/\s+/)[0]}` : ''}`}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {headerSub}
          {v?.kycStatus === 'verified' && <VerifiedTick verified verifiedAt={v.verifiedAt} />}
        </p>
      </div>

      <div className="max-w-2xl space-y-4">
        <section className="rounded-lg border border-surface-border bg-white p-6 shadow-card sm:p-8">
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
              <h2 className="mt-3 text-xl font-bold text-ink-900">{state.title}</h2>

              {v.kycStatus === 'rejected' ? (
                <>
                  <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-4 text-sm leading-relaxed text-ink-900">
                    {v.kycRejectionReason ?? 'Our team could not verify the documents you sent.'}
                  </div>
                  {v.kycSubmittedAt && (
                    <p className="mt-3 text-xs text-muted">Reviewed {formatDate(v.kycSubmittedAt)}</p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {typeof state.body === 'function' ? state.body(v) : state.body}
                </p>
              )}

              {state.cta && (
                <Button className="mt-5" onClick={() => navigate('/exporter/kyc')}>
                  {state.cta}
                </Button>
              )}

              {v.documents?.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-ink-900">What you sent</h3>
                  <p className="mt-0.5 text-xs text-muted">
                    Your documents are private. We don&apos;t show them back to you here.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {v.documents.map((d, i) => (
                      <li
                        key={`${d.docType}-${d.uploadedAt}-${i}`}
                        className="flex items-center gap-3 rounded-lg border border-surface-border bg-white px-3 py-2.5"
                      >
                        <DocIcon className="h-4 w-4 shrink-0 text-ink-500" />
                        <div>
                          <p className="text-sm font-medium text-ink-900">
                            {DOC_TYPE_LABELS[d.docType] ?? d.docType}
                          </p>
                          <p className="text-xs text-muted">Uploaded {formatDate(d.uploadedAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        {!loading && !error && showLimit && (
          <aside className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <InfoIcon className="h-5 w-5 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold text-ink-900">{LIMIT_CALLOUT.title}</p>
              <p className="mt-0.5 text-sm text-ink-800">{LIMIT_CALLOUT.body}</p>
            </div>
          </aside>
        )}
      </div>
    </PortalLayout>
  );
}
