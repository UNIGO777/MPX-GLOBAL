import { completeJson, isAiConfigured } from './ai.client.js';
import { consumeAiQuota } from './aiQuota.service.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { containsContactDetails } from '../utils/contactDetails.js';

/**
 * Module 4 — "just tell it and it gets written" (owner, 2026-09-25): the payment
 * schedule, the charges and taxes, and the additional-details note.
 *
 * ── What this is allowed to be ────────────────────────────────────────────
 *
 * 🔴 **A SUGGESTION, never a decision.** The model's output lands in the
 * exporter's FORM, which they then read, edit and save like anything they typed.
 * Nothing here writes to a quotation, and nothing here can touch a SENT one —
 * a payment schedule on a document two companies transact against is not a thing
 * an LLM gets to set on its own.
 *
 * 🔴 **The output is validated as hostile input, because it is.** A model can
 * always answer with something unexpected: the shape is checked, the count is
 * capped, labels are trimmed and length-limited, percentages must be positive
 * numbers, and the schedule must add to 100. Anything else is refused outright
 * rather than "fixed up" — silently repairing a bad schedule is how a plausible
 * but wrong one reaches a buyer.
 *
 * 🔴 **It never sees the deal's money or the parties** (owner's choice,
 * 2026-09-25). The prompt carries the exporter's own instruction plus the
 * incoterm, the lead time and the CURRENCY CODE — the things that shape a
 * sensible answer. No line prices, no totals, no buyer or supplier name and no
 * bank details leave this server. Any figure the model returns is one the
 * exporter typed into their own sentence.
 *
 * 🔴 **It never writes legal terms.** Those come from `termsVersion`, a fixed
 * versioned clause set (see Quotation.js). A milestone label is a description of
 * a payment stage — "40% against B/L copy" — and the prompt says so explicitly.
 */

const MAX_CHARGES = 20;
const MAX_TAXES = 10;
const MAX_DETAILS = 2000;

const CHARGES_SYSTEM = `You turn a supplier's note into the charges and taxes of an export quotation.

Return JSON only, of exactly this shape:
{"charges":[{"label":"Ocean freight","amount":25000},{"label":"Insurance","amount":null}],
 "taxes":[{"label":"IGST","ratePct":18}]}

Rules:
- A charge's "amount" is a number in the quotation's currency, or null when the
  supplier says it is included in the price. Never invent an amount the supplier
  did not give — use null instead.
- A tax carries a percentage RATE, never an amount.
- At most ${MAX_CHARGES} charges and ${MAX_TAXES} taxes. Labels under 8 words.
- Never write legal or contractual clauses, payment terms, bank details or
  anything about penalties or interest.
- If the note describes neither a charge nor a tax, return {"charges":[],"taxes":[]}.`;

const DETAILS_SYSTEM = `You write the "additional details" note on an export quotation.

Return JSON only: {"details":"..."}

Rules:
- Plain prose the buyer reads, at most 8 short sentences. No headings, no markdown.
- It is a NOTE, never a contractual term: no governing law, no warranties, no
  penalties, no interest, no liability, no arbitration, no payment terms.
- Never include an email address, a phone number, a website or any way to
  contact the supplier outside this platform.
- Never invent prices, quantities, certifications, test results or dates the
  supplier did not give.
- If there is nothing to say, return {"details":""}.`;

/** Shared by all three drafters: configured, in quota, and a parsed answer. */
async function draft({ orgId, system, user }) {
  if (!isAiConfigured()) {
    throw AppError.badRequest(
      'ai not configured',
      'AI drafting is not available right now. You can fill this in by hand.',
    );
  }
  await consumeAiQuota(orgId);

  try {
    return JSON.parse(await completeJson({ system, user }));
  } catch (err) {
    logger.warn({ err: { name: err?.name, message: err?.message } }, 'quotation ai drafting failed');
    return null;
  }
}

const unusable = (what) =>
  AppError.badRequest(`ai ${what} unusable`, `Could not draft that. Try describing it differently.`);

/**
 * Charges and taxes.
 *
 * 🔴 An amount the model returns is MONEY ON A COMMERCIAL DOCUMENT, so this is
 * the strictest of the three: amounts must be non-negative finite numbers,
 * rates must be 0–100, and `null` is preserved as "Included" rather than
 * collapsed to zero — zero prints as free, which is a different promise.
 */
export async function suggestCharges({ orgId, instruction, incoterm, leadTime, currency }) {
  const context = [
    currency ? `Currency: ${currency}.` : null,
    incoterm ? `Incoterm: ${incoterm}.` : null,
    leadTime ? `Lead time: ${leadTime}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const parsed = await draft({
    orgId,
    system: CHARGES_SYSTEM,
    user: context ? `${context}\n\n${instruction}` : instruction,
  });
  if (!parsed) throw unusable('charges');

  const rawCharges = Array.isArray(parsed.charges) ? parsed.charges : [];
  const rawTaxes = Array.isArray(parsed.taxes) ? parsed.taxes : [];
  if (rawCharges.length === 0 && rawTaxes.length === 0) throw unusable('charges');
  if (rawCharges.length > MAX_CHARGES || rawTaxes.length > MAX_TAXES) throw unusable('charges');

  const charges = [];
  for (const row of rawCharges) {
    const label = typeof row?.label === 'string' ? row.label.trim().slice(0, 120) : '';
    if (!label) throw unusable('charges');
    // null / absent = "Included". Kept distinct from 0 on purpose.
    if (row?.amount == null) {
      charges.push({ label, amountMinor: null });
      continue;
    }
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount < 0) throw unusable('charges');
    charges.push({ label, amountMinor: Math.round(amount * 100) });
  }

  const taxes = [];
  for (const row of rawTaxes) {
    const label = typeof row?.label === 'string' ? row.label.trim().slice(0, 120) : '';
    const ratePct = Number(row?.ratePct);
    if (!label || !Number.isFinite(ratePct) || ratePct < 0 || ratePct > 100) throw unusable('charges');
    taxes.push({ label, ratePct: Math.round(ratePct * 100) / 100 });
  }

  return { charges, taxes };
}

/**
 * The additional-details note.
 *
 * 🔴 Refused if it carries CONTACT DETAILS. An email or a number in here routes
 * the buyer around the platform and its record of the deal — the same rule the
 * seller's own written specs follow (`contactDetails.js`). A model asked not to
 * write one still sometimes does, so it is checked rather than trusted.
 */
export async function suggestDetails({ orgId, instruction, incoterm, leadTime }) {
  const context = [incoterm ? `Incoterm: ${incoterm}.` : null, leadTime ? `Lead time: ${leadTime}.` : null]
    .filter(Boolean)
    .join(' ');

  const parsed = await draft({
    orgId,
    system: DETAILS_SYSTEM,
    user: context ? `${context}\n\n${instruction}` : instruction,
  });
  if (!parsed) throw unusable('details');

  const details = typeof parsed.details === 'string' ? parsed.details.trim() : '';
  if (!details || details.length > MAX_DETAILS) throw unusable('details');
  if (containsContactDetails(details)) {
    throw AppError.badRequest(
      'ai details contained contact details',
      'The draft included contact details, so it was discarded. Buyers reach you through this platform.',
    );
  }

  return details;
}

const MAX_MILESTONES = 10;
const MAX_LABEL = 160;

const SYSTEM = `You write payment schedules for export quotations.

Return JSON only, of exactly this shape:
{"milestones":[{"label":"30% advance with order","percent":30}]}

Rules:
- The percentages MUST add up to exactly 100.
- At most ${MAX_MILESTONES} milestones. Each percent is a positive number.
- A label names WHEN a payment falls due, in under 12 words, e.g.
  "Advance with purchase order", "Against B/L copy", "On delivery at destination".
- Never write legal or contractual clauses, warranties, penalties, interest,
  governing law, or anything about a bank account. Only payment stages.
- If the instruction does not describe a payment schedule, return
  {"milestones":[]}.`;

/**
 * Trust nothing about the shape. Every branch here has been reachable in
 * practice at some point with some model.
 */
function validate(parsed) {
  const rows = Array.isArray(parsed?.milestones) ? parsed.milestones : null;
  if (!rows || rows.length === 0 || rows.length > MAX_MILESTONES) return null;

  const clean = [];
  for (const row of rows) {
    const label = typeof row?.label === 'string' ? row.label.trim().slice(0, MAX_LABEL) : '';
    const percent = Number(row?.percent);
    if (!label) return null;
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return null;
    // Two decimals is what the form and the schema accept; a model returning
    // 33.333333 would fail validation downstream instead of here, where the
    // reason is legible.
    clean.push({ label, percent: Math.round(percent * 100) / 100 });
  }

  const sum = clean.reduce((total, row) => total + row.percent, 0);
  // A hair of float slack, and no more. `computeTotals` already makes the LAST
  // milestone absorb rounding so the money always equals the total — but that
  // is for rounding, not for a schedule that genuinely does not add up.
  if (Math.abs(sum - 100) > 0.011) return null;

  return clean;
}

/**
 * Draft a payment schedule from a sentence.
 *
 * @param {{orgId: string, instruction: string, incoterm?: string, leadTime?: string}} args
 * @returns {Promise<Array<{label: string, percent: number}>>}
 */
export async function suggestMilestones({ orgId, instruction, incoterm, leadTime }) {
  if (!isAiConfigured()) {
    // Honest and actionable — not a 500. The exporter can still type the rows.
    throw AppError.badRequest(
      'ai not configured',
      'AI drafting is not available right now. You can add the milestones by hand.',
    );
  }

  // api-endpoints B7: the per-org daily cap. An unbounded GPT endpoint is a
  // billing incident waiting to happen, and this one is behind a login where a
  // held key is worth more, not less.
  await consumeAiQuota(orgId);

  // Only these three things. See the header: no money, no party names.
  const context = [
    incoterm ? `Incoterm: ${incoterm}.` : null,
    leadTime ? `Lead time: ${leadTime}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  let milestones;
  try {
    const raw = await completeJson({
      system: SYSTEM,
      user: context ? `${context}\n\n${instruction}` : instruction,
    });
    milestones = validate(JSON.parse(raw));
  } catch (err) {
    // The SHAPE of the failure only — never the key, never the raw payload
    // (secrets-and-hygiene). The caller gets a generic message.
    logger.warn({ err: { name: err?.name, message: err?.message } }, 'quotation milestone drafting failed');
    milestones = null;
  }

  if (!milestones) {
    throw AppError.badRequest(
      'ai milestones unusable',
      'Could not draft a schedule from that. Try describing the stages and their percentages.',
    );
  }

  return milestones;
}
