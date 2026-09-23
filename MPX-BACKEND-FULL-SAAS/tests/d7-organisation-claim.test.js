import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// Capture every code instead of delivering it — including the rule-6 claim code,
// whose recipient and wording are part of what is under test.
const { otpBox } = vi.hoisted(() => ({ otpBox: { sent: [] } }));
vi.mock('../src/services/otp.sender.js', () => ({
  sendOtp: async (args) => {
    otpBox.sent.push(args);
  },
  describeOtpTransports: () => ({}),
}));

// F6 — the join notice. Spied, not replaced: the real function is inert without
// SMTP, and what matters here is WHO it was addressed to.
const { joined } = vi.hoisted(() => ({ joined: { calls: [] } }));
vi.mock('../src/services/emailNotifications.service.js', async (importOriginal) => ({
  ...(await importOriginal()),
  notifyOrganisationJoined: (args) => {
    joined.calls.push(args);
    return Promise.resolve();
  },
}));

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { User } = await import('../src/models/User.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const { PendingSignup } = await import('../src/models/PendingSignup.js');

/**
 * D7 · Organisation CLAIM at signup (A21 step 2) — the 2026-09-23 rule set.
 *
 *   1 one active buyer + one active exporter per organisation
 *   2 email OR mobile reaching a member → offer
 *   3 email → A, mobile → B → both offered, labelled, pick one
 *   4 identity already holds both roles → "account exists" at start
 *   5 seat taken → no offer
 *   6 a claim proves the EXISTING member's email (skipped when it is the
 *     claimant's own) — the recycled-SIM hijack (F1) is what this closes
 *   8a only a deactivated member left → no offer
 *   8b the stored offer restricts, never grants — re-checked at complete
 *   8d a rejected org receiving locked fields goes back to `submitted`
 *   F5 the seat race is settled by the database
 *   F6 the existing member is told about every join
 *   F7 a blocked company is never offered
 *
 * 🔴 The security property underneath all of it: the client never names a
 * target. It echoes an opaque `choice` the server issued from the identity both
 * OTPs proved, and the server re-derives eligibility every time.
 */
const app = createApp();
const RUN = String(Date.now()).slice(-7);
let seq = 0;
const idFor = () => {
  seq += 1;
  return {
    email: `d7_${RUN}_${seq}@example.com`,
    number: `9${RUN.slice(-6)}${String(seq).padStart(3, '0')}`,
  };
};

async function pendingFor({ role, email, number, name = `D7 ${role}` }) {
  const start = await request(app)
    .post('/auth/signup/start')
    .send({
      name,
      email,
      mobile: { countryCode: '+91', number },
      password: 'longpassword1',
      role,
    })
    .expect(201);
  const pending = await PendingSignup.findOne({ email }).sort({ createdAt: -1 });
  return { token: start.body.signupToken, pendingId: pending._id };
}

/**
 * Marks both channels verified directly — the end state `/auth/signup/verify`
 * produces. What is under test here is CLAIM; `a21-signup-verification` covers
 * the channel codes.
 */
async function readyToken(identity) {
  const { token, pendingId } = await pendingFor(identity);
  await PendingSignup.updateOne(
    { _id: pendingId },
    { $set: { emailVerifiedAt: new Date(), mobileVerifiedAt: new Date() } },
  );
  return token;
}

const offer = (signupToken) => request(app).post('/auth/signup/organisation').send({ signupToken });
const sendCode = (signupToken, choice) =>
  request(app).post('/auth/signup/organisation/code').send({ signupToken, choice });
const verifyCode = (signupToken, choice, code) =>
  request(app).post('/auth/signup/organisation/verify').send({ signupToken, choice, code });
const complete = (signupToken, body) =>
  request(app).post('/auth/signup/complete').send({ signupToken, ...body });

const EXPORTER_DETAILS = {
  entityType: 'business',
  address: { line1: '1 Mill Road', city: 'Tirupur', postalCode: '641601' },
};

/** A company with one member, made through the real create path. */
async function companyWith({ role, email, number, company, name }) {
  const token = await readyToken({ role, email, number, name });
  await complete(token, {
    company,
    country: 'IN',
    ...(role === 'exporter' ? EXPORTER_DETAILS : {}),
  }).expect(201);
  return Organisation.findOne({ name: company });
}

const lastClaimCode = () => [...otpBox.sent].reverse().find((s) => s.purpose === 'claim_org_email');

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
});
beforeEach(() => {
  otpBox.sent.length = 0;
  joined.calls.length = 0;
});

describe('the offer', () => {
  it('is empty for a first-time identity', async () => {
    const token = await readyToken({ role: 'buyer', ...idFor() });
    const res = await offer(token).expect(200);
    expect(res.body.organisations).toEqual([]);
  });

  it('offers the company when the same person signs up on the other side — named, no code needed', async () => {
    const me = idFor();
    await companyWith({ role: 'buyer', ...me, company: `Claimable Co ${RUN}` });

    const res = await offer(await readyToken({ role: 'exporter', ...me })).expect(200);
    expect(res.body.organisations).toHaveLength(1);
    const [o] = res.body.organisations;
    expect(o.name).toBe(`Claimable Co ${RUN}`);
    expect(o.matchedOn).toBe('both');
    // Rule 6: the member's email IS the claimant's own, already proved at signup.
    expect(o.needsOrgEmailOtp).toBe(false);
    expect(o.needs).toEqual(expect.arrayContaining(['entityType', 'address']));
    expect(o.carriesTickOver).toBe(false);
  });

  it('🔴 never exposes raw kycStatus or an org id — only a derived boolean and an opaque choice', async () => {
    const me = idFor();
    await companyWith({ role: 'buyer', ...me, company: `Shape Co ${RUN}` });
    const res = await offer(await readyToken({ role: 'exporter', ...me })).expect(200);
    const [o] = res.body.organisations;
    expect(Object.keys(o).sort()).toEqual([
      'carriesTickOver',
      'choice',
      'country',
      'matchedOn',
      'name',
      'needs',
      'needsOrgEmailOtp',
      'verified',
      'verifierEmail',
    ]);
    expect(o.choice).toMatch(/^[a-f0-9]{32}$/);
    const org = await Organisation.findOne({ name: `Shape Co ${RUN}` });
    expect(JSON.stringify(res.body)).not.toContain(String(org._id));
    expect(o.kycStatus).toBeUndefined();
  });

  it('🔴 concurrent offer reads never 500 and agree on the choice (found in the browser)', async () => {
    const me = idFor();
    await companyWith({ role: 'buyer', ...me, company: `Race Read ${RUN}` });
    const token = await readyToken({ role: 'exporter', ...me });
    const results = await Promise.all([offer(token), offer(token), offer(token)]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    const choices = new Set(results.map((r) => r.body.organisations[0]?.choice));
    expect(choices.size).toBe(1);
    // And the agreed choice is the one `complete` accepts.
    await complete(token, { company: 'x', country: 'IN', ...EXPORTER_DETAILS, claimChoice: [...choices][0] }).expect(201);
  });

  it('a rule-6 proof survives a later re-read of the offer', async () => {
    const member = idFor();
    await companyWith({ role: 'buyer', ...member, company: `Proof Kept ${RUN}` });
    const joiner = idFor();
    const token = await readyToken({ role: 'exporter', email: joiner.email, number: member.number });
    const [o] = (await offer(token).expect(200)).body.organisations;
    await sendCode(token, o.choice).expect(200);
    await verifyCode(token, o.choice, lastClaimCode().code).expect(200);
    await Promise.all([offer(token), offer(token)]);
    const [after] = (await offer(token).expect(200)).body.organisations;
    expect(after.needsOrgEmailOtp).toBe(false);
    await complete(token, { company: 'x', country: 'IN', ...EXPORTER_DETAILS, claimChoice: o.choice }).expect(201);
  });

  it('keeps the same choice when the offer is re-read', async () => {
    const me = idFor();
    await companyWith({ role: 'buyer', ...me, company: `Stable Co ${RUN}` });
    const token = await readyToken({ role: 'exporter', ...me });
    const a = await offer(token).expect(200);
    const b = await offer(token).expect(200);
    expect(b.body.organisations[0].choice).toBe(a.body.organisations[0].choice);
  });

  it('is refused until BOTH channels are verified', async () => {
    const { token } = await pendingFor({ role: 'buyer', ...idFor() });
    await offer(token).expect(403);
  });

  it('never offers a company belonging to a DIFFERENT identity', async () => {
    await companyWith({ role: 'buyer', ...idFor(), company: `Someone Elses Co ${RUN}` });
    const res = await offer(await readyToken({ role: 'buyer', ...idFor() })).expect(200);
    expect(res.body.organisations).toEqual([]);
  });
});

describe('rules 1 + 5 · F7 · 8a — what is NOT offered', () => {
  it('rule 5 via a colleague: seat held by someone else → no offer', async () => {
    const buyer = idFor();
    const org = await companyWith({ role: 'buyer', ...buyer, company: `Taken Seat ${RUN}` });
    // Someone else already holds the exporter seat.
    const holder = idFor();
    await User.create({
      name: 'holder',
      email: holder.email,
      mobile: { countryCode: '+91', number: holder.number, e164: `+91${holder.number}` },
      passwordHash: 'x'.repeat(20),
      role: 'exporter',
      orgId: org._id,
    });
    const res = await offer(await readyToken({ role: 'exporter', ...buyer })).expect(200);
    expect(res.body.organisations).toEqual([]);
  });

  it('F7: a BLOCKED company is never offered', async () => {
    const me = idFor();
    const org = await companyWith({ role: 'buyer', ...me, company: `Blocked Co ${RUN}` });
    await Organisation.updateOne({ _id: org._id }, { $set: { isActive: false } });
    const res = await offer(await readyToken({ role: 'exporter', ...me })).expect(200);
    expect(res.body.organisations).toEqual([]);
  });

  it('8a: only a DEACTIVATED member left → no offer; the signup creates instead', async () => {
    const me = idFor();
    const org = await companyWith({ role: 'buyer', ...me, company: `Dead Mailbox ${RUN}` });
    await User.updateOne({ orgId: org._id }, { $set: { isActive: false } });
    const token = await readyToken({ role: 'exporter', ...me });
    const res = await offer(token).expect(200);
    expect(res.body.organisations).toEqual([]);
    await complete(token, { company: `Fresh Start ${RUN}`, country: 'IN', ...EXPORTER_DETAILS }).expect(201);
  });

  it('rule 4: an identity already holding BOTH roles cannot start a third signup', async () => {
    const me = idFor();
    await companyWith({ role: 'buyer', ...me, company: `Both Roles ${RUN}` });
    const t = await readyToken({ role: 'exporter', ...me });
    const [o] = (await offer(t).expect(200)).body.organisations;
    await complete(t, { company: 'x', country: 'IN', ...EXPORTER_DETAILS, claimChoice: o.choice }).expect(201);

    for (const role of ['buyer', 'exporter']) {
      const res = await request(app)
        .post('/auth/signup/start')
        .send({ name: 'x', email: me.email, mobile: { countryCode: '+91', number: me.number }, password: 'longpassword1', role });
      expect(res.status).toBe(409);
    }
  });
});

describe('rule 3 · email → company A, mobile → company B', () => {
  async function twoCompanies() {
    const a = idFor();
    const b = idFor();
    await companyWith({ role: 'buyer', ...a, company: `Company A ${RUN}_${seq}` });
    const nameA = `Company A ${RUN}_${seq}`;
    await companyWith({ role: 'buyer', ...b, company: `Company B ${RUN}_${seq}` });
    const nameB = `Company B ${RUN}_${seq}`;
    const token = await readyToken({ role: 'exporter', email: a.email, number: b.number });
    return { a, b, nameA, nameB, token };
  }

  it('offers BOTH, labelled by which identifier matched', async () => {
    const { nameA, token } = await twoCompanies();
    const { organisations } = (await offer(token).expect(200)).body;
    expect(organisations).toHaveLength(2);
    const byEmail = organisations.find((o) => o.matchedOn === 'email');
    const byMobile = organisations.find((o) => o.matchedOn === 'mobile');
    expect(byEmail.name).toBe(nameA);
    // 🔴 The mobile-reached company is NOT named until its member's inbox is
    // proved — a recycled SIM must not learn whose company it reaches (F1).
    expect(byMobile.needsOrgEmailOtp).toBe(true);
    expect(byMobile.name).toBeNull();
    expect(byMobile.verified).toBeNull();
    expect(byMobile.verifierEmail).toMatch(/\*/);
  });

  it('the person picks one, and joins exactly that one', async () => {
    const { nameA, nameB, token } = await twoCompanies();
    const { organisations } = (await offer(token).expect(200)).body;
    const pick = organisations.find((o) => o.matchedOn === 'email');
    await complete(token, { company: 'x', country: 'IN', ...EXPORTER_DETAILS, claimChoice: pick.choice }).expect(201);

    expect((await Organisation.findOne({ name: nameA })).exporterSide).toBe(true);
    expect((await Organisation.findOne({ name: nameB })).exporterSide).toBe(false);
  });
});

describe('🔴 rule 6 · a claim proves the EXISTING member\'s email', () => {
  async function phoneMatched() {
    const member = idFor();
    const org = await companyWith({ role: 'buyer', ...member, company: `Phone Co ${RUN}_${seq}` });
    const joiner = idFor();
    const token = await readyToken({ role: 'exporter', email: joiner.email, number: member.number });
    const [o] = (await offer(token).expect(200)).body.organisations;
    return { member, org, token, o };
  }

  it('a phone-matched claim is refused without the member\'s code', async () => {
    const { token, o, org } = await phoneMatched();
    expect(o.needsOrgEmailOtp).toBe(true);
    const res = await complete(token, { company: 'x', country: 'IN', ...EXPORTER_DETAILS, claimChoice: o.choice });
    expect(res.status).toBe(403);
    expect(await User.countDocuments({ orgId: org._id })).toBe(1);
  });

  it('sends the code to the MEMBER\'s own address — never the claimant\'s — worded as an alarm', async () => {
    const { member, token, o, org } = await phoneMatched();
    await sendCode(token, o.choice).expect(200);
    const sent = lastClaimCode();
    expect(sent.identifier).toBe(member.email);
    expect(sent.channel).toBe('email');
    expect(sent.context.orgName).toBe(org.name);
    expect(sent.context.matchedOn).toBe('mobile');
  });

  it('with the code: the company is named, and the claim goes through', async () => {
    const { token, o, org } = await phoneMatched();
    await sendCode(token, o.choice).expect(200);
    const res = await verifyCode(token, o.choice, lastClaimCode().code).expect(200);
    const [named] = res.body.organisations;
    expect(named.needsOrgEmailOtp).toBe(false);
    expect(named.name).toBe(org.name);

    await complete(token, { company: 'x', country: 'IN', ...EXPORTER_DETAILS, claimChoice: o.choice }).expect(201);
    expect(await User.countDocuments({ orgId: org._id })).toBe(2);
  });

  it('a wrong code does not unlock it', async () => {
    const { token, o } = await phoneMatched();
    await sendCode(token, o.choice).expect(200);
    const wrong = lastClaimCode().code === '000000' ? '111111' : '000000';
    await verifyCode(token, o.choice, wrong).expect(401);
    await complete(token, { company: 'x', country: 'IN', ...EXPORTER_DETAILS, claimChoice: o.choice }).expect(403);
  });

  it('no code is sent when the claimant\'s own email is the member\'s', async () => {
    const me = idFor();
    await companyWith({ role: 'buyer', ...me, company: `Own Email ${RUN}` });
    const token = await readyToken({ role: 'exporter', ...me });
    const [o] = (await offer(token).expect(200)).body.organisations;
    await sendCode(token, o.choice).expect(400);
    expect(lastClaimCode()).toBeUndefined();
  });

  it('9c: every code SENT is audited as a claim attempt', async () => {
    const { token, o, org } = await phoneMatched();
    await sendCode(token, o.choice).expect(200);
    const row = await AuditLog.findOne({ action: 'organisation.claim_attempt', orgId: org._id });
    expect(row).toBeTruthy();
    expect(row.after.matchedOn).toBe('mobile');
    expect(row.after.joiningRole).toBe('exporter');
  });
});

describe('🔴 8b · the stored offer restricts, it never grants', () => {
  it('a choice that was never offered is refused with CLAIM_SEAT_TAKEN — and no org is made', async () => {
    const token = await readyToken({ role: 'buyer', ...idFor() });
    const before = await Organisation.countDocuments({});
    const res = await complete(token, { company: 'Nope', country: 'IN', claimChoice: 'a'.repeat(32) });
    expect(res.status).toBe(409);
    expect(res.body.error?.code ?? res.body.code).toBe('CLAIM_SEAT_TAKEN');
    expect(await Organisation.countDocuments({})).toBe(before);
  });

  it('an org id in place of a choice is rejected by validation', async () => {
    const me = idFor();
    const org = await companyWith({ role: 'buyer', ...me, company: `Id Probe ${RUN}` });
    const token = await readyToken({ role: 'exporter', ...me });
    await complete(token, { company: 'x', country: 'IN', ...EXPORTER_DETAILS, claimChoice: String(org._id) }).expect(400);
  });

  it('seat taken between offer and complete → CLAIM_SEAT_TAKEN, pending signup KEPT, create still works', async () => {
    const me = idFor();
    const org = await companyWith({ role: 'buyer', ...me, company: `Late Seat ${RUN}` });
    const token = await readyToken({ role: 'exporter', ...me });
    const [o] = (await offer(token).expect(200)).body.organisations;

    // Someone else takes the exporter seat meanwhile.
    const other = idFor();
    await User.create({
      name: 'faster',
      email: other.email,
      mobile: { countryCode: '+91', number: other.number, e164: `+91${other.number}` },
      passwordHash: 'x'.repeat(20),
      role: 'exporter',
      orgId: org._id,
    });

    const res = await complete(token, { company: 'x', country: 'IN', ...EXPORTER_DETAILS, claimChoice: o.choice });
    expect(res.status).toBe(409);
    expect(res.body.error?.code ?? res.body.code).toBe('CLAIM_SEAT_TAKEN');

    // Both OTPs are still good: one more call finishes the signup by creating.
    await complete(token, { company: `Own Company ${RUN}`, country: 'IN', ...EXPORTER_DETAILS }).expect(201);
  });

  it('a company blocked between offer and complete cannot be joined', async () => {
    const me = idFor();
    const org = await companyWith({ role: 'buyer', ...me, company: `Blocked Later ${RUN}` });
    const token = await readyToken({ role: 'exporter', ...me });
    const [o] = (await offer(token).expect(200)).body.organisations;
    await Organisation.updateOne({ _id: org._id }, { $set: { isActive: false } });
    await complete(token, { company: 'x', country: 'IN', ...EXPORTER_DETAILS, claimChoice: o.choice }).expect(409);
  });
});

describe('F5 · two claims racing for the last seat', () => {
  it('exactly one account results; the loser gets CLAIM_SEAT_TAKEN', async () => {
    const member = idFor();
    const org = await companyWith({ role: 'buyer', ...member, company: `Race Co ${RUN}` });

    // Claimant 1 reaches it by EMAIL (the member's own address), claimant 2 by
    // MOBILE with the member's code — distinct identities, so only the
    // `(orgId, role)` index can refuse one of them.
    const one = idFor();
    const t1 = await readyToken({ role: 'exporter', email: member.email, number: one.number });
    const two = idFor();
    const t2 = await readyToken({ role: 'exporter', email: two.email, number: member.number });

    const [o1] = (await offer(t1).expect(200)).body.organisations;
    const [o2] = (await offer(t2).expect(200)).body.organisations;
    await sendCode(t2, o2.choice).expect(200);
    await verifyCode(t2, o2.choice, lastClaimCode().code).expect(200);

    const body = { company: 'x', country: 'IN', ...EXPORTER_DETAILS };
    const results = await Promise.all([
      complete(t1, { ...body, claimChoice: o1.choice }),
      complete(t2, { ...body, claimChoice: o2.choice }),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    const loser = results.find((r) => r.status === 409);
    expect(loser.body.error?.code ?? loser.body.code).toBe('CLAIM_SEAT_TAKEN');
    expect(await User.countDocuments({ orgId: org._id, role: 'exporter', isActive: true })).toBe(1);
  });
});

describe('claiming joins ONE organisation instead of making a second', () => {
  it('attaches the exporter to the buyer org, and the claimant cannot rename it', async () => {
    const me = idFor();
    const org = await companyWith({ role: 'buyer', ...me, company: `One Org ${RUN}` });
    const orgCount = await Organisation.countDocuments({});
    const token = await readyToken({ role: 'exporter', ...me });
    const [o] = (await offer(token).expect(200)).body.organisations;

    const res = await complete(token, {
      company: 'ignored on a claim',
      country: 'IN',
      ...EXPORTER_DETAILS,
      claimChoice: o.choice,
    }).expect(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(await Organisation.countDocuments({})).toBe(orgCount);

    const after = await Organisation.findById(org._id);
    expect(after.buyerSide).toBe(true);
    expect(after.exporterSide).toBe(true);
    expect(after.name).toBe(`One Org ${RUN}`);
    expect(after.entityType).toBe('business');
    expect(after.address.city).toBe('Tirupur');
    expect(after.slug).toBeTruthy();
  });

  it('an exporter claim without the missing address is refused before anything is written', async () => {
    const me = idFor();
    const org = await companyWith({ role: 'buyer', ...me, company: `No Address ${RUN}` });
    const token = await readyToken({ role: 'exporter', ...me });
    const [o] = (await offer(token).expect(200)).body.organisations;
    await complete(token, { company: 'x', country: 'IN', entityType: 'business', claimChoice: o.choice }).expect(400);
    expect(await User.countDocuments({ orgId: org._id })).toBe(1);
  });

  it('9b: the claim audit records matchedOn and how the company was proved', async () => {
    const me = idFor();
    const org = await companyWith({ role: 'buyer', ...me, company: `Audited Claim ${RUN}` });
    const token = await readyToken({ role: 'exporter', ...me });
    const [o] = (await offer(token).expect(200)).body.organisations;
    await complete(token, { company: 'x', country: 'IN', ...EXPORTER_DETAILS, claimChoice: o.choice }).expect(201);

    const entry = await AuditLog.findOne({ action: 'organisation.claim', orgId: org._id });
    expect(entry.after.matchedOn).toBe('both');
    expect(entry.after.verifiedVia).toBe('own_email');
    expect(entry.after.suppliedLockedFields).toEqual(expect.arrayContaining(['entityType', 'address']));
  });

  it('F6: the member already in the company is notified — not the joiner', async () => {
    const member = idFor();
    const org = await companyWith({ role: 'buyer', ...member, company: `Notified Co ${RUN}` });
    const token = await readyToken({ role: 'exporter', ...member, name: 'The Joiner' });
    const [o] = (await offer(token).expect(200)).body.organisations;
    await complete(token, { company: 'x', country: 'IN', ...EXPORTER_DETAILS, claimChoice: o.choice }).expect(201);

    expect(joined.calls).toHaveLength(1);
    const [call] = joined.calls;
    expect(String(call.org._id)).toBe(String(org._id));
    expect(call.recipient.role).toBe('buyer');
    expect(call.joiner.name).toBe('The Joiner');
  });
});

describe('🔴 the tick does not travel over unreviewed details', () => {
  it('an exporter claiming a VERIFIED buyer org drops it back to submitted', async () => {
    const me = idFor();
    const org = await companyWith({ role: 'buyer', ...me, company: `Verified Buyer Co ${RUN}` });
    await Organisation.updateOne({ _id: org._id }, { $set: { kycStatus: 'verified', verifiedAt: new Date() } });

    const token = await readyToken({ role: 'exporter', ...me });
    const [o] = (await offer(token).expect(200)).body.organisations;
    expect(o.verified).toBe(true);
    expect(o.carriesTickOver).toBe(false);
    await complete(token, { company: 'x', country: 'IN', ...EXPORTER_DETAILS, claimChoice: o.choice }).expect(201);

    const after = await Organisation.findById(org._id);
    expect(after.kycStatus).toBe('submitted');
    expect(after.verifiedAt).toBeFalsy();
  });

  it('8d: a REJECTED org receiving locked fields goes back to submitted, reason cleared', async () => {
    const me = idFor();
    const org = await companyWith({ role: 'buyer', ...me, company: `Rejected Co ${RUN}` });
    await Organisation.updateOne(
      { _id: org._id },
      { $set: { kycStatus: 'rejected', kycRejectionReason: 'blurry scan' } },
    );
    const token = await readyToken({ role: 'exporter', ...me });
    const [o] = (await offer(token).expect(200)).body.organisations;
    await complete(token, { company: 'x', country: 'IN', ...EXPORTER_DETAILS, claimChoice: o.choice }).expect(201);

    const after = await Organisation.findById(org._id);
    expect(after.kycStatus).toBe('submitted');
    expect(after.kycRejectionReason).toBeFalsy();
  });

  it('a BUYER claiming a verified exporter org carries the tick over untouched', async () => {
    const me = idFor();
    const org = await companyWith({ role: 'exporter', ...me, company: `Verified Exporter Co ${RUN}` });
    await Organisation.updateOne({ _id: org._id }, { $set: { kycStatus: 'verified', verifiedAt: new Date() } });

    const token = await readyToken({ role: 'buyer', ...me });
    const [o] = (await offer(token).expect(200)).body.organisations;
    expect(o.needs).toEqual([]);
    expect(o.carriesTickOver).toBe(true);
    await complete(token, { company: 'x', country: 'IN', claimChoice: o.choice }).expect(201);

    const after = await Organisation.findById(org._id);
    expect(after.kycStatus).toBe('verified');
    expect(after.buyerSide).toBe(true);
  });
});

/**
 * 🔴 RULE 1 ENFORCED AT THE DATABASE (F5). The unique partial index on
 * `(orgId, role)` is scoped to ACTIVE party users — that scoping is what lets
 * support move a seat (deactivate the holder, the replacement claims).
 */
describe('rule 1 · one seat per role per organisation, at the database', () => {
  const mk = (org, n, role = 'exporter') => ({
    name: `u ${n}`,
    email: `seat_${RUN}_${n}@example.com`,
    mobile: { countryCode: '+91', number: `95${RUN.slice(-6)}${n}`, e164: `+9195${RUN.slice(-6)}${n}` },
    passwordHash: 'x'.repeat(20),
    role,
    orgId: org._id,
  });

  it('refuses a second ACTIVE account of the same role — even in a race', async () => {
    const org = await Organisation.create({ name: `Seat Race ${RUN}`, type: 'business' });
    const results = await Promise.allSettled([User.create(mk(org, 1)), User.create(mk(org, 2))]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected').reason?.code).toBe(11000);
  });

  it('DEACTIVATING the holder frees the seat — the support path', async () => {
    const org = await Organisation.create({ name: `Seat Free ${RUN}`, type: 'business' });
    const first = await User.create(mk(org, 3));
    await expect(User.create(mk(org, 4))).rejects.toMatchObject({ code: 11000 });
    await User.updateOne({ _id: first._id }, { $set: { isActive: false } });
    expect((await User.create(mk(org, 4))).isActive).toBe(true);
  });

  it('does NOT constrain staff — several employees share the platform org', async () => {
    const platform = await Organisation.create({ name: `Platform ${RUN}`, type: 'platform' });
    await User.create(mk(platform, 5, 'employee'));
    await User.create(mk(platform, 6, 'employee'));
    expect(await User.countDocuments({ orgId: platform._id, role: 'employee' })).toBe(2);
  });
});
