import { Quotation, newAccessToken, formatQuotationNumber } from '../models/Quotation.js';
import { Conversation } from '../models/Conversation.js';
import { Organisation } from '../models/Organisation.js';
import { Product } from '../models/Product.js';
import { ExporterBankAccount } from '../models/ExporterBankAccount.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from './audit.service.js';
import { postSystemMessage } from './message.service.js';
import { computeTotals, validateForSend } from './quotationTotals.js';
import { suggestCharges, suggestDetails, suggestMilestones } from './quotationAi.service.js';
import { requestOtp, verifyOtp } from './otp.service.js';
import { decryptField } from '../utils/fieldCrypto.js';

/**
 * Module 4 — quotations, month 2 (Bucket A1, owner override 2026-09-24).
 *
 * 🔴 Every query scopes on `parties` (CLAUDE.md rule 1 + `model-decisions.md`
 * B1). A quotation belonging to another pair of companies is a **404, never a
 * 403** — a 403 confirms it exists.
 *
 * 🔴 Only the EXPORTER side writes the document; only the BUYER side declines.
 * Since 2026-09-25 either side may counter-offer, and acceptance is two-sided:
 * whoever accepts an offer THE OTHER SIDE made only opens it, and the other
 * party then CONFIRMS — a deal is closed only when both have, each with a code
 * sent to their own registered email. Nobody can accept their own figure, which
 * is why the supplier cannot open an acceptance on the document itself.
 * Every one of those checks is here, in the service, not only on the route.
 *
 * 🔴 Nothing a sent quotation shows is read live. `send()` SNAPSHOTS the bank
 * details, both companies and the totals onto the row. Editing the source
 * afterwards must never change a document already in a buyer's hands.
 */

const isExporterSide = (user, q) => String(q.exporterOrgId) === String(user.orgId);
const isBuyerSide = (user, q) => String(q.buyerOrgId) === String(user.orgId);
const sideOf = (user, q) => (isExporterSide(user, q) ? 'exporter' : 'buyer');

/**
 * The figure currently on the table.
 *
 * 🔴 The LAST offer wins, not the document's printed total. Once a counter-offer
 * exists, the printed total is history — reading `totals.totalMinor` here is how
 * a deal gets accepted at a price nobody last agreed to.
 */
export function currentFigureMinor(q) {
  const offers = q.offers ?? [];
  if (offers.length) return offers[offers.length - 1].totalMinor;
  return q.totals?.totalMinor ?? null;
}

/** Open to answering: sent or mid-negotiation, and not past its validity. */
function assertAnswerable(q) {
  const status = effectiveStatus(q);
  if (status !== 'sent' && status !== 'negotiating') {
    throw AppError.conflict('not open', 'This quotation can no longer be answered.');
  }
}

/** Display only — for the confirmation email, so a code is never blind. */
function formatMoney(minorUnits, currency) {
  if (minorUnits == null) return null;
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(minorUnits / 100);
  } catch {
    return `${currency} ${(minorUnits / 100).toFixed(2)}`;
  }
}

async function loadForParty({ user, id, select }) {
  const query = Quotation.findOne({ _id: id, parties: user.orgId });
  if (select) query.select(select);
  const q = await query;
  if (!q) throw AppError.notFound('quotation not found', 'Not found.');
  return q;
}

/** `expired` is derived, never a stored transition nobody triggered. */
export function effectiveStatus(q) {
  if (q.status === 'sent' && q.validUntil && new Date(q.validUntil) < new Date()) return 'expired';
  return q.status;
}

/** What either party may see in a list — no bank details, no access token. */
export function quotationView(q) {
  return {
    id: String(q._id),
    number: q.number,
    revision: q.revision,
    status: effectiveStatus(q),
    currency: q.currency,
    issueDate: q.issueDate ?? null,
    validUntil: q.validUntil ?? null,
    totalMinor: q.totals?.totalMinor ?? null,
    productId: q.productId ? String(q.productId) : null,
    conversationId: q.conversationId ? String(q.conversationId) : null,
    // What is actually on the table right now — after a counter-offer this is
    // NOT `totalMinor`, and every surface that shows a price must use it.
    currentFigureMinor: currentFigureMinor(q),
    offers: (q.offers ?? []).map((o) => ({
      by: o.by,
      totalMinor: o.totalMinor,
      note: o.note ?? null,
      at: o.at,
    })),
    // Who confirmed and when. Never the ip, the email or the user id — the
    // counterparty has no business with any of them.
    acceptance: q.acceptance?.initiated
      ? {
          initiatedBy: q.acceptance.initiated.side,
          initiatedAt: q.acceptance.initiated.at,
          confirmedBy: q.acceptance.confirmed?.side ?? null,
          confirmedAt: q.acceptance.confirmed?.at ?? null,
          agreedTotalMinor: q.acceptance.agreedTotalMinor ?? null,
        }
      : null,
    sentAt: q.sentAt ?? null,
    acceptedAt: q.acceptedAt ?? null,
    declinedAt: q.declinedAt ?? null,
  };
}

/**
 * The full document. `bankSnapshot.accountNumber` is `select: false`, so it is
 * absent unless the caller explicitly asked for it — which only the render path
 * does.
 */
export function quotationDocumentView(q) {
  return {
    ...quotationView(q),
    incoterm: q.incoterm ?? null,
    portOfLoading: q.portOfLoading ?? null,
    portOfDischarge: q.portOfDischarge ?? null,
    leadTime: q.leadTime ?? null,
    items: q.items ?? [],
    charges: q.charges ?? [],
    taxes: q.taxes ?? [],
    taxNote: q.taxNote ?? null,
    payment: q.payment ?? { milestones: [], note: null },
    delivery: q.delivery ?? { rows: [], note: null },
    termsVersion: q.termsVersion,
    additionalDetails: q.additionalDetails ?? null,
    totals: q.totals ?? computeTotals(q),
    supplier: q.supplier ?? null,
    buyer: q.buyer ?? null,
    bank: q.bankSnapshot
      ? {
          beneficiary: q.bankSnapshot.beneficiary,
          bankName: q.bankSnapshot.bankName,
          branch: q.bankSnapshot.branch ?? null,
          masked: q.bankSnapshot.last4 ? `••••${q.bankSnapshot.last4}` : null,
          /**
           * Present only when the caller selected it (the document render), and
           * stored ENCRYPTED since 2026-09-25 — the snapshot carries the same
           * ciphertext the saved account did, so it is decrypted here, at the
           * one point it is actually printed.
           */
          accountNumber: decryptField(q.bankSnapshot.accountNumber),
          swift: q.bankSnapshot.swift ?? null,
          ifsc: q.bankSnapshot.ifsc ?? null,
        }
      : null,
    declineReason: q.declineReason ?? null,
  };
}

/** Per-year sequence. Collisions are impossible: `number` is uniquely indexed. */
async function nextNumber() {
  const year = new Date().getUTCFullYear();
  const count = await Quotation.countDocuments({
    number: new RegExp(`^MPX-Q-${year}-`),
  });
  return formatQuotationNumber(year, count + 1);
}

/**
 * Start a draft from a chat thread. Everything the platform already knows is
 * pre-filled; the exporter fills the rest.
 */
export async function createDraft({ user, conversationId, actor, meta }) {
  if (user.role !== 'exporter') {
    throw AppError.forbidden('not an exporter', 'Only the supplier can create a quotation.');
  }

  const conversation = await Conversation.findOne({ _id: conversationId, parties: user.orgId });
  if (!conversation) throw AppError.notFound('conversation not found', 'Not found.');
  if (conversation.blocked || conversation.frozen) {
    throw AppError.conflict('conversation not writable', 'This conversation is not open.');
  }

  // Explicit `_id` filters, not `findById` — the A6 lint guard bans `findById*`
  // outright so an unscoped read can never be written by habit. These ids are
  // read off a conversation that was already scoped to the caller's org above,
  // so they are the caller's own thread, its product and its two companies.
  const [product, supplierOrg, buyerOrg] = await Promise.all([
    Product.findOne({ _id: conversation.productId }),
    Organisation.findOne({ _id: conversation.exporterOrgId }),
    Organisation.findOne({ _id: conversation.buyerOrgId }),
  ]);

  const draft = await Quotation.create({
    inquiryId: conversation.inquiryId,
    conversationId: conversation._id,
    productId: conversation.productId,
    buyerOrgId: conversation.buyerOrgId,
    exporterOrgId: conversation.exporterOrgId,
    createdBy: user.userId ?? user._id,
    number: await nextNumber(),
    status: 'draft',
    currency: product?.price?.currency ?? 'INR',
    leadTime: product?.leadTime ?? undefined,
    // One line, pre-filled from the product. The exporter edits it — this is a
    // starting point, not an assumption about what they are quoting.
    items: product
      ? [
          {
            name: product.name,
            hsCode: product.hsCode ?? undefined,
            qty: product.moq ?? 1,
            unit: product.unit ?? undefined,
            rateMinor: product.price?.min != null ? Math.round(product.price.min * 100) : 0,
          },
        ]
      : [],
    supplier: {
      name: supplierOrg?.name,
      country: supplierOrg?.country,
      verified: supplierOrg?.kycStatus === 'verified',
    },
    buyer: { name: buyerOrg?.name, country: buyerOrg?.country },
  });

  await recordAudit({
    actor,
    action: 'quotation.create',
    entityType: 'Quotation',
    entityId: draft._id,
    orgId: user.orgId,
    before: null,
    after: { number: draft.number, conversationId: String(conversation._id) },
    meta,
  });

  return quotationDocumentView(draft);
}

export async function updateDraft({ user, id, data, actor, meta }) {
  const q = await loadForParty({ user, id });
  /**
   * 🔴 404, not 403 — found by the test that expected one. A DRAFT is the
   * supplier's private working copy: answering 403 tells the buyer one exists
   * and is being written, which is exactly the fact a draft is meant to hide.
   * `getOne` already hid it; this path did not, so the two disagreed.
   */
  if (!isExporterSide(user, q)) throw AppError.notFound('quotation not found', 'Not found.');
  if (q.status !== 'draft') {
    // A sent document is a record. Changing it means a new revision, not an edit.
    throw AppError.conflict('not a draft', 'This quotation has been sent. Create a revision instead.');
  }

  Object.assign(q, data);
  await q.save();

  await recordAudit({
    actor,
    action: 'quotation.update',
    entityType: 'Quotation',
    entityId: q._id,
    orgId: user.orgId,
    before: null,
    after: { number: q.number, fields: Object.keys(data) },
    meta,
  });

  return quotationDocumentView(q);
}

/**
 * Send it. This is where everything freezes.
 *
 * 🔴 The bank details are COPIED here, not linked. If this stored
 * `bankAccountId` and the document rendered from it, then editing the saved
 * account would rewrite every quotation already sent — a buyer would open last
 * month's document and find a different account. That is the whole attack this
 * design exists to survive.
 */
export async function send({ user, id, bankAccountId, actor, meta }) {
  const q = await loadForParty({ user, id });
  // Same reasoning as updateDraft: a draft must not be discoverable by the buyer.
  if (!isExporterSide(user, q)) throw AppError.notFound('quotation not found', 'Not found.');
  if (q.status !== 'draft') throw AppError.conflict('already sent', 'This quotation has already been sent.');

  const check = validateForSend(q);
  if (!check.ok) {
    throw AppError.badRequest('quotation incomplete', check.problems.join(' '));
  }

  if (bankAccountId) {
    const account = await ExporterBankAccount.findOne({
      _id: bankAccountId,
      exporterOrgId: user.orgId,
      isActive: true,
    }).select('+accountNumber');
    if (!account) throw AppError.notFound('bank account not found', 'Not found.');

    q.bankSnapshot = {
      beneficiary: account.beneficiary,
      bankName: account.bankName,
      branch: account.branch,
      // Copied as-is — it is already ciphertext, and re-encrypting a value that
      // is about to be frozen buys nothing. `quotationDocumentView` decrypts it.
      accountNumber: account.accountNumber,
      last4: account.last4,
      swift: account.swift,
      ifsc: account.ifsc,
    };
    // The exporter has just looked at these and sent them — that IS a confirmation.
    account.lastConfirmedAt = new Date();
    await account.save();
  }

  q.totals = check.totals;
  q.status = 'sent';
  q.issueDate = q.issueDate ?? new Date();
  q.sentAt = new Date();
  q.accessToken = newAccessToken();
  await q.save();

  // A NOTICE in the thread, never the document itself: duplicating prices into a
  // chat message creates a second copy that can disagree with the quotation.
  if (q.conversationId) {
    await postSystemMessage({
      conversationId: q.conversationId,
      body: `Quotation ${q.number} was sent.`,
      systemKind: 'quotation_sent',
      quotationId: q._id,
    });
  }

  await recordAudit({
    actor,
    action: 'quotation.send',
    entityType: 'Quotation',
    entityId: q._id,
    orgId: user.orgId,
    before: { status: 'draft' },
    // last4 only — never the account number (security-baseline rule 4).
    after: { status: 'sent', number: q.number, totalMinor: q.totals.totalMinor, bankLast4: q.bankSnapshot?.last4 ?? null },
    meta,
  });

  return quotationDocumentView(q);
}

/**
 * A counter-offer (owner, 2026-09-25 — "like OLX").
 *
 * 🔴 A counter-offer is NOT a rejection. The quotation stays live as
 * `negotiating`; ending it on a lower number would kill deals that are working.
 *
 * 🔴 It CLEARS a half-finished acceptance. If one side had already confirmed and
 * the other then changes the price, that confirmation was for a figure nobody is
 * offering any more — carrying it forward would let the second confirmation close
 * a deal at a number the first party never saw.
 *
 * 🔴 Nobody may offer twice in a row. An offer is an answer; two in a row is a
 * party bidding against itself, and it makes "what was last on the table"
 * ambiguous. The document itself is the supplier's opening offer, so the first
 * counter can only come from the buyer.
 */
export async function negotiate({ user, id, totalMinor, note, actor, meta }) {
  const q = await loadForParty({ user, id });
  assertAnswerable(q);

  const side = sideOf(user, q);
  const offers = q.offers ?? [];
  const last = offers.length ? offers[offers.length - 1] : null;

  if (!last && side !== 'buyer') {
    throw AppError.conflict(
      'supplier cannot counter own quotation',
      'This quotation is your own offer. Wait for the buyer to respond.',
    );
  }
  if (last && last.by === side) {
    throw AppError.conflict('already offered', 'Your offer is on the table. Wait for the other side to respond.');
  }
  /**
   * ⚠️ A party who has already accepted is NOT refused here, and that is
   * deliberate (2026-09-25). The owner asked for their Negotiate BUTTON to go,
   * and it has — but refusing the call as well would make counter-offers
   * impossible once any acceptance is open: strict turn-taking means the only
   * party who could counter at that point is the one who accepted, so the
   * "a counter-offer wipes a half-finished acceptance" safety net would become
   * unreachable and the initiator would be left with no move at all while the
   * other side ignored them. Countering here IS the withdrawal, and it wipes the
   * acceptance below. If a proper "withdraw my acceptance" action is ever built,
   * close this off at the same time.
   */
  if (totalMinor === currentFigureMinor(q)) {
    throw AppError.badRequest('same figure', 'That is the figure already on the table — accept it instead.');
  }

  offers.push({ by: side, userId: user.userId, totalMinor, note, at: new Date() });
  const hadAcceptance = Boolean(q.acceptance);
  q.offers = offers;
  q.status = 'negotiating';
  await q.save();

  /**
   * 🔴 An explicit `$unset`, because neither `q.acceptance = undefined` nor
   * `q.set('acceptance', undefined)` clears a subdocument — Mongoose marks
   * nothing modified and the stale confirmation survives the save. Both were
   * tried and both silently kept it; the "a counter-offer WIPES a half-finished
   * acceptance" test is what caught it, and that is precisely the case that would
   * otherwise let the second party close a deal at a figure the first never saw.
   */
  if (hadAcceptance) {
    // Scoped, not `{ _id }` alone (CLAUDE.md rule 1) — the row was loaded under
    // the caller's scope and the write stays under it too.
    await Quotation.updateOne({ _id: q._id, parties: user.orgId }, { $unset: { acceptance: '' } });
  }

  if (q.conversationId) {
    await postSystemMessage({
      conversationId: q.conversationId,
      body: `${side === 'buyer' ? 'The buyer' : 'The supplier'} offered ${formatMoney(totalMinor, q.currency)} on quotation ${q.number}.`,
      systemKind: 'quotation_offer',
      quotationId: q._id,
    });
  }

  await recordAudit({
    actor,
    action: 'quotation.negotiate',
    entityType: 'Quotation',
    entityId: q._id,
    orgId: user.orgId,
    before: null,
    after: { number: q.number, by: side, totalMinor },
    meta,
  });

  // Read back rather than render the in-memory document: the `$unset` above
  // happened outside it, so `q` still carries the acceptance it just cleared.
  return quotationDocumentView(await Quotation.findOne({ _id: q._id, parties: user.orgId }));
}

/**
 * 🔴 YOU MAY ONLY ACCEPT AN OFFER THE OTHER SIDE PUT ON THE TABLE.
 *
 * Owner, 2026-09-25: first "don't show the accept button, when the buyer
 * accepted only then exporter can confirm" — then, on hitting it, "can't see
 * the accept button on buyer's offer". Both are the same rule stated from two
 * ends, and this is it:
 *
 *   · no counter-offers yet → the document IS the supplier's offer, so only the
 *     BUYER can accept it. A supplier accepting their own price decides nothing
 *     and would park a half-done acceptance on a buyer who never answered.
 *   · the buyer has countered → that figure is the BUYER's offer, so the
 *     SUPPLIER can accept it, and the buyer then confirms.
 *
 * The first version only implemented the first bullet, which left a supplier
 * looking at a buyer's price with no way to say yes — the deal could only close
 * if the buyer accepted their own number first. That is the bug this replaces.
 *
 * Enforced here, not by hiding a button: a hidden button is not access control
 * (CLAUDE.md #2 and #5).
 */
function assertMayInitiate({ q, side }) {
  if (q.acceptance?.initiated) return; // answering someone else's acceptance

  const offers = q.offers ?? [];
  const last = offers.length ? offers[offers.length - 1] : null;
  const figureIsTheirs = last ? last.by !== side : side === 'buyer';
  if (figureIsTheirs) return;

  throw AppError.conflict(
    'cannot accept own offer',
    last
      ? 'Your own offer is on the table. The other side answers it.'
      : 'The buyer accepts first. You will be asked to confirm once they have.',
  );
}

/**
 * Step 1 of accepting: send the caller a code at their OWN registered email.
 *
 * 🔴 This is an ACCEPTANCE RECORD, not a digital signature (owner, 2026-09-25).
 * Under the IT Act a digital/electronic signature means a licensed CA's
 * certificate or a notified technique such as Aadhaar eSign; an email code is
 * neither. Never label it a signature anywhere a user can read.
 *
 * 🔴 The address comes off the user's record, never the request (A3), and the
 * email names the quotation and the figure so nobody confirms blind.
 */
export async function requestAcceptCode({ user, id }) {
  const q = await loadForParty({ user, id });
  assertAnswerable(q);

  const side = sideOf(user, q);
  if (q.acceptance?.initiated?.side === side) {
    throw AppError.conflict(
      'already confirmed',
      'You have already confirmed this quotation. It is waiting for the other party.',
    );
  }
  assertMayInitiate({ q, side });

  // The caller's OWN record, taken from the token — the address a code goes to
  // is never one the request supplied (A3).
  const account = await User.findOne({ _id: user.userId });
  if (!account?.email) {
    throw AppError.badRequest('no email on account', 'Your account has no email address to send a code to.');
  }

  // The other company on a quotation this caller is already a party to.
  const counterparty = await Organisation.findOne({
    _id: side === 'buyer' ? q.exporterOrgId : q.buyerOrgId,
  });

  await requestOtp({
    user: account,
    purpose: 'quotation_accept',
    channel: 'email',
    // Binds the code to THIS quotation: one live challenge per purpose means a
    // code emailed about another quotation would otherwise verify here.
    subjectRef: q._id,
    context: {
      number: q.number,
      counterpartyName: counterparty?.name,
      amountText: formatMoney(currentFigureMinor(q), q.currency),
    },
  });

  // The address is never returned — the caller already knows their own inbox,
  // and echoing it back turns any session into an email-disclosure oracle.
  return { sent: true };
}

/**
 * Step 2: the code proves it. The buyer's confirmation only INITIATES — the
 * quotation is accepted when the supplier has confirmed it too.
 *
 * 🔴 Every state check happens BEFORE `verifyOtp`. Verifying first would consume
 * a single-use code on a request that was going to be refused anyway, and the
 * user would have to wait out a new one to learn why.
 */
export async function confirmAccept({ user, id, code, actor, meta }) {
  const q = await loadForParty({ user, id });
  assertAnswerable(q);

  const side = sideOf(user, q);
  const initiated = q.acceptance?.initiated;
  if (initiated?.side === side) {
    throw AppError.conflict(
      'already confirmed',
      'You have already confirmed this quotation. It is waiting for the other party.',
    );
  }
  assertMayInitiate({ q, side });

  const figure = currentFigureMinor(q);
  if (figure == null) {
    throw AppError.conflict('no figure', 'This quotation has no total to accept.');
  }
  // Defensive: a new offer clears the acceptance, so the two can only disagree
  // if something wrote the row outside this service. Refuse rather than close a
  // deal at a figure the first party never saw.
  if (initiated && q.acceptance.agreedTotalMinor !== figure) {
    throw AppError.conflict('figure changed', 'The amount has changed. Please review the quotation again.');
  }

  await verifyOtp({ userId: user.userId, purpose: 'quotation_accept', code, subjectRef: q._id });

  const account = await User.findOne({ _id: user.userId });
  const record = {
    side,
    userId: user.userId,
    at: new Date(),
    ip: meta?.ip,
    email: account?.email,
  };

  if (!initiated) {
    q.acceptance = { initiated: record, agreedTotalMinor: figure };
  } else {
    q.acceptance.confirmed = record;
    q.status = 'accepted';
    q.acceptedAt = record.at;
  }
  await q.save();

  const bothConfirmed = q.status === 'accepted';
  if (q.conversationId) {
    await postSystemMessage({
      conversationId: q.conversationId,
      body: bothConfirmed
        ? `Quotation ${q.number} was accepted by both parties at ${formatMoney(figure, q.currency)}.`
        : `${side === 'buyer' ? 'The buyer' : 'The supplier'} confirmed acceptance of quotation ${q.number} at ${formatMoney(figure, q.currency)}. Waiting for the other party to confirm.`,
      systemKind: bothConfirmed ? 'quotation_accepted' : 'quotation_accept_pending',
      quotationId: q._id,
    });
  }

  await recordAudit({
    actor,
    action: bothConfirmed ? 'quotation.accept' : 'quotation.accept.initiate',
    entityType: 'Quotation',
    entityId: q._id,
    orgId: user.orgId,
    before: null,
    // The confirming side and the agreed figure — never the code, never the
    // address it went to (security-baseline rule 4).
    after: { number: q.number, by: side, agreedTotalMinor: figure, status: q.status },
    meta,
  });

  return quotationDocumentView(q);
}

/**
 * Declining ends it. Still buyer-only: the supplier's exit is to stop
 * countering, and letting them close a live negotiation unilaterally is a
 * behaviour the owner has not asked for.
 */
export async function decline({ user, id, reason, actor, meta }) {
  const q = await loadForParty({ user, id });
  if (!isBuyerSide(user, q)) {
    throw AppError.forbidden('not the buyer', 'Only the buyer can decline this quotation.');
  }
  assertAnswerable(q);

  const before = q.status;
  q.status = 'declined';
  q.declinedAt = new Date();
  if (reason) q.declineReason = reason;
  await q.save();

  if (q.conversationId) {
    await postSystemMessage({
      conversationId: q.conversationId,
      body: `Quotation ${q.number} was declined.`,
      systemKind: 'quotation_declined',
      quotationId: q._id,
    });
  }

  await recordAudit({
    actor,
    action: 'quotation.decline',
    entityType: 'Quotation',
    entityId: q._id,
    orgId: user.orgId,
    before: { status: before },
    after: { status: q.status, ...(reason ? { reason } : {}) },
    meta,
  });

  return quotationView(q);
}

/**
 * Draft part of a quotation from a sentence (owner, 2026-09-25) — the payment
 * schedule, the charges and taxes, or the additional-details note.
 *
 * 🔴 It returns a SUGGESTION and writes nothing. The exporter reviews it in the
 * form and saves it like anything they typed — an LLM does not get to set the
 * terms or the money on a document two companies transact against.
 *
 * 🔴 DRAFT ONLY, and exporter-side only. A sent quotation is a record; there is
 * no path here that could touch one.
 *
 * 🔴 The incoterm and lead time are read off the DRAFT, not taken from the
 * request. The only thing the caller supplies is their own sentence, so there is
 * nothing in the body that could widen what reaches OpenAI.
 */
export async function draftWithAi({ user, id, target, instruction }) {
  const q = await loadForParty({ user, id });
  // Same reasoning as updateDraft: a draft is invisible to the buyer, so this is
  // a 404 rather than a 403.
  if (!isExporterSide(user, q)) throw AppError.notFound('quotation not found', 'Not found.');
  if (q.status !== 'draft') {
    throw AppError.conflict('not a draft', 'This quotation has been sent. Create a revision instead.');
  }

  const context = { orgId: user.orgId, instruction, incoterm: q.incoterm, leadTime: q.leadTime };

  if (target === 'charges') return suggestCharges({ ...context, currency: q.currency });
  if (target === 'details') return { details: await suggestDetails(context) };
  return { milestones: await suggestMilestones(context) };
}

export async function listForConversation({ user, conversationId }) {
  const conversation = await Conversation.findOne({ _id: conversationId, parties: user.orgId });
  if (!conversation) throw AppError.notFound('conversation not found', 'Not found.');

  const rows = await Quotation.find({
    conversationId,
    parties: user.orgId,
    // A draft is the supplier's own working copy — the buyer must not see one.
    ...(String(conversation.buyerOrgId) === String(user.orgId) ? { status: { $ne: 'draft' } } : {}),
  }).sort({ createdAt: -1 });

  return rows.map(quotationView);
}

export async function getOne({ user, id }) {
  const q = await loadForParty({ user, id, select: '+bankSnapshot.accountNumber' });
  if (q.status === 'draft' && !isExporterSide(user, q)) {
    throw AppError.notFound('quotation not found', 'Not found.');
  }
  return quotationDocumentView(q);
}
