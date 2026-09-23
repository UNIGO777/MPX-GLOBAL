import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { authApi } from '../../api/auth.js';
import { Button } from '../../components/Button.jsx';
import { FormError } from '../../components/FormError.jsx';
import { OtpInput } from '../../components/OtpInput.jsx';
import { RadioCard } from '../../components/RadioCard.jsx';
import { colors, radii, spacing, typography } from '../../theme/index.js';
import { ERROR_CODES, isErrorCode, toAppError } from '../../utils/errors.js';

/**
 * A21 step 2 · the D7 claim offer — "we found your company". React Native twin
 * of `web/src/pages/auth/ClaimOffer.jsx`, which is the reference implementation
 * (`mobile-app.md`: implement EVERY rule in build-prompt §A21, do not re-derive
 * them and do not ship a simpler version).
 *
 * The rules this renders:
 *  - rule 3: the email and the phone can reach two DIFFERENT companies, so this
 *    is a LIST and the person picks one. One row renders as a plain card.
 *  - rule 6: a company reached through an identifier that is not the person's
 *    own email needs a code from the member ALREADY in it. Until that code is
 *    entered the server WITHHOLDS the company's name (F1 — a recycled SIM must
 *    not learn whose company it reaches), so the row shows only the masked
 *    inbox the code goes to.
 *  - the screen owns Join / "Neither" and the seller-detail fields; this file is
 *    only the list and the code step.
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

/** What joining this company actually does to the person — stated before they do it. */
function Consequence({ offer }) {
  if (offer.needs?.length > 0) {
    return (
      <Text style={styles.consequence}>
        {offer.verified
          ? `Heads up: this company is verified, but we still need your ${neededDetails(offer.needs)} for the seller side. Adding those sends the company back to our team for a quick check, so the verified tick pauses until they approve it.`
          : `Fill in the details below — we need your ${neededDetails(offer.needs)} for the seller side.`}
      </Text>
    );
  }
  if (offer.carriesTickOver) {
    return (
      <Text style={styles.consequence}>
        Its verified tick carries straight over — no second check needed.
      </Text>
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
      // The seat went between offer and join — the screen swaps to the create
      // form rather than dead-ending a signup that is otherwise intact.
      if (isErrorCode(err, ERROR_CODES.CLAIM_SEAT_TAKEN)) {
        onSeatTaken(toAppError(err).message);
        return;
      }
      // The signup token lives an hour; chasing a colleague for a code can
      // outlast it. Hand back to the screen's "start again" state.
      if (isErrorCode(err, ERROR_CODES.SIGNUP_SESSION_EXPIRED)) {
        onSessionExpired(toAppError(err).message);
        return;
      }
      setError(toAppError(err));
      // Start the next attempt clean, as the sign-in code screen does, rather
      // than making someone backspace six wrong digits.
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
    <View style={styles.codeBox}>
      <Text style={styles.codeIntro}>
        To join, enter the code we send to the company&apos;s email,{' '}
        <Text style={styles.codeEmail}>{offer.verifierEmail}</Text>. Ask the colleague who uses that
        inbox for it — the email tells them someone is asking to join the company.
      </Text>

      {error ? <FormError error={error} style={styles.codeError} /> : null}

      {sentTo ? (
        <View style={styles.codeEntry}>
          <Text style={styles.codeLabel}>Company email code</Text>
          <OtpInput value={code} onChange={setCode} onComplete={verify} disabled={busy} />
          <Button
            label="Confirm code"
            onPress={() => verify()}
            loading={busy}
            disabled={code.length < 6}
            size="sm"
          />
          <Button
            label="Send a new code"
            onPress={send}
            variant="ghost"
            size="sm"
            disabled={busy}
          />
        </View>
      ) : (
        <Button
          label="Send code"
          onPress={send}
          variant="secondary"
          size="sm"
          loading={busy}
          style={styles.sendBtn}
        />
      )}
    </View>
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
    <View style={styles.panel}>
      <Text style={styles.eyebrow}>
        {many ? 'WE FOUND COMPANIES REGISTERED TO YOU' : 'WE FOUND YOUR COMPANY'}
      </Text>
      <Text style={styles.blurb}>
        Join it and you share one company profile, one set of documents and one verified tick —
        instead of setting up a second, separate company.
        {many
          ? ' Your email and your phone number are registered to different companies, so pick the one you belong to.'
          : ''}
      </Text>

      <View style={styles.list}>
        {offers.map((offer) => {
          const selected = offer.choice === picked;
          // Rule 6: withheld until the code proves the person belongs there.
          const title = offer.name ?? 'Company name shown after the code';
          return (
            <View
              key={offer.choice}
              style={[styles.row, selected ? styles.rowSelected : styles.rowIdle]}
            >
              {many ? (
                <RadioCard
                  title={title}
                  description={MATCHED_ON[offer.matchedOn]}
                  selected={selected}
                  onPress={() => onPick(offer.choice)}
                />
              ) : (
                <>
                  <Text style={styles.rowTitle}>{title}</Text>
                  <Text style={styles.rowMeta}>{MATCHED_ON[offer.matchedOn]}</Text>
                </>
              )}

              {selected && offer.needsOrgEmailOtp ? (
                <CompanyCode
                  signupToken={signupToken}
                  offer={offer}
                  onVerified={onOffersChange}
                  onSeatTaken={onSeatTaken}
                  onSessionExpired={onSessionExpired}
                />
              ) : null}
              {selected && !offer.needsOrgEmailOtp ? <Consequence offer={offer} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: spacing[5],
    borderWidth: 1,
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
    borderRadius: radii.xl,
    padding: spacing[5],
  },
  eyebrow: { ...typography.caption, color: colors.primary[700], fontWeight: '700', letterSpacing: 0.8 },
  blurb: { ...typography.body, color: colors.ink[700], marginTop: spacing[2] },
  list: { marginTop: spacing[4], gap: spacing[3] },
  row: { borderWidth: 1, borderRadius: radii.lg, padding: spacing[4] },
  rowIdle: { borderColor: colors.surface.border, backgroundColor: colors.white },
  rowSelected: { borderColor: colors.primary[600], backgroundColor: colors.white },
  rowTitle: { ...typography.h3, color: colors.ink[900] },
  rowMeta: { ...typography.caption, color: colors.muted, marginTop: spacing[1] },
  consequence: {
    ...typography.caption,
    color: colors.ink[700],
    marginTop: spacing[3],
    backgroundColor: colors.surface.subtle,
    borderRadius: radii.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  codeBox: {
    marginTop: spacing[3],
    backgroundColor: colors.surface.subtle,
    borderRadius: radii.lg,
    padding: spacing[3],
  },
  codeIntro: { ...typography.caption, color: colors.ink[700] },
  codeEmail: { fontWeight: '700', color: colors.ink[900] },
  codeError: { marginTop: spacing[3] },
  codeEntry: { marginTop: spacing[3], gap: spacing[3] },
  codeLabel: { ...typography.label, color: colors.ink[700] },
  sendBtn: { marginTop: spacing[3] },
});
