import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { kycApi } from '../../api/kyc.js';
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
import { DocIcon } from '../../components/ui/icons.jsx';

/**
 * Buyer home — verification status, four states (mockup:
 * buyer_verification_states_separated). The copy leans on D3 truth throughout:
 * the account already works in full; verification is an optional tick, never a
 * gate. Rejection reason renders VERBATIM (the reviewer wrote it for the
 * applicant). Company name is absent until A22 ships a self-org read — the
 * header greets the person instead (plan §7.4).
 */

/** "What you sent" — metadata only; the files themselves are never shown back. */
function DocumentList({ documents }) {
  if (!documents?.length) return null;
  return (
    <>
      {/* Mockup separates this block with a full-width hairline, not just space */}
      <div aria-hidden="true" className="my-7 h-px w-full bg-surface-border" />
      <div>
        <h3 className="text-base font-semibold text-ink-900">What you sent</h3>
        <p className="mt-1 text-[13px] text-muted">
          Your documents are private. We don&apos;t show them back to you here.
        </p>
        <ul className="mt-4 space-y-3">
          {documents.map((d, i) => (
            <li
              key={`${d.docType}-${d.uploadedAt}-${i}`}
              className="flex h-16 items-center gap-3 rounded-lg border border-surface-border bg-white px-4"
            >
              {/* Mockup: 32px tinted tile behind the doc glyph */}
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
  );
}

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

/**
 * A status outside the four known ones used to render an EMPTY card — no copy,
 * no CTA, no error. Say something true instead, and still offer the upload
 * route so the screen is never a dead end.
 */
const UNKNOWN_STATE = {
  title: 'Verification status unavailable',
  body: "We couldn't read the status of your verification just now. Your account works as normal — try refreshing, and contact us if it keeps happening.",
  cta: 'Upload documents',
};

export function VerificationStatus() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [verification, setVerification] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVerification(await kycApi.myVerification());
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const v = verification;
  const state = v ? (STATES[v.kycStatus] ?? UNKNOWN_STATE) : null;
  const firstName = user?.name?.split(/\s+/)[0] ?? '';

  return (
    <PortalLayout nav={BUYER_NAV}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          {/* Mockup: 32px title, 16px subline */}
          <h1 className="text-[26px] font-bold text-ink-900 sm:text-[32px]">
            Welcome{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-1 text-base text-muted">Your buyer account on MPX Global</p>
        </div>
        {v?.kycStatus === 'verified' && <VerifiedTick verified verifiedAt={v.verifiedAt} />}
      </div>

      {/* Mockup card: 860px cap, 16px radius, 32px padding */}
      <section className="max-w-[860px] rounded-2xl border border-surface-border bg-white p-6 shadow-card sm:p-8">
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
            <h2 className="mt-3 text-xl font-semibold text-ink-900">{state.title}</h2>

            {v.kycStatus === 'rejected' ? (
              <>
                {/* Mockup: a 3px LEFT accent bar on the tint, not a full border */}
                <div className="mt-4 rounded-r-lg border-l-[3px] border-danger bg-danger-50 p-5 text-[15px] leading-relaxed text-ink-900">
                  {v.kycRejectionReason ?? 'Our team could not verify the documents you sent.'}
                </div>
                {/* `kycSubmittedAt` is when the buyer SENT them. The payload
                    carries no reviewedAt/rejectedAt, so labelling this
                    "Reviewed" stated a date the API never returned. */}
                {v.kycSubmittedAt && (
                  <p className="mt-3 text-xs text-muted">Sent {formatDate(v.kycSubmittedAt)}</p>
                )}
              </>
            ) : (
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {typeof state.body === 'function' ? state.body(v) : state.body}
              </p>
            )}

            {state.cta && (
              <Button className="mt-5" onClick={() => navigate('/buyer/kyc')}>
                {state.cta}
              </Button>
            )}

            <DocumentList documents={v.documents} />
          </>
        )}
      </section>
    </PortalLayout>
  );
}
