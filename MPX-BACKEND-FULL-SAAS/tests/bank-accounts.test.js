import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const { ExporterBankAccount } = await import('../src/models/ExporterBankAccount.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');

/**
 * Exporter bank details (2026-09-24) — saved so the quotation builder does not
 * ask cold every time.
 *
 * 🔴 These are DISPLAY-ONLY details printed on a document a buyer pays against
 * directly. That is what keeps them inside C1, which forbids bank details our
 * code could send to a payment API. The risk that remains is tampering: if a
 * stored account can be changed quietly, or read by the wrong exporter, a buyer
 * pays an attacker. Everything below tests that specific failure.
 */
const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const RUN = String(Date.now()).slice(-7);
let seq = 0;

async function makeUser(role) {
  seq += 1;
  const isCompany = role === 'buyer' || role === 'exporter';
  const org = await Organisation.create({
    name: `${role} Bank Co ${seq}`,
    type: isCompany ? 'business' : 'platform',
    buyerSide: role === 'buyer',
    exporterSide: role === 'exporter',
    country: 'IN',
  });
  const user = await User.create({
    name: `${role}-bank-${seq}`,
    email: `bank_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `9${RUN}${seq}`, e164: `+919${RUN}${seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
  });
  return { user, org, token: signAccessToken(user) };
}

const VALID = {
  label: 'HDFC current',
  beneficiary: 'Tirupur Knitwear Exports',
  bankName: 'HDFC Bank',
  branch: 'Tiruppur',
  accountNumber: '1234 5678 9012 3456',
  ifsc: 'HDFC0001234',
  swift: 'HDFCINBB',
};

const create = (token, body = VALID) =>
  request(app).post('/me/bank-accounts').set(bearer(token)).send(body);

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
});

describe('exporter bank accounts', () => {
  it('is exporter-only — a buyer and staff are refused', async () => {
    for (const role of ['buyer', 'employee']) {
      const u = await makeUser(role);
      expect((await create(u.token)).status).toBe(403);
      expect((await request(app).get('/me/bank-accounts').set(bearer(u.token))).status).toBe(403);
    }
  });

  /**
   * The number is `select: false` and `last4` is stored precisely so no list
   * has to load it in order to mask it. If it ever appears in a response, the
   * masking is theatre.
   */
  it('never returns the account number, and derives last4 from it', async () => {
    const ex = await makeUser('exporter');
    const res = await create(ex.token);
    expect(res.status).toBe(201);

    expect(JSON.stringify(res.body)).not.toContain('1234 5678 9012 3456');
    expect(JSON.stringify(res.body)).not.toContain('3456789012'); // nor unspaced
    expect(res.body.bankAccount.masked).toBe('••••3456');
    expect(res.body.bankAccount).not.toHaveProperty('accountNumber');

    const list = await request(app).get('/me/bank-accounts').set(bearer(ex.token));
    expect(JSON.stringify(list.body)).not.toContain('9012 3456');
    expect(list.body.bankAccounts[0].masked).toBe('••••3456');
  });

  it('re-derives last4 when the number changes — a stale mask reads as confirmation', async () => {
    const ex = await makeUser('exporter');
    const { body } = await create(ex.token);
    const res = await request(app)
      .patch(`/me/bank-accounts/${body.bankAccount.id}`)
      .set(bearer(ex.token))
      .send({ accountNumber: '9999 0000 1111 8888' });
    expect(res.status).toBe(200);
    expect(res.body.bankAccount.masked).toBe('••••8888');
  });

  /**
   * 🔴 The core isolation test. One exporter must never reach another's row, and
   * the answer is 404 rather than 403 — a 403 confirms the row exists.
   */
  it("one exporter cannot see or touch another's — 404, never 403", async () => {
    const a = await makeUser('exporter');
    const b = await makeUser('exporter');
    const { body } = await create(a.token);
    const id = body.bankAccount.id;

    const listB = await request(app).get('/me/bank-accounts').set(bearer(b.token));
    expect(listB.body.bankAccounts).toHaveLength(0);

    expect(
      (await request(app).patch(`/me/bank-accounts/${id}`).set(bearer(b.token)).send({ label: 'x' }))
        .status,
    ).toBe(404);
    expect((await request(app).delete(`/me/bank-accounts/${id}`).set(bearer(b.token))).status).toBe(404);
    expect(
      (await request(app).post(`/me/bank-accounts/${id}/confirm`).set(bearer(b.token))).status,
    ).toBe(404);
  });

  /**
   * A changed account is how a buyer ends up paying an attacker, so the change
   * has to leave a trail — carrying last4, never the number itself.
   */
  it('audits every change with last4 and NEVER the account number', async () => {
    const ex = await makeUser('exporter');
    const { body } = await create(ex.token);
    await request(app)
      .patch(`/me/bank-accounts/${body.bankAccount.id}`)
      .set(bearer(ex.token))
      .send({ accountNumber: '5555 6666 7777 4321' });

    const rows = await AuditLog.find({ orgId: ex.org._id }).sort({ createdAt: 1 });
    const actions = rows.map((r) => r.action);
    expect(actions).toContain('bankAccount.create');
    expect(actions).toContain('bankAccount.update');

    const update = rows.find((r) => r.action === 'bankAccount.update');
    expect(update.before.last4).toBe('3456');
    expect(update.after.last4).toBe('4321');

    const dump = JSON.stringify(rows.map((r) => r.toObject()));
    expect(dump).not.toContain('5678');
    expect(dump).not.toContain('6666');
  });

  it('makes the first account the default, and only one stays default', async () => {
    const ex = await makeUser('exporter');
    const first = await create(ex.token);
    expect(first.body.bankAccount.isDefault).toBe(true);

    const second = await create(ex.token, { ...VALID, label: 'ICICI EEFC', isDefault: true });
    expect(second.body.bankAccount.isDefault).toBe(true);

    const defaults = await ExporterBankAccount.countDocuments({
      exporterOrgId: ex.org._id,
      isDefault: true,
      isActive: true,
    });
    expect(defaults).toBe(1);
  });

  it('records the exporter confirming the details — the control against silent tampering', async () => {
    const ex = await makeUser('exporter');
    const { body } = await create(ex.token);
    expect(body.bankAccount.lastConfirmedAt).toBeNull();

    const res = await request(app)
      .post(`/me/bank-accounts/${body.bankAccount.id}/confirm`)
      .set(bearer(ex.token));
    expect(res.status).toBe(200);
    expect(res.body.bankAccount.lastConfirmedAt).toBeTruthy();
  });

  it('rejects unknown keys rather than stripping them', async () => {
    const ex = await makeUser('exporter');
    // A typo'd field on a payment document must fail loudly — stripping it would
    // leave the exporter believing they saved something they did not.
    const res = await create(ex.token, { ...VALID, acountNumber: '1' });
    expect(res.status).toBe(400);
  });

  it('refuses an empty edit instead of reporting success', async () => {
    const ex = await makeUser('exporter');
    const { body } = await create(ex.token);
    const res = await request(app)
      .patch(`/me/bank-accounts/${body.bankAccount.id}`)
      .set(bearer(ex.token))
      .send({});
    expect(res.status).toBe(400);
  });
});
