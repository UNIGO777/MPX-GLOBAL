/**
 * Quotation arithmetic — the SERVER's copy.
 *
 * 🔴 The client template ships its own `computeTotals` for the live preview, and
 * that is fine, but this one is authoritative. A total that arrives in a request
 * body is never stored: every save recomputes from the line items, so a tampered
 * or simply stale client can never move the number a buyer sees.
 *
 * 🔴 EVERY amount here is an INTEGER in MINOR UNITS (paise, cents). No float
 * arithmetic touches money anywhere in this file — `web-frontend.md` requires it
 * of the client and the same rule is what keeps Phase-2 escrow clean. Rates
 * arrive as minor units already; percentages are the only non-integer input and
 * they are applied with `Math.round` on the way out.
 *
 * 🔴 NO CURRENCY CONVERSION (§A27.1). Everything in one quotation is in that
 * quotation's own currency; nothing here reads an exchange rate.
 */

/** A charge with no amount is "Included" — not zero, and not missing. */
const isIncluded = (c) => c.amountMinor == null;

export function computeTotals(q) {
  const lines = (q.items ?? []).map((item) => {
    const qty = Number(item.qty) || 0;
    const rateMinor = Math.trunc(Number(item.rateMinor) || 0);
    return { ...item, qty, rateMinor, amountMinor: Math.round(qty * rateMinor) };
  });
  const subtotalMinor = lines.reduce((s, l) => s + l.amountMinor, 0);

  const charges = (q.charges ?? []).map((c) => ({
    label: c.label,
    included: isIncluded(c),
    amountMinor: isIncluded(c) ? 0 : Math.trunc(Number(c.amountMinor) || 0),
  }));
  const taxableMinor = subtotalMinor + charges.reduce((s, c) => s + c.amountMinor, 0);

  const taxes = (q.taxes ?? []).map((t) => ({
    label: t.label,
    ratePct: Number(t.ratePct) || 0,
    amountMinor: Math.round((taxableMinor * (Number(t.ratePct) || 0)) / 100),
  }));
  const totalMinor = taxableMinor + taxes.reduce((s, t) => s + t.amountMinor, 0);

  /**
   * 🔴 The LAST milestone absorbs the rounding remainder, so the schedule always
   * sums to the total exactly. Rounding each share independently leaves the
   * parts a paisa or two off the whole — on a payment schedule that is not a
   * cosmetic difference, it is a figure the two companies disagree about.
   */
  const milestones = q.payment?.milestones ?? [];
  let allocated = 0;
  const payments = milestones.map((m, i) => {
    const last = i === milestones.length - 1;
    const amountMinor = last
      ? totalMinor - allocated
      : Math.round((totalMinor * (Number(m.percent) || 0)) / 100);
    allocated += amountMinor;
    return { label: m.label, percent: Number(m.percent) || 0, amountMinor };
  });

  const percentTotal = milestones.reduce((s, m) => s + (Number(m.percent) || 0), 0);

  return { lines, subtotalMinor, charges, taxableMinor, taxes, totalMinor, payments, percentTotal };
}

/**
 * What must be true before a quotation can be SENT. Draft may be anything —
 * that is the point of a draft — but the moment it goes to a buyer these hold.
 */
export function validateForSend(q) {
  const t = computeTotals(q);
  const problems = [];

  if (t.lines.length === 0) problems.push('Add at least one item.');
  if (t.lines.some((l) => l.qty <= 0)) problems.push('Every item needs a quantity above zero.');
  if (!q.currency) problems.push('Choose a currency.');
  if (!q.validUntil) problems.push('Set a validity date.');

  // A schedule that does not add to 100% is the kind of error that only shows up
  // as a payment dispute, so it blocks sending rather than warning.
  if (t.payments.length > 0 && Math.abs(t.percentTotal - 100) > 0.001) {
    problems.push(`Payment milestones add up to ${t.percentTotal}%, not 100%.`);
  }

  return { ok: problems.length === 0, problems, totals: t };
}
