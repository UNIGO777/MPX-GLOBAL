import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { quotationsApi } from '../../api/quotations.js';
import { colors, radii, spacing, typography } from '../../theme/index.js';
import { toAppError } from '../../utils/errors.js';
import { formatMinor, toMinor, MAX_MINOR } from '../../utils/money.js';
import { Button } from '../Button.jsx';
import { Input } from '../Input.jsx';
import { OtpInput } from '../OtpInput.jsx';

/**
 * A quotation in the app's chat, with the same two answers as the web: Accept
 * and Negotiate (owner, 2026-09-25 — "in app also this quotation and
 * negotiation make same as web").
 *
 * ── The rules, which are the SERVER's and are only mirrored here ──────────
 *
 * 🔴 **"Confirmed acceptance", never "signature".** Under the IT Act §3/3A a
 * digital or electronic signature means a licensed CA's certificate or a
 * notified technique such as Aadhaar eSign; an emailed code is neither. The
 * owner chose this wording deliberately. Do not reword any string in this file
 * to say signed, signature or eSign.
 *
 * 🔴 **Both parties confirm, and you can only accept THE OTHER SIDE'S offer.**
 * With no counter-offers the document is the supplier's own offer, so only the
 * buyer can accept it; once the buyer counters, that figure is the buyer's
 * offer and the supplier can accept it. Accepting only OPENS the acceptance —
 * the other party then confirms, each with a code sent to their own registered
 * email.
 *
 * 🔴 **A side that has accepted does not get to counter.** Saying "I accept ₹2"
 * and then offering ₹3 is two positions at once.
 *
 * 🔴 **The figure is the LAST OFFER, not the printed total.** After a
 * counter-offer the document's own total is history, and confirming against it
 * would show a person a number nobody last agreed to.
 *
 * ⚠️ Read-and-answer only. Building and sending a quotation is web-only by
 * design: a long priced form with a bank-details confirmation is desk work.
 * There is no PDF here either — the document opens on the web.
 */
const STATUS = {
  sent: { label: 'Awaiting an answer', bg: colors.ink[100], fg: colors.ink[700] },
  negotiating: { label: 'Negotiating', bg: '#FEF0DC', fg: '#93370D' },
  accepted: { label: 'Accepted', bg: '#E7F6EE', fg: '#05603A' },
  declined: { label: 'Declined', bg: colors.danger[100], fg: colors.danger[800] },
  expired: { label: 'Expired', bg: colors.ink[100], fg: colors.ink[600] },
  withdrawn: { label: 'Withdrawn', bg: colors.ink[100], fg: colors.ink[600] },
};

export function QuotationCard({ quotationId, mySide, variant = 'document', refreshToken = 0 }) {
  const [quotation, setQuotation] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [negotiateOpen, setNegotiateOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(async () => {
    try {
      setQuotation(await quotationsApi.get(quotationId));
      setLoadError(null);
    } catch (err) {
      // A quotation this viewer cannot read is a 404 by design (two-party
      // scoping). The card simply does not appear; the notice above it still
      // says what happened.
      setLoadError(toAppError(err).message);
    }
  }, [quotationId]);

  /**
   * Re-read when a new quotation notice lands in the thread (`refreshToken`
   * counts them). The card renders the quotation LIVE, and the other party's
   * offer or confirmation arrives as a message — without this, a card mounted
   * before their move keeps showing the state it was born with.
   */
  useEffect(() => {
    if (quotationId) load();
  }, [quotationId, load, refreshToken]);

  if (!quotation) {
    return loadError ? null : <View style={styles.placeholder} />;
  }

  const q = quotation;
  const status = STATUS[q.status] ?? STATUS.sent;
  const figure = q.currentFigureMinor ?? q.totalMinor;
  const offers = q.offers ?? [];
  const lastOffer = offers.length ? offers[offers.length - 1] : null;
  const negotiated = offers.length > 0 && figure !== q.totalMinor;
  const acceptance = q.acceptance ?? null;

  const answered = !['sent', 'negotiating'].includes(q.status);
  const iInitiated = acceptance?.initiatedBy === mySide;
  const theyInitiated = Boolean(acceptance?.initiatedBy) && !iInitiated;
  // Whichever side is due to ANSWER can answer with a yes or with a number.
  const figureIsTheirs = lastOffer ? lastOffer.by !== mySide : mySide === 'buyer';
  const mayAccept = theyInitiated || figureIsTheirs;
  const mayOffer = figureIsTheirs && !iInitiated;

  const offerMinor = price === '' ? null : toMinor(price);
  const priceProblem =
    offerMinor === null
      ? null
      : offerMinor <= 0
        ? 'Enter an amount greater than zero.'
        : offerMinor > MAX_MINOR
          ? 'That amount is too large. Check the figure.'
          : offerMinor === figure
            ? 'That is the figure already on the table — accept it instead.'
            : null;

  const run = async (fn) => {
    setBusy(true);
    setActionError(null);
    try {
      return await fn();
    } catch (err) {
      setActionError(toAppError(err).message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const sendOffer = async () => {
    const updated = await run(() =>
      quotationsApi.negotiate(q.id, { totalMinor: offerMinor, note: note.trim() || undefined }),
    );
    if (!updated) return;
    setQuotation(updated);
    setNegotiateOpen(false);
    setPrice('');
    setNote('');
  };

  const sendCode = async () => {
    const ok = await run(() => quotationsApi.requestAcceptCode(q.id));
    if (ok) setCodeSent(true);
  };

  const confirmAccept = async () => {
    const updated = await run(() => quotationsApi.confirmAccept(q.id, code));
    if (!updated) return;
    setQuotation(updated);
    setAcceptOpen(false);
    setCodeSent(false);
    setCode('');
  };

  const openAccept = () => {
    setActionError(null);
    setCode('');
    setCodeSent(false);
    setAcceptOpen(true);
  };

  return (
    <View style={[styles.card, variant === 'inline' && styles.inline]}>
      {variant === 'document' && (
        <View style={styles.head}>
          <View style={styles.pdfGlyph}>
            <Text style={styles.pdfGlyphText}>PDF</Text>
          </View>
          <View style={styles.headText}>
            <Text style={styles.number} numberOfLines={1}>
              {q.number}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {q.items?.length ?? 0} item{(q.items?.length ?? 0) === 1 ? '' : 's'} · Quotation
            </Text>
          </View>
        </View>
      )}

      {/* The figure, and where it stands. Colour is never the only signal — the
          status is spelled out beside it. */}
      <View style={styles.figureRow}>
        <View style={styles.figureCol}>
          <Text style={styles.figureLabel}>{negotiated ? 'ON THE TABLE' : 'TOTAL'}</Text>
          <Text style={styles.figure}>{formatMinor(figure, q.currency)}</Text>
          {negotiated ? (
            <Text style={styles.quoted}>Quoted {formatMinor(q.totalMinor, q.currency)}</Text>
          ) : null}
        </View>
        <View style={[styles.chip, { backgroundColor: status.bg }]}>
          <Text style={[styles.chipText, { color: status.fg }]}>{status.label}</Text>
        </View>
      </View>

      {!answered ? (
        <View style={styles.actions}>
          {iInitiated ? (
            <Text style={styles.waiting}>
              You confirmed {formatMinor(acceptance.agreedTotalMinor ?? figure, q.currency)} — waiting for the
              other party to confirm.
            </Text>
          ) : mayAccept ? (
            <View style={styles.actionButton}>
              <Button
                label={theyInitiated ? 'Confirm acceptance' : 'Accept'}
                onPress={openAccept}
                size="sm"
                fullWidth={false}
              />
            </View>
          ) : (
            <Text style={styles.waiting}>
              {lastOffer ? 'Your offer is with them.' : 'Waiting for the buyer to accept.'}
            </Text>
          )}

          {mayOffer ? (
            <View style={styles.actionButton}>
              <Button
                label="Negotiate"
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={() => {
                  setActionError(null);
                  setNegotiateOpen(true);
                }}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Counter-offer ──────────────────────────────────────────────── */}
      <Modal visible={negotiateOpen} animationType="slide" onRequestClose={() => setNegotiateOpen(false)}>
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Make a counter-offer</Text>
            <Pressable onPress={() => setNegotiateOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.ink[600]} />
            </Pressable>
          </View>

          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

          <Text style={styles.sheetLead}>
            On the table now: {formatMinor(figure, q.currency)} for {q.number}.
          </Text>

          <Input
            label={`Your offer (${q.currency})`}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="0.00"
            error={priceProblem ?? undefined}
            helperText="The whole deal's total, not a per-unit rate."
          />
          <Input
            label="Message"
            value={note}
            onChangeText={setNote}
            placeholder="Why this figure works for you"
            maxLength={300}
          />

          <Text style={styles.sheetNote}>
            A counter-offer does not decline the quotation — it stays open, and either side can still accept.
          </Text>

          <Button
            label="Send offer"
            onPress={sendOffer}
            loading={busy}
            disabled={!price || Boolean(priceProblem)}
          />
          <Button label="Cancel" variant="ghost" onPress={() => setNegotiateOpen(false)} />
        </ScrollView>
      </Modal>

      {/* ── Confirmed acceptance ───────────────────────────────────────── */}
      <Modal visible={acceptOpen} animationType="slide" onRequestClose={() => setAcceptOpen(false)}>
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Confirm your acceptance</Text>
            <Pressable onPress={() => setAcceptOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.ink[600]} />
            </Pressable>
          </View>

          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Quotation</Text>
              <Text style={styles.summaryValue}>{q.number}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount you are accepting</Text>
              <Text style={styles.summaryValue}>{formatMinor(figure, q.currency)}</Text>
            </View>
          </View>

          {codeSent ? (
            <>
              <Text style={styles.sheetLead}>Enter the code from your email.</Text>
              <OtpInput value={code} onChange={setCode} />
              <Button label="Confirm" onPress={confirmAccept} loading={busy} disabled={code.length < 4} />
              <Button label="Send it again" variant="ghost" onPress={sendCode} disabled={busy} />
            </>
          ) : (
            <>
              <Text style={styles.sheetLead}>
                We will email a code to your registered address. Entering it records your acceptance of the
                amount above.
              </Text>
              <Button label="Email me a code" onPress={sendCode} loading={busy} />
            </>
          )}

          {/* 🔴 Said plainly, on the screen where a person commits. This is a
              record of acceptance and a second factor — not a digital
              signature, and the copy must never imply one. */}
          <Text style={styles.sheetNote}>
            {theyInitiated
              ? 'The other party has accepted. Your confirmation closes the quotation at this amount.'
              : 'Both companies confirm. Yours is recorded now; the quotation is accepted once the other party confirms it too.'}{' '}
            This is a confirmed acceptance recorded on MPX Global, not a digital signature.
          </Text>

          <Button label="Cancel" variant="ghost" onPress={() => setAcceptOpen(false)} />
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { height: 1 },
  card: {
    alignSelf: 'stretch',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  // Inside a platform notice the band already provides the container.
  inline: { borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' },

  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[2] },
  pdfGlyph: {
    width: 34,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfGlyphText: { color: colors.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  headText: { flex: 1, minWidth: 0 },
  number: { fontSize: 13.5, fontWeight: '700', color: colors.ink[900] },
  sub: { fontSize: 11.5, color: colors.ink[500], marginTop: 1 },

  figureRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[2],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
  },
  figureCol: { flexShrink: 1 },
  figureLabel: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1, color: colors.ink[500] },
  figure: { fontSize: 18, fontWeight: '700', color: colors.ink[900], marginTop: 2 },
  quoted: { fontSize: 11, color: colors.ink[500], marginTop: 1 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: '700' },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[2],
    paddingBottom: spacing[2],
  },
  actionButton: { flexShrink: 0 },
  waiting: { flexShrink: 1, fontSize: 12.5, color: colors.ink[600] },

  sheet: { padding: spacing[4], paddingBottom: spacing[6], gap: spacing[3], backgroundColor: colors.white, flexGrow: 1 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { ...typography.h2, color: colors.ink[900] },
  sheetLead: { fontSize: 14, color: colors.ink[600], lineHeight: 20 },
  sheetNote: { fontSize: 12, color: colors.ink[500], lineHeight: 18 },
  error: {
    fontSize: 13,
    color: colors.danger[800],
    backgroundColor: colors.danger[100],
    borderRadius: radii.md,
    padding: spacing[2],
  },

  summary: { backgroundColor: colors.ink[50], borderRadius: radii.md, padding: spacing[2], gap: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] },
  summaryLabel: { fontSize: 13, color: colors.ink[500], flexShrink: 1 },
  summaryValue: { fontSize: 13, fontWeight: '700', color: colors.ink[900] },
});
