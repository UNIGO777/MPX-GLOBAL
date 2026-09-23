import { useState } from 'react';

import { authApi } from '../../api/auth.js';
import { ERROR_CODES, apiError, isErrorCode } from '../../lib/format.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { OtpInput } from '../../components/ui/OtpInput.jsx';

/**
 * A21 step 2 · the D7 claim offer — "we found your company".
 *
 * The rules this screen renders (authoritative text: build-prompt §A21):
 *  - rule 3: the email and the phone can reach two DIFFERENT companies, so this
 *    is a list; each row says which identifier reached it, and the person picks
 *    one. One row renders as a single card.
 *  - rule 6: a company reached through an identifier that is not the person's
 *    own email needs a code from the member ALREADY in it. Until that code is
 *    entered the server withholds the company's name (F1 — a recycled SIM must
 *    not learn whose company it reaches), so the row shows only the masked
 *    inbox the code goes to.
 *  - the page owns the Join / "Neither" actions and the seller-details fields,
 *    so this component is only the list and the code step.
 *
 * 🔴 The client never holds an org id. It echoes the opaque `choice` the server
 * issued, and the server re-checks eligibility on every call.
 */

const MATCHED_ON = {
  email: 'Registered to your email',
  mobile: 'Registered to your phone number',
  both: 'Registered to your email and phone number',
};

function neededDetails(needs) {
  if (needs.includes('entityType') && needs.includes('address')) return 'entity type and registered address';
  return needs.includes('entityType') ? 'entity type' : 'registered address';
}

function Consequence({ offer }) {
  if (offer.needs?.length > 0) {
    return (
      <p className="mt-3 rounded-xl bg-white/70 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-700">
        {offer.verified ? (
          <>
            <span className="font-semibold">Heads up: </span>
            this company is verified, but we still need your {neededDetails(offer.needs)} for the
            seller side. Adding those sends the company back to our team for a quick check, so the
            verified tick pauses until they approve it.
          </>
        ) : (
          <>Fill in the details below — we need your {neededDetails(offer.needs)} for the seller side.</>
        )}
      </p>
    );
  }
  if (offer.carriesTickOver) {
    return (
      <p className="mt-3 rounded-xl bg-white/70 px-3.5 py-2.5 text-[13px] text-ink-700">
        Its verified tick carries straight over — no second check needed.
      </p>
    );
  }
  return null;
}

/** Rule 6 · the code from the existing member's inbox. */
function CompanyCode({ signupToken, offer, onVerified, onSeatTaken, onSessionExpired }) {
  const [sentTo, setSentTo] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      if (isErrorCode(err, ERROR_CODES.CLAIM_SEAT_TAKEN)) {
        onSeatTaken(apiError(err).message);
        return;
      }
      // 8c · the signup lives an hour; chasing a colleague for a code can outlast
      // it. Hand back to the page's "Start signup again" state, not a dead end.
      if (isErrorCode(err, ERROR_CODES.SIGNUP_SESSION_EXPIRED)) {
        onSessionExpired(apiError(err).message);
        return;
      }
      setError(apiError(err, 'That did not work. Please try again.').message);
      // Start the next attempt clean — same as the sign-in code screen —
      // rather than making the person backspace six wrong digits.
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      const res = await authApi.signupClaimCode({ signupToken, choice: offer.choice });
      setSentTo(res.sentTo);
    });

  const verify = (value = code) =>
    run(async () => {
      const offers = await authApi.signupClaimVerify({ signupToken, choice: offer.choice, code: value });
      onVerified(offers);
    });

  return (
    <div className="mt-3 rounded-xl bg-white/70 px-3.5 py-3 text-[13px] leading-relaxed text-ink-700">
      <p>
        To join, enter the code we send to the company&apos;s email,{' '}
        <span className="font-semibold text-ink-900">{offer.verifierEmail}</span>. Ask the colleague
        who uses that inbox for it — the email tells them someone is asking to join the company.
      </p>
      {error && (
        <Alert tone="danger" className="mt-3">
          {error}
        </Alert>
      )}
      {sentTo ? (
        <div className="mt-3 space-y-3">
          <OtpInput
            label="Company email code"
            value={code}
            onChange={setCode}
            onComplete={verify}
            disabled={busy}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" loading={busy} disabled={code.length < 6} onClick={() => verify()}>
              Confirm code
            </Button>
            <button
              type="button"
              onClick={send}
              disabled={busy}
              className="text-sm font-semibold text-primary-700 hover:underline disabled:opacity-50"
            >
              Send a new code
            </button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="mt-3" loading={busy} onClick={send}>
          Send code
        </Button>
      )}
    </div>
  );
}

export function ClaimOffer({
  signupToken,
  offers,
  picked,
  onPick,
  onOffersChange,
  onSeatTaken,
  onSessionExpired,
}) {
  const many = offers.length > 1;

  return (
    <div className="mt-5 rounded-2xl border border-primary-200 bg-primary-50 p-5">
      <p className="text-[13px] font-semibold uppercase tracking-wider text-primary-700">
        {many ? 'We found companies registered to you' : 'We found your company'}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-700">
        Join it and you share one company profile, one set of documents and one verified tick —
        instead of setting up a second, separate company.
        {many && ' Your email and your phone number are registered to different companies, so pick the one you belong to.'}
      </p>

      <div role={many ? 'radiogroup' : undefined} aria-label={many ? 'Company to join' : undefined} className="mt-4 space-y-3">
        {offers.map((offer) => {
          const selected = offer.choice === picked;
          const title = offer.name ?? 'Company name shown after the code';
          return (
            <div
              key={offer.choice}
              className={`rounded-xl border p-4 ${
                selected ? 'border-primary-600 bg-white ring-1 ring-primary-600' : 'border-surface-border bg-white/60'
              }`}
            >
              {many ? (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onPick(offer.choice)}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected ? 'border-primary-600' : 'border-ink-300'
                    }`}
                  >
                    {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary-600" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[16px] font-bold text-ink-900">{title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{MATCHED_ON[offer.matchedOn]}</span>
                  </span>
                </button>
              ) : (
                <>
                  <p className="text-[17px] font-bold text-ink-900">{title}</p>
                  <p className="mt-0.5 text-xs text-muted">{MATCHED_ON[offer.matchedOn]}</p>
                </>
              )}

              {selected && offer.needsOrgEmailOtp && (
                <CompanyCode
                  signupToken={signupToken}
                  offer={offer}
                  onVerified={onOffersChange}
                  onSeatTaken={onSeatTaken}
                  onSessionExpired={onSessionExpired}
                />
              )}
              {selected && !offer.needsOrgEmailOtp && <Consequence offer={offer} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
