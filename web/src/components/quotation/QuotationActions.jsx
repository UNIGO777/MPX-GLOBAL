import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { quotationsApi, quotationKeys } from '../../api/quotations.js';
import { apiError, fieldErrorMap } from '../../lib/format.js';
import { formatMinor, toMinor } from '../../lib/money.js';
import { Alert } from '../ui/Alert.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Modal } from '../ui/Modal.jsx';
import { OtpInput } from '../ui/OtpInput.jsx';

/**
 * Accept / Negotiate — the two answers to a live quotation, for BOTH sides
 * (owner, 2026-09-25: "like OLX").
 *
 * 🔴 **"Confirmed acceptance", never "signature".** The owner chose this wording
 * deliberately. Under the IT Act §3/3A a digital or electronic signature means a
 * licensed CA's certificate or a notified technique such as Aadhaar eSign; an
 * emailed code is neither. The mechanism is a second factor and a record of who
 * agreed to what — calling it a signature would be a claim the platform cannot
 * back. Do not reword any string in this file to say signed, signature or eSign.
 *
 * 🔴 **Both parties confirm, and you can only accept THE OTHER SIDE'S offer**
 * (owner, 2026-09-25). Accepting only INITIATES; the quotation is accepted when
 * the other party has confirmed too, each with a code sent to their own
 * registered email. With no counter-offers the document is the supplier's own
 * offer, so only the buyer can accept it; once the buyer counters, the supplier
 * can accept that. The server enforces all of it; this component only renders
 * what it is told.
 *
 * 🔴 **The figure shown is the last offer, not the printed total.** After a
 * counter-offer the document's own total is history, and confirming against it
 * would show a person a number nobody last agreed to.
 */
/**
 * The server's ceiling (`quotation.validators.js` MAX_MINOR), mirrored so the
 * form can say it BEFORE a round trip. The server stays the authority — this is
 * only so a typo does not cost a request to find out about.
 */
const MAX_MINOR = 1_000_000_000_000;

export function QuotationActions({ quotation, viewerSide, size = 'md', onChanged }) {
  const queryClient = useQueryClient();
  const [negotiating, setNegotiating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState(null);
  // The server's per-field messages, shown ON the input that caused them.
  const [priceError, setPriceError] = useState(null);

  const id = quotation.id;
  const figure = quotation.currentFigureMinor ?? quotation.totalMinor;
  const offers = quotation.offers ?? [];
  const lastOffer = offers.length ? offers[offers.length - 1] : null;
  const acceptance = quotation.acceptance ?? null;

  const answered = !['sent', 'negotiating'].includes(quotation.status);
  const iInitiated = acceptance?.initiatedBy === viewerSide;
  const theyInitiated = Boolean(acceptance?.initiatedBy) && !iInitiated;
  /**
   * 🔴 You may accept an offer THE OTHER SIDE put on the table — never your own
   * (owner, 2026-09-25, after hitting the first version of this rule).
   *
   * With no counter-offers the document IS the supplier's offer, so only the
   * buyer can accept it. Once the buyer counters, that figure is the buyer's
   * offer and the SUPPLIER can accept it. The server enforces both — this only
   * stops showing a button that would be rejected.
   *
   * It is the same test as `myTurnToOffer` on purpose: whichever side is due to
   * ANSWER can answer with a yes or with a number.
   */
  const figureIsTheirs = lastOffer ? lastOffer.by !== viewerSide : viewerSide === 'buyer';
  const mayAccept = theyInitiated || figureIsTheirs;
  /**
   * An offer is an ANSWER: nobody may offer twice in a row, and the document is
   * itself the supplier's opening offer, so the first counter is the buyer's.
   *
   * 🔴 And a side that has ACCEPTED does not get to counter (owner, 2026-09-25:
   * "when from any side quotation will accepted remove their side negotiation
   * button"). Saying "I accept ₹2" and then offering ₹3 is two positions at
   * once. Their move now is to wait — or to decline, if they are the buyer.
   */
  const myTurnToOffer = figureIsTheirs && !iInitiated;

  /**
   * Checked as they type, so an impossible figure never costs a round trip. The
   * server re-checks all of it — this is UX, not the control.
   */
  const offerMinor = price === '' ? null : toMinor(price);
  const localPriceError =
    offerMinor === null
      ? null
      : offerMinor <= 0
        ? 'Enter an amount greater than zero.'
        : offerMinor > MAX_MINOR
          ? 'That amount is too large. Check the figure.'
          : offerMinor === figure
            ? 'That is the figure already on the table — accept it instead.'
            : null;

  const done = (updated) => {
    queryClient.setQueryData(quotationKeys.one(id), updated);
    queryClient.invalidateQueries({ queryKey: ['quotations'] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    onChanged?.(updated);
  };

  const offer = useMutation({
    mutationFn: () => quotationsApi.negotiate(id, { totalMinor: toMinor(price), note: note.trim() || undefined }),
    onSuccess: (updated) => {
      done(updated);
      setNegotiating(false);
      setPrice('');
      setNote('');
    },
    /**
     * 🔴 The server sends `fields: [{field, message}]`, and this used to throw
     * all of it away and show the envelope's generic `message` — so an amount
     * the server rejected for a stated reason reached the owner as "Invalid
     * request." next to a perfectly innocent-looking box.
     */
    onError: (e) => {
      const err = apiError(e, 'Could not send your offer.');
      const onField = fieldErrorMap(err.fields).totalMinor;
      setPriceError(onField ?? null);
      setError(onField ? null : err.message);
    },
  });

  const sendCode = useMutation({
    mutationFn: () => quotationsApi.requestAcceptCode(id),
    onSuccess: () => {
      setCodeSent(true);
      setError(null);
    },
    onError: (e) => setError(apiError(e, 'Could not send the code.').message),
  });

  const confirm = useMutation({
    mutationFn: () => quotationsApi.confirmAccept(id, code),
    onSuccess: (updated) => {
      done(updated);
      setAccepting(false);
      setCodeSent(false);
      setCode('');
    },
    onError: (e) => setError(apiError(e, 'Could not confirm.').message),
  });

  if (answered) return null;

  const openAccept = () => {
    setError(null);
    setCode('');
    setCodeSent(false);
    setAccepting(true);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {iInitiated ? (
          // Stated, not implied: a person who has already confirmed must be able
          // to see that the deal is waiting on the OTHER side, not on them.
          <p className="text-[12.5px] font-medium text-muted">
            You confirmed {formatMinor(acceptance.agreedTotalMinor ?? figure, quotation.currency)} — waiting for the
            other party to confirm.
          </p>
        ) : mayAccept ? (
          <Button size={size} onClick={openAccept}>
            {theyInitiated ? 'Confirm acceptance' : 'Accept'}
          </Button>
        ) : (
          // Said, not left blank: a party whose own figure is on the table has
          // to know the ball is with the other side rather than wonder where
          // their button went.
          <p className="text-[12.5px] font-medium text-muted">
            {lastOffer ? 'Your offer is with them.' : 'Waiting for the buyer to accept.'}
          </p>
        )}

        {myTurnToOffer && (
          <Button
            size={size}
            variant="secondary"
            onClick={() => {
              setError(null);
              setNegotiating(true);
            }}
          >
            Negotiate
          </Button>
        )}
      </div>

      {/* ── Counter-offer ─────────────────────────────────────────────────── */}
      <Modal
        open={negotiating}
        onClose={() => setNegotiating(false)}
        title="Make a counter-offer"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNegotiating(false)}>Cancel</Button>
            <Button
              loading={offer.isPending}
              disabled={!price || Boolean(localPriceError) || toMinor(price) === figure}
              onClick={() => {
                setError(null);
                setPriceError(null);
                offer.mutate();
              }}
            >
              Send offer
            </Button>
          </>
        }
      >
        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
        <p className="text-sm text-muted">
          On the table now: <strong className="text-ink-900">{formatMinor(figure, quotation.currency)}</strong> for{' '}
          {quotation.number}.
        </p>
        <div className="mt-4 space-y-4">
          <Input
            label={`Your offer (${quotation.currency})`}
            type="number"
            min="0"
            max={MAX_MINOR / 100}
            step="0.01"
            inputMode="decimal"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              setPriceError(null);
            }}
            error={priceError ?? localPriceError ?? undefined}
            helper="The whole deal's total, not a per-unit rate."
          />
          <Input
            label="Message"
            optional
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this figure works for you"
          />
        </div>
        <p className="mt-4 text-xs text-muted">
          A counter-offer does not decline the quotation — it stays open, and either side can still accept.
        </p>
      </Modal>

      {/* ── Confirmed acceptance ──────────────────────────────────────────── */}
      <Modal
        open={accepting}
        onClose={() => setAccepting(false)}
        title="Confirm your acceptance"
        footer={
          codeSent ? (
            <>
              <Button variant="ghost" onClick={() => setAccepting(false)}>Cancel</Button>
              <Button loading={confirm.isPending} disabled={code.length < 4} onClick={() => { setError(null); confirm.mutate(); }}>
                Confirm
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setAccepting(false)}>Cancel</Button>
              <Button loading={sendCode.isPending} onClick={() => { setError(null); sendCode.mutate(); }}>
                Email me a code
              </Button>
            </>
          )
        }
      >
        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}

        <dl className="rounded-xl border border-surface-border bg-surface-subtle p-3.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Quotation</dt>
            <dd className="font-semibold text-ink-900">{quotation.number}</dd>
          </div>
          <div className="mt-1.5 flex justify-between gap-4">
            <dt className="text-muted">Amount you are accepting</dt>
            <dd className="font-semibold text-ink-900">{formatMinor(figure, quotation.currency)}</dd>
          </div>
        </dl>

        {codeSent ? (
          <div className="mt-4">
            <OtpInput value={code} onChange={setCode} label="Code from your email" autoFocus />
            <button
              type="button"
              className="mt-3 text-[13px] font-semibold text-primary-700 hover:underline"
              onClick={() => { setError(null); sendCode.mutate(); }}
            >
              Send it again
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">
            We will email a code to your registered address. Entering it records your acceptance of the amount above.
          </p>
        )}

        {/* 🔴 Said plainly, on the screen where a person commits. This is a
            record of acceptance and a second factor — not a digital signature,
            and the copy must never imply one. */}
        <p className="mt-4 text-xs text-muted">
          {theyInitiated
            ? 'The other party has accepted. Your confirmation closes the quotation at this amount.'
            : 'Both companies confirm. Yours is recorded now; the quotation is accepted once the other party confirms it too.'}{' '}
          This is a confirmed acceptance recorded on MPX Global, not a digital signature.
        </p>
      </Modal>
    </>
  );
}
