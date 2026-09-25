import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// Capture the acceptance codes instead of "sending" them — there is no mail
// provider in tests, and the code is argon2-hashed into the challenge, so this
// is the only way to complete a confirmation.
const { otpBox } = vi.hoisted(() => ({ otpBox: { byId: new Map() } }));
vi.mock('../src/services/otp.sender.js', () => ({
  sendOtp: async ({ identifier, code }) => {
    otpBox.byId.set(identifier, code);
  },
}));

// The model is never called for real in tests. `aiReply` is what the fake
// OpenAI wrapper returns, so each case can pin what happens to a given answer.
const { aiReply } = vi.hoisted(() => ({ aiReply: { value: '' } }));
vi.mock('../src/services/ai.client.js', () => ({
  isAiConfigured: () => true,
  completeJson: async () => aiReply.value,
}));

vi.mock('../src/services/kyc.storage.service.js', () => ({
  uploadKycDocument: vi.fn(),
  verifyKycFile: vi.fn(),
  deleteKycFile: vi.fn(async () => 'ok'),
  signedKycUrl: vi.fn(() => ({ url: 'https://signed.fake/x', expiresAt: new Date().toISOString() })),
}));

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { Product } = await import('../src/models/Product.js');
const { Category } = await import('../src/models/Category.js');
const { Inquiry } = await import('../src/models/Inquiry.js');
const { Conversation } = await import('../src/models/Conversation.js');
const { Message } = await import('../src/models/Message.js');
const { Quotation } = await import('../src/models/Quotation.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { decryptField } = await import('../src/utils/fieldCrypto.js');
const { hashPassword } = await import('../src/services/password.service.js');

/**
 * Module 4 — quotations (month 2).
 *
 * 🔴 The test that matters most is the SNAPSHOT one. A sent quotation must be a
 * frozen record: if it rendered live from the exporter's saved bank account,
 * editing that account would rewrite every document already in a buyer's hands
 * — they would open last month's quotation and find a different account number.
 * That is the attack the whole design exists to survive, and nothing else here
 * protects against it.
 */
const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const RUN = String(Date.now()).slice(-7);
let seq = 0;

async function makeOrgUser(role) {
  seq += 1;
  const org = await Organisation.create({
    name: `${role} Q Co ${seq}`,
    type: 'business',
    buyerSide: role === 'buyer',
    exporterSide: role === 'exporter',
    country: 'IN',
  });
  const user = await User.create({
    name: `${role}-q-${seq}`,
    email: `q_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `9${RUN}${seq}`, e164: `+919${RUN}${seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
  });
  return { user, org, token: signAccessToken(user) };
}

/** A buyer, an exporter and an open thread between them about one product. */
async function makeThread() {
  const exporter = await makeOrgUser('exporter');
  const buyer = await makeOrgUser('buyer');
  seq += 1;
  // A16: a TOP category must not carry a type — it is derived from its leaves.
  const top = await Category.create({ name: `Top ${seq}`, slug: `top-q-${RUN}-${seq}` });
  const category = await Category.create({
    name: `Cat ${seq}`,
    slug: `cat-q-${RUN}-${seq}`,
    parentId: top._id,
    type: 'goods',
  });
  const product = await Product.create({
    exporterOrgId: exporter.org._id,
    categoryId: category._id,
    name: `Canvas ${seq}`,
    slug: `canvas-q-${RUN}-${seq}`,
    status: 'active',
    moq: 500,
    unit: 'm',
    price: { mode: 'range', min: 450, max: 520, currency: 'INR' },
  });
  const inquiry = await Inquiry.create({
    buyerOrgId: buyer.org._id,
    exporterOrgId: exporter.org._id,
    productId: product._id,
    note: 'need a quote',
    createdBy: buyer.user._id,
  });
  const conversation = await Conversation.create({
    inquiryId: inquiry._id,
    buyerOrgId: buyer.org._id,
    exporterOrgId: exporter.org._id,
    productId: product._id,
    productNameSnapshot: product.name,
    buyerOrgName: buyer.org.name,
    exporterOrgName: exporter.org.name,
  });
  return { exporter, buyer, product, conversation };
}

const makeBank = (exporter) =>
  request(app).post('/me/bank-accounts').set(bearer(exporter.token)).send({
    label: 'HDFC current',
    beneficiary: 'Q Exports',
    bankName: 'HDFC Bank',
    accountNumber: '1111 2222 3333 4444',
    ifsc: 'HDFC0001234',
  });

/** A draft that passes `validateForSend`. */
async function readyDraft(t) {
  const created = await request(app)
    .post('/quotations')
    .set(bearer(t.exporter.token))
    .send({ conversationId: String(t.conversation._id) });
  const id = created.body.quotation.id;
  await request(app)
    .patch(`/quotations/${id}`)
    .set(bearer(t.exporter.token))
    .send({
      validUntil: '2099-01-01',
      items: [{ name: 'Canvas', qty: 1000, unit: 'm', rateMinor: 45000 }],
      payment: { milestones: [{ label: '30% advance', percent: 30 }, { label: '70% on docs', percent: 70 }] },
    });
  return id;
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
});

describe('quotations · who may do what', () => {
  it('only the supplier creates and edits; the buyer cannot', async () => {
    const t = await makeThread();
    expect(
      (await request(app).post('/quotations').set(bearer(t.buyer.token)).send({ conversationId: String(t.conversation._id) }))
        .status,
    ).toBe(403);

    const id = await readyDraft(t);
    expect(
      (await request(app).patch(`/quotations/${id}`).set(bearer(t.buyer.token)).send({ taxNote: 'x' })).status,
    ).toBe(404); // a draft is invisible to the buyer at all
  });

  it("another pair's quotation is a 404, never a 403", async () => {
    const t = await makeThread();
    const other = await makeOrgUser('exporter');
    const id = await readyDraft(t);
    for (const path of [`/quotations/${id}`]) {
      expect((await request(app).get(path).set(bearer(other.token))).status).toBe(404);
    }
    expect(
      (await request(app).post(`/quotations/${id}/send`).set(bearer(other.token)).send({})).status,
    ).toBe(404);
  });

  it('only the buyer declines — the supplier cannot decline their own quotation', async () => {
    const t = await makeThread();
    const id = await readyDraft(t);
    await request(app).post(`/quotations/${id}/send`).set(bearer(t.exporter.token)).send({});

    expect((await request(app).post(`/quotations/${id}/decline`).set(bearer(t.exporter.token)).send({})).status).toBe(403);
    expect((await request(app).post(`/quotations/${id}/decline`).set(bearer(t.buyer.token)).send({})).status).toBe(200);
  });

  /**
   * 🔴 The bypass test. The whole point of confirming with a code is lost if a
   * plain "accept" route still exists beside it, so assert that it does not.
   */
  it('has NO single-shot accept route — acceptance is only ever code-confirmed', async () => {
    const t = await makeThread();
    const id = await readyDraft(t);
    await request(app).post(`/quotations/${id}/send`).set(bearer(t.exporter.token)).send({});

    expect((await request(app).post(`/quotations/${id}/accept`).set(bearer(t.buyer.token)).send({})).status).toBe(404);

    const stored = await Quotation.findById(id);
    expect(stored.status).toBe('sent');
  });
});

/**
 * Negotiation and the two-sided acceptance (owner, 2026-09-25 — "like OLX").
 *
 * 🔴 The acceptance is an ACCEPTANCE RECORD, not a digital signature. These tests
 * pin the behaviour that makes the record worth anything: both parties confirm,
 * each with a code sent to their own registered email, and the figure they agreed
 * is the one that was last on the table.
 */
describe('quotations · negotiation and confirmed acceptance', () => {
  const codeFor = (u) => otpBox.byId.get(u.user.email);

  async function sentQuotation() {
    const t = await makeThread();
    const id = await readyDraft(t);
    await request(app).post(`/quotations/${id}/send`).set(bearer(t.exporter.token)).send({});
    return { t, id };
  }

  async function confirm(id, party) {
    const asked = await request(app).post(`/quotations/${id}/accept/request-code`).set(bearer(party.token)).send({});
    if (asked.status !== 200) return asked;
    return request(app)
      .post(`/quotations/${id}/accept/confirm`)
      .set(bearer(party.token))
      .send({ code: codeFor(party) });
  }

  it('a counter-offer keeps the quotation LIVE — negotiating is not a rejection', async () => {
    const { t, id } = await sentQuotation();
    const res = await request(app)
      .post(`/quotations/${id}/negotiate`)
      .set(bearer(t.buyer.token))
      .send({ totalMinor: 500000, note: 'Best we can do.' });

    expect(res.status).toBe(200);
    expect(res.body.quotation.status).toBe('negotiating');
    expect(res.body.quotation.currentFigureMinor).toBe(500000);
    expect(res.body.quotation.offers).toHaveLength(1);
    expect(res.body.quotation.offers[0].by).toBe('buyer');
  });

  /**
   * 🔴 The owner typed 5e33 into a counter-offer and got "Invalid request." —
   * true, useless, and it left them unable to tell a typo from a broken form.
   * A stated ceiling is both the guard and a sentence a person can act on.
   */
  it('refuses an absurd amount, and SAYS why rather than "Invalid request."', async () => {
    const { t, id } = await sentQuotation();
    const res = await request(app)
      .post(`/quotations/${id}/negotiate`)
      .set(bearer(t.buyer.token))
      .send({ totalMinor: 5e35 });

    expect(res.status).toBe(400);
    // The field-level message is what the form shows next to the input.
    expect(res.body.error.fields?.[0]?.field).toBe('body.totalMinor');
    expect(res.body.error.fields?.[0]?.message).toMatch(/too large/i);
    expect((await Quotation.findById(id)).offers).toHaveLength(0);
  });

  it('nobody may offer twice in a row, and the supplier cannot counter their own quotation', async () => {
    const { t, id } = await sentQuotation();

    // The document IS the supplier's offer — the first counter can only be the buyer's.
    expect(
      (await request(app).post(`/quotations/${id}/negotiate`).set(bearer(t.exporter.token)).send({ totalMinor: 10 }))
        .status,
    ).toBe(409);

    await request(app).post(`/quotations/${id}/negotiate`).set(bearer(t.buyer.token)).send({ totalMinor: 500000 });
    expect(
      (await request(app).post(`/quotations/${id}/negotiate`).set(bearer(t.buyer.token)).send({ totalMinor: 400000 }))
        .status,
    ).toBe(409);

    // The supplier answers, and now the buyer may answer again.
    expect(
      (await request(app).post(`/quotations/${id}/negotiate`).set(bearer(t.exporter.token)).send({ totalMinor: 550000 }))
        .status,
    ).toBe(200);
    expect(
      (await request(app).post(`/quotations/${id}/negotiate`).set(bearer(t.buyer.token)).send({ totalMinor: 520000 }))
        .status,
    ).toBe(200);
  });

  it('ONE side confirming does not accept the quotation — both must confirm', async () => {
    const { t, id } = await sentQuotation();

    const first = await confirm(id, t.buyer);
    expect(first.status).toBe(200);
    expect(first.body.quotation.status).toBe('sent'); // NOT accepted
    expect(first.body.quotation.acceptance.initiatedBy).toBe('buyer');
    expect(first.body.quotation.acceptance.confirmedBy).toBeNull();

    // The same side cannot stand in for the other.
    expect((await request(app).post(`/quotations/${id}/accept/request-code`).set(bearer(t.buyer.token)).send({})).status)
      .toBe(409);

    const second = await confirm(id, t.exporter);
    expect(second.status).toBe(200);
    expect(second.body.quotation.status).toBe('accepted');
    expect(second.body.quotation.acceptance.confirmedBy).toBe('exporter');
  });

  /**
   * 🔴 The rule the owner hit in the browser: with the buyer's counter-offer on
   * the table, the SUPPLIER must be able to accept it. The first version let
   * only the buyer ever open an acceptance, so a supplier looking at a buyer's
   * price had no way to say yes — the deal could close only if the buyer
   * accepted their own number.
   */
  it('the supplier CAN accept the buyer’s counter-offer, and the buyer then confirms', async () => {
    const { t, id } = await sentQuotation();
    await request(app).post(`/quotations/${id}/negotiate`).set(bearer(t.buyer.token)).send({ totalMinor: 15000 });

    const opened = await confirm(id, t.exporter);
    expect(opened.status).toBe(200);
    expect(opened.body.quotation.acceptance.initiatedBy).toBe('exporter');
    expect(opened.body.quotation.status).toBe('negotiating'); // not closed yet

    const closed = await confirm(id, t.buyer);
    expect(closed.body.quotation.status).toBe('accepted');
    expect(closed.body.quotation.acceptance.agreedTotalMinor).toBe(15000);
  });

  it('nobody can accept their OWN offer — it is the other side that answers it', async () => {
    const { t, id } = await sentQuotation();
    await request(app).post(`/quotations/${id}/negotiate`).set(bearer(t.buyer.token)).send({ totalMinor: 15000 });

    // The buyer's own figure is on the table, so the buyer cannot accept it.
    const own = await request(app)
      .post(`/quotations/${id}/accept/request-code`)
      .set(bearer(t.buyer.token))
      .send({});
    expect(own.status).toBe(409);

    // The supplier answers with their own — now it is the buyer's turn to accept.
    await request(app).post(`/quotations/${id}/negotiate`).set(bearer(t.exporter.token)).send({ totalMinor: 20000 });
    expect(
      (await request(app).post(`/quotations/${id}/accept/request-code`).set(bearer(t.exporter.token)).send({})).status,
    ).toBe(409);
    expect(
      (await request(app).post(`/quotations/${id}/accept/request-code`).set(bearer(t.buyer.token)).send({})).status,
    ).toBe(200);
  });

  /**
   * 🔴 The document is the supplier's own offer, so accepting it decides nothing
   * — and letting them go first would park a half-done acceptance on a buyer who
   * has never answered. Enforced on the server, not by hiding a button.
   */
  it('the supplier cannot open an acceptance on the document itself — the buyer accepts first', async () => {
    const { t, id } = await sentQuotation();

    const early = await request(app)
      .post(`/quotations/${id}/accept/request-code`)
      .set(bearer(t.exporter.token))
      .send({});
    expect(early.status).toBe(409);
    expect((await Quotation.findById(id)).acceptance).toBeUndefined();

    // …and not by going straight to confirm with a code from somewhere else.
    await request(app).post(`/quotations/${id}/accept/request-code`).set(bearer(t.buyer.token)).send({});
    const jump = await request(app)
      .post(`/quotations/${id}/accept/confirm`)
      .set(bearer(t.exporter.token))
      .send({ code: codeFor(t.buyer) });
    expect(jump.status).toBe(409);

    // Once the buyer has accepted, the supplier may confirm.
    await request(app)
      .post(`/quotations/${id}/accept/confirm`)
      .set(bearer(t.buyer.token))
      .send({ code: codeFor(t.buyer) });
    const ok = await confirm(id, t.exporter);
    expect(ok.status).toBe(200);
    expect(ok.body.quotation.status).toBe('accepted');
  });

  it('a wrong code confirms nothing', async () => {
    const { t, id } = await sentQuotation();
    await request(app).post(`/quotations/${id}/accept/request-code`).set(bearer(t.buyer.token)).send({});

    const bad = await request(app)
      .post(`/quotations/${id}/accept/confirm`)
      .set(bearer(t.buyer.token))
      .send({ code: '000000' === codeFor(t.buyer) ? '111111' : '000000' });
    expect(bad.status).toBe(401);
    expect((await Quotation.findById(id)).acceptance).toBeUndefined();
  });

  /**
   * 🔴 THE test of this feature. One side confirms, then the price moves. The
   * stale confirmation must be GONE — otherwise the second party's confirmation
   * would close the deal at a figure the first party never saw.
   */
  it('a counter-offer WIPES a half-finished acceptance', async () => {
    const { t, id } = await sentQuotation();
    await request(app).post(`/quotations/${id}/negotiate`).set(bearer(t.buyer.token)).send({ totalMinor: 800000 });

    // The supplier accepts the buyer's figure…
    await confirm(id, t.exporter);
    expect((await Quotation.findById(id)).acceptance.initiated.side).toBe('exporter');

    // …then moves the price instead of waiting to be confirmed. Their own
    // acceptance is now for a figure nobody is offering, and must be gone.
    await request(app).post(`/quotations/${id}/negotiate`).set(bearer(t.exporter.token)).send({ totalMinor: 900000 });
    expect((await Quotation.findById(id)).acceptance).toBeUndefined();

    // And the buyer alone still does not close it.
    const again = await confirm(id, t.buyer);
    expect(again.body.quotation.status).toBe('negotiating');
  });

  it('what gets accepted is the LAST offer, not the printed total', async () => {
    const { t, id } = await sentQuotation();
    const printed = (await request(app).get(`/quotations/${id}`).set(bearer(t.buyer.token))).body.quotation.totalMinor;

    await request(app).post(`/quotations/${id}/negotiate`).set(bearer(t.buyer.token)).send({ totalMinor: 123456 });
    // The buyer's offer, so the SUPPLIER accepts it and the buyer confirms.
    await confirm(id, t.exporter);
    const done = await confirm(id, t.buyer);

    expect(done.body.quotation.status).toBe('accepted');
    expect(done.body.quotation.acceptance.agreedTotalMinor).toBe(123456);
    expect(done.body.quotation.acceptance.agreedTotalMinor).not.toBe(printed);
  });

  it('never returns the confirming party\'s email or ip to the counterparty', async () => {
    const { t, id } = await sentQuotation();
    await confirm(id, t.buyer);

    const seen = await request(app).get(`/quotations/${id}`).set(bearer(t.exporter.token));
    const body = JSON.stringify(seen.body);
    expect(body).not.toContain(t.buyer.user.email);
    expect(seen.body.quotation.acceptance).not.toHaveProperty('ip');
    expect(seen.body.quotation.acceptance).not.toHaveProperty('userId');
  });

  /**
   * 🔴 `requestOtp` keeps ONE live challenge per (subject, purpose), so without
   * `subjectRef` the code emailed about one quotation would verify on another —
   * and the email names a document the code was never bound to.
   */
  it('a code issued for one quotation does not confirm a different one', async () => {
    const t = await makeThread();
    const a = await readyDraft(t);
    const b = await readyDraft(t);
    await request(app).post(`/quotations/${a}/send`).set(bearer(t.exporter.token)).send({});
    await request(app).post(`/quotations/${b}/send`).set(bearer(t.exporter.token)).send({});

    await request(app).post(`/quotations/${a}/accept/request-code`).set(bearer(t.buyer.token)).send({});
    await request(app).post(`/quotations/${b}/accept/request-code`).set(bearer(t.buyer.token)).send({});
    const codeForB = codeFor(t.buyer);

    const wrongDoc = await request(app)
      .post(`/quotations/${a}/accept/confirm`)
      .set(bearer(t.buyer.token))
      .send({ code: codeForB });
    expect(wrongDoc.status).toBe(401);
    expect((await Quotation.findById(a)).acceptance).toBeUndefined();

    // The same code still works where it belongs.
    const rightDoc = await request(app)
      .post(`/quotations/${b}/accept/confirm`)
      .set(bearer(t.buyer.token))
      .send({ code: codeForB });
    expect(rightDoc.status).toBe(200);
  });

  it('a stranger cannot offer on or confirm a quotation — 404, never 403', async () => {
    const { id } = await sentQuotation();
    const other = await makeOrgUser('buyer');

    for (const path of [`/quotations/${id}/negotiate`, `/quotations/${id}/accept/request-code`]) {
      expect((await request(app).post(path).set(bearer(other.token)).send({ totalMinor: 1 })).status).toBe(404);
    }
  });
});

describe('quotations · sending freezes the document', () => {
  /**
   * 🔴 THE test. Send with a bank account, then change that account, then read
   * the quotation back: it must still show what was sent.
   */
  it('SNAPSHOTS bank details — editing the account afterwards never changes a sent quotation', async () => {
    const t = await makeThread();
    const bank = await makeBank(t.exporter);
    const id = await readyDraft(t);

    const sent = await request(app)
      .post(`/quotations/${id}/send`)
      .set(bearer(t.exporter.token))
      .send({ bankAccountId: bank.body.bankAccount.id });
    expect(sent.status).toBe(200);
    expect(sent.body.quotation.bank.masked).toBe('••••4444');

    // The exporter now changes their saved account.
    await request(app)
      .patch(`/me/bank-accounts/${bank.body.bankAccount.id}`)
      .set(bearer(t.exporter.token))
      .send({ accountNumber: '9999 8888 7777 6666' });

    const after = await request(app).get(`/quotations/${id}`).set(bearer(t.buyer.token));
    expect(after.body.quotation.bank.masked).toBe('••••4444'); // NOT 6666
    /**
     * 🔴 Two things at once since 2026-09-25: the snapshot is FROZEN, and it is
     * stored ENCRYPTED. Asserting the raw column is not the plaintext is what
     * would catch the encryption being silently dropped — a test that only read
     * the decrypted value would pass just as happily on a plaintext database.
     */
    const stored = await Quotation.findById(id).select('+bankSnapshot.accountNumber');
    expect(stored.bankSnapshot.accountNumber).not.toBe('1111 2222 3333 4444');
    expect(stored.bankSnapshot.accountNumber.startsWith('v1:')).toBe(true);
    expect(decryptField(stored.bankSnapshot.accountNumber)).toBe('1111 2222 3333 4444');
  });

  it('freezes the totals, and recomputes them from items rather than trusting the caller', async () => {
    const t = await makeThread();
    const id = await readyDraft(t);
    const sent = await request(app).post(`/quotations/${id}/send`).set(bearer(t.exporter.token)).send({});
    // 1000 × ₹450 = ₹4,50,000 → 45,000,000 minor
    expect(sent.body.quotation.totals.totalMinor).toBe(45_000_000);
    expect(sent.body.quotation.totals.payments.reduce((s, p) => s + p.amountMinor, 0)).toBe(45_000_000);
  });

  it('refuses to send an incomplete quotation, naming what is missing', async () => {
    const t = await makeThread();
    const created = await request(app)
      .post('/quotations')
      .set(bearer(t.exporter.token))
      .send({ conversationId: String(t.conversation._id) });
    const id = created.body.quotation.id;
    await request(app).patch(`/quotations/${id}`).set(bearer(t.exporter.token)).send({ items: [] });

    const res = await request(app).post(`/quotations/${id}/send`).set(bearer(t.exporter.token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('at least one item');
  });

  it('a sent quotation can no longer be edited — a record, not a draft', async () => {
    const t = await makeThread();
    const id = await readyDraft(t);
    await request(app).post(`/quotations/${id}/send`).set(bearer(t.exporter.token)).send({});
    const res = await request(app).patch(`/quotations/${id}`).set(bearer(t.exporter.token)).send({ taxNote: 'x' });
    expect(res.status).toBe(409);
  });

  /** The thread records that it happened — it never carries the prices itself. */
  it('posts a system NOTICE in the thread, carrying the number and not the money', async () => {
    const t = await makeThread();
    const id = await readyDraft(t);
    const sent = await request(app).post(`/quotations/${id}/send`).set(bearer(t.exporter.token)).send({});

    const msg = await Message.findOne({ conversationId: t.conversation._id, systemKind: 'quotation_sent' });
    expect(msg).toBeTruthy();
    expect(msg.body).toContain(sent.body.quotation.number);
    // The notice must not carry MONEY — a second copy of the amount in the chat
    // is a figure that can end up disagreeing with the quotation itself. (The
    // quotation NUMBER has digits, so this checks for the total, not for digits.)
    expect(msg.body).not.toContain(String(sent.body.quotation.totals.totalMinor));
    expect(msg.body).not.toMatch(/[₹$€]|\bINR\b/);
  });
});

/**
 * AI-drafted payment milestones (owner, 2026-09-25 — "i just tell and milestone
 * will create by ai").
 *
 * 🔴 The model's answer is treated as HOSTILE INPUT. These tests exist because
 * the failure that matters is not "the AI was unhelpful" — it is a plausible but
 * wrong schedule reaching a buyer. Anything that does not add to 100, or is not
 * the right shape, is REFUSED rather than repaired.
 */
describe('quotations · AI-drafted milestones', () => {
  const ask = (id, token, instruction = '30% advance, rest on B/L') =>
    request(app).post(`/quotations/${id}/ai/milestones`).set(bearer(token)).send({ instruction });
  const askFor = (id, token, target, instruction = 'freight 25000, insurance included, IGST 18%') =>
    request(app).post(`/quotations/${id}/ai/${target}`).set(bearer(token)).send({ instruction });

  it('drafts a schedule, and writes NOTHING to the quotation', async () => {
    const t = await makeThread();
    const id = await readyDraft(t);
    aiReply.value = JSON.stringify({
      milestones: [
        { label: 'Advance with order', percent: 30 },
        { label: 'Against B/L copy', percent: 70 },
      ],
    });

    const before = (await Quotation.findById(id)).payment.milestones.map((m) => m.label);

    const res = await ask(id, t.exporter.token);
    expect(res.status).toBe(200);
    expect(res.body.milestones).toEqual([
      { label: 'Advance with order', percent: 30 },
      { label: 'Against B/L copy', percent: 70 },
    ]);

    // 🔴 The whole point: it is a suggestion. The draft's own schedule is
    // untouched until the exporter reads it and saves it themselves.
    const stored = await Quotation.findById(id);
    expect(stored.payment.milestones.map((m) => m.label)).toEqual(before);
  });

  it('REFUSES a schedule that does not add up to 100', async () => {
    const t = await makeThread();
    const id = await readyDraft(t);
    aiReply.value = JSON.stringify({
      milestones: [
        { label: 'Advance', percent: 30 },
        { label: 'On delivery', percent: 50 },
      ],
    });

    const res = await ask(id, t.exporter.token);
    expect(res.status).toBe(400);
    // Nothing the model said comes back — not its labels, not its numbers.
    expect(res.body.error.message).not.toMatch(/Advance|On delivery|30|50/);
  });

  it('refuses junk, an empty list and too many rows rather than repairing them', async () => {
    const t = await makeThread();
    const id = await readyDraft(t);

    for (const reply of [
      'not json at all',
      JSON.stringify({ milestones: [] }),
      JSON.stringify({ milestones: [{ label: 'x', percent: 'thirty' }] }),
      JSON.stringify({ milestones: [{ label: '', percent: 100 }] }),
      JSON.stringify({ milestones: Array.from({ length: 11 }, () => ({ label: 'x', percent: 9.09 })) }),
    ]) {
      aiReply.value = reply;
      expect((await ask(id, t.exporter.token)).status).toBe(400);
    }
  });

  it('drafts charges and taxes — and keeps “Included” as null, never zero', async () => {
    const t = await makeThread();
    const id = await readyDraft(t);
    aiReply.value = JSON.stringify({
      charges: [
        { label: 'Ocean freight', amount: 25000 },
        { label: 'Insurance', amount: null },
      ],
      taxes: [{ label: 'IGST', ratePct: 18 }],
    });

    const res = await askFor(id, t.exporter.token, 'charges');
    expect(res.status).toBe(200);
    // Minor units on the wire, like every other amount here.
    expect(res.body.charges).toEqual([
      { label: 'Ocean freight', amountMinor: 2500000 },
      // 🔴 null, NOT 0 — zero prints as free, which is a different promise.
      { label: 'Insurance', amountMinor: null },
    ]);
    expect(res.body.taxes).toEqual([{ label: 'IGST', ratePct: 18 }]);
  });

  it('refuses a negative charge, a rate over 100 and an empty answer', async () => {
    const t = await makeThread();
    const id = await readyDraft(t);

    for (const reply of [
      JSON.stringify({ charges: [{ label: 'Freight', amount: -5 }], taxes: [] }),
      JSON.stringify({ charges: [], taxes: [{ label: 'IGST', ratePct: 180 }] }),
      JSON.stringify({ charges: [], taxes: [] }),
      JSON.stringify({ charges: [{ label: '', amount: 10 }], taxes: [] }),
    ]) {
      aiReply.value = reply;
      expect((await askFor(id, t.exporter.token, 'charges')).status).toBe(400);
    }
  });

  it('drafts the details note, and DISCARDS one carrying contact details', async () => {
    const t = await makeThread();
    const id = await readyDraft(t);

    aiReply.value = JSON.stringify({ details: 'Packed in 20 kg bags. Samples on request.' });
    const ok = await askFor(id, t.exporter.token, 'details', 'packing and samples');
    expect(ok.status).toBe(200);
    expect(ok.body.details).toBe('Packed in 20 kg bags. Samples on request.');

    /**
     * 🔴 A contact detail here routes the buyer around the platform and its
     * record of the deal. The prompt forbids it; a model still writes one
     * sometimes, so it is CHECKED rather than trusted.
     */
    aiReply.value = JSON.stringify({ details: 'Call us on +91 98765 43210 to discuss.' });
    const leaked = await askFor(id, t.exporter.token, 'details', 'how to reach us');
    expect(leaked.status).toBe(400);
    expect(leaked.body.error.message).not.toContain('98765');
  });

  it('an unknown AI target is a 400, not a guess', async () => {
    const t = await makeThread();
    const id = await readyDraft(t);
    expect((await askFor(id, t.exporter.token, 'terms', 'governing law')).status).toBe(400);
  });

  it('is exporter-only and draft-only — the buyer gets a 404, a sent quotation a 409', async () => {
    const t = await makeThread();
    const id = await readyDraft(t);
    aiReply.value = JSON.stringify({ milestones: [{ label: 'Full advance', percent: 100 }] });

    // A draft is invisible to the buyer, so 404 — never 403.
    expect((await ask(id, t.buyer.token)).status).toBe(404);

    await request(app).post(`/quotations/${id}/send`).set(bearer(t.exporter.token)).send({});
    expect((await ask(id, t.exporter.token)).status).toBe(409);
  });
});
