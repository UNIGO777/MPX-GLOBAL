import { describe, it, expect } from 'vitest';

import { computeTotals, validateForSend } from '../src/services/quotationTotals.js';

/**
 * Quotation arithmetic (Module 4, month 2).
 *
 * 🔴 This is the file where a mistake costs real money. A quotation is the
 * figure two companies transact against, so these tests pin the invariants
 * rather than a handful of happy examples:
 *   · every amount is an INTEGER in minor units — no float ever touches money;
 *   · the payment schedule sums to the total EXACTLY, whatever the percentages;
 *   · a charge with no amount is "Included", which is not the same as zero;
 *   · a client-supplied total is ignored — the server recomputes.
 */
const SAMPLE = {
  currency: 'INR',
  validUntil: '2099-01-01',
  items: [
    { name: 'Cotton Canvas 12oz', qty: 5000, unit: 'm', rateMinor: 45000 },
    { name: 'Water-repellent finish', qty: 5000, unit: 'm', rateMinor: 3000 },
    { name: 'Lab-dip approval', qty: 1, unit: 'lot', rateMinor: 600000 },
  ],
  charges: [{ label: 'Packing' }, { label: 'Freight & insurance', amountMinor: 7900000 }],
  taxes: [{ label: 'IGST 0% (export, LUT)', ratePct: 0 }],
  payment: { milestones: [{ label: '30% advance', percent: 30 }, { label: '70% against docs', percent: 70 }] },
};

describe('quotation totals', () => {
  it('reproduces the worked example from the design', () => {
    const t = computeTotals(SAMPLE);
    expect(t.subtotalMinor).toBe(240_600_000); // ₹24,06,000
    expect(t.totalMinor).toBe(248_500_000); //    ₹24,85,000
  });

  /**
   * 🔴 The invariant that matters most. Rounding each share independently leaves
   * the parts a paisa or two off the whole — on a payment schedule that is not
   * cosmetic, it is a number the two companies disagree about. The LAST
   * milestone absorbs the remainder.
   */
  it('always makes the payment schedule sum to the total, exactly', () => {
    const awkward = [
      [{ label: 'a', percent: 33.33 }, { label: 'b', percent: 33.33 }, { label: 'c', percent: 33.34 }],
      [{ label: 'a', percent: 1 }, { label: 'b', percent: 99 }],
      [{ label: 'only', percent: 100 }],
      Array.from({ length: 7 }, (_, i) => ({ label: `m${i}`, percent: 100 / 7 })),
    ];
    for (const milestones of awkward) {
      const t = computeTotals({ ...SAMPLE, payment: { milestones } });
      const summed = t.payments.reduce((s, p) => s + p.amountMinor, 0);
      expect(summed).toBe(t.totalMinor);
      for (const p of t.payments) expect(Number.isInteger(p.amountMinor)).toBe(true);
    }
  });

  it('keeps every amount an integer — no float touches money', () => {
    const t = computeTotals({
      ...SAMPLE,
      items: [{ name: 'odd', qty: 3, unit: 'kg', rateMinor: 3333 }],
      taxes: [{ label: 'GST 18%', ratePct: 18 }],
    });
    for (const l of t.lines) expect(Number.isInteger(l.amountMinor)).toBe(true);
    for (const tax of t.taxes) expect(Number.isInteger(tax.amountMinor)).toBe(true);
    expect(Number.isInteger(t.totalMinor)).toBe(true);
  });

  it('treats a charge with no amount as INCLUDED, not zero', () => {
    const t = computeTotals(SAMPLE);
    const packing = t.charges.find((c) => c.label === 'Packing');
    expect(packing.included).toBe(true);
    // It contributes nothing to the taxable base, but the document must be able
    // to print "Included" rather than a misleading 0.00.
    expect(packing.amountMinor).toBe(0);
    const freight = t.charges.find((c) => c.label.startsWith('Freight'));
    expect(freight.included).toBe(false);
  });

  it('taxes apply to subtotal PLUS charges, not to the subtotal alone', () => {
    const t = computeTotals({
      items: [{ name: 'x', qty: 1, rateMinor: 100_000 }],
      charges: [{ label: 'freight', amountMinor: 100_000 }],
      taxes: [{ label: 'GST 10%', ratePct: 10 }],
    });
    expect(t.taxableMinor).toBe(200_000);
    expect(t.taxes[0].amountMinor).toBe(20_000);
    expect(t.totalMinor).toBe(220_000);
  });

  /** A total in the request body must never survive. */
  it('ignores any total the caller supplies', () => {
    const t = computeTotals({ ...SAMPLE, totalMinor: 1, totals: { totalMinor: 1 } });
    expect(t.totalMinor).toBe(248_500_000);
  });
});

describe('validateForSend', () => {
  it('lets a complete quotation through', () => {
    expect(validateForSend(SAMPLE).ok).toBe(true);
  });

  it('blocks a schedule that does not add to 100%', () => {
    const r = validateForSend({
      ...SAMPLE,
      payment: { milestones: [{ label: 'a', percent: 30 }, { label: 'b', percent: 60 }] },
    });
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toContain('90%');
  });

  it('blocks no items, no currency, no validity, and a zero quantity', () => {
    expect(validateForSend({ ...SAMPLE, items: [] }).problems).toContain('Add at least one item.');
    expect(validateForSend({ ...SAMPLE, currency: undefined }).problems).toContain('Choose a currency.');
    expect(validateForSend({ ...SAMPLE, validUntil: undefined }).problems).toContain('Set a validity date.');
    expect(
      validateForSend({ ...SAMPLE, items: [{ name: 'x', qty: 0, rateMinor: 100 }] }).problems.join(' '),
    ).toContain('quantity above zero');
  });
});
