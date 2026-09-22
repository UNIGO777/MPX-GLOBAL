import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { Settings, SETTINGS_ID } = await import('../src/models/Settings.js');
const { User } = await import('../src/models/User.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { effectiveAiGuestDailyMax } = await import('../src/services/settings.service.js');
const { env } = await import('../src/config/env.js');

/**
 * D8 · Platform settings (§3.5).
 *
 * Two things carry contractual weight and are what these tests actually guard:
 *
 *  1. **§3.3 — the Client may change the AI guest ceiling "at any time".** The
 *     whole reason the page exists. So: the override must take effect, and
 *     clearing it must fall back to the env floor rather than to "unlimited".
 *  2. **§11.1 — administrative actions are recorded with the actor and time.**
 *     Every change writes an AuditLog entry; a no-op save writes none.
 *
 * Plus the governance gate: platform settings is superadmin-only and is NEVER a
 * grantable employee permission, because an employee who can move the AI spend
 * ceiling or the published support address is a privilege-escalation path.
 */
const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const RUN = String(Date.now()).slice(-7);
let seq = 0;
const mobileFor = (n) => `9${RUN.slice(-6)}${String(n).padStart(3, '0')}`;

async function makeStaff(role, permissions = []) {
  seq += 1;
  const user = await User.create({
    name: `D8 ${role}`,
    email: `d8_${RUN}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: mobileFor(seq), e164: `+91${mobileFor(seq)}` },
    passwordHash: await hashPassword('Password123!'),
    role,
    orgId: new mongoose.Types.ObjectId(),
    permissions,
    isActive: true,
    isEmailVerified: true,
    isMobileVerified: true,
  });
  return { user, token: signAccessToken(user) };
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await Settings.deleteOne({ _id: SETTINGS_ID });
  await mongoose.disconnect();
});
beforeEach(async () => {
  // One document, shared by the whole suite — each test starts from "never
  // configured" so the env-fallback cases are real rather than leftovers.
  await Settings.deleteOne({ _id: SETTINGS_ID });
});

describe('the governance gate', () => {
  it('refuses an unauthenticated read and write', async () => {
    await request(app).get('/admin/settings').expect(401);
    await request(app).patch('/admin/settings').send({ aiGuestDailyMax: 10 }).expect(401);
  });

  it('refuses an EMPLOYEE even with every permission granted', async () => {
    // The point: this is not a missing permission, it is a hard role gate. No
    // grant can open it — otherwise an employee could raise the Client's OpenAI
    // spend ceiling or repoint the published support address.
    const { token } = await makeStaff('employee', [
      'organisation:read',
      'audit:read',
      'featured:manage',
      'category:manage',
      'user:read',
    ]);
    await request(app).get('/admin/settings').set(bearer(token)).expect(403);
    await request(app).patch('/admin/settings').set(bearer(token)).send({ aiGuestDailyMax: 10 }).expect(403);
  });

  it('refuses a buyer and an exporter', async () => {
    for (const role of ['buyer', 'exporter']) {
      const { token } = await makeStaff(role);
      await request(app).get('/admin/settings').set(bearer(token)).expect(403);
    }
  });
});

describe('reading', () => {
  it('reports "never configured" without creating the document', async () => {
    const { token } = await makeStaff('superadmin');
    const res = await request(app).get('/admin/settings').set(bearer(token)).expect(200);

    expect(res.body.settings.aiGuestDailyMax).toBeNull();
    expect(res.body.settings.supportEmail).toBeNull();
    // A GET must not write. An absent document is a state, not an error.
    expect(await Settings.countDocuments({})).toBe(0);
  });

  it('shows the env floor alongside the override, so nobody guesses which wins', async () => {
    const { token } = await makeStaff('superadmin');
    const res = await request(app).get('/admin/settings').set(bearer(token)).expect(200);
    expect(res.body.settings.envAiGuestDailyMax).toBe(env.AI_GUEST_DAILY_MAX ?? null);
  });

  it('returns ONLY the allowlisted fields — never a secret', async () => {
    const { token } = await makeStaff('superadmin');
    const res = await request(app).get('/admin/settings').set(bearer(token)).expect(200);
    // If someone later adds a field to this page, this assertion is the thing
    // that makes them come and read D8's "never a secret" note first.
    expect(Object.keys(res.body.settings).sort()).toEqual([
      'aiGuestDailyMax',
      'envAiGuestDailyMax',
      'supportEmail',
      'supportPhone',
      'updatedAt',
      'updatedBy',
    ]);
  });
});

describe('§3.3 — the AI guest ceiling is changeable at any time', () => {
  it('saves an override and it becomes the effective ceiling', async () => {
    const { token } = await makeStaff('superadmin');
    await request(app).patch('/admin/settings').set(bearer(token)).send({ aiGuestDailyMax: 7 }).expect(200);

    expect((await request(app).get('/admin/settings').set(bearer(token))).body.settings.aiGuestDailyMax).toBe(7);
    // The part that matters — the search path actually uses it.
    expect(await effectiveAiGuestDailyMax()).toBe(7);
  });

  it('clearing the override falls back to the ENV floor, never to unlimited', async () => {
    const { token } = await makeStaff('superadmin');
    await request(app).patch('/admin/settings').set(bearer(token)).send({ aiGuestDailyMax: 7 }).expect(200);
    await request(app).patch('/admin/settings').set(bearer(token)).send({ aiGuestDailyMax: null }).expect(200);

    // 🔴 The direction of this fallback is the whole safety property: this is a
    // SPEND control, so "no override" must mean the env ceiling, not no ceiling.
    expect(await effectiveAiGuestDailyMax()).toBe(env.AI_GUEST_DAILY_MAX ?? null);
  });

  it('refuses a ceiling of 0 or a negative', async () => {
    const { token } = await makeStaff('superadmin');
    // 0 would read as "no guest AI at all" — a product decision disguised as a
    // number, and not what this control is for.
    await request(app).patch('/admin/settings').set(bearer(token)).send({ aiGuestDailyMax: 0 }).expect(400);
    await request(app).patch('/admin/settings').set(bearer(token)).send({ aiGuestDailyMax: -5 }).expect(400);
  });
});

describe('the support contact', () => {
  it('saves an email and a phone, and clears them with an empty string', async () => {
    const { token } = await makeStaff('superadmin');
    await request(app)
      .patch('/admin/settings')
      .set(bearer(token))
      .send({ supportEmail: 'Help@MPX.example', supportPhone: '+91 98765 43210' })
      .expect(200);

    let res = await request(app).get('/admin/settings').set(bearer(token)).expect(200);
    expect(res.body.settings.supportEmail).toBe('help@mpx.example'); // lowercased
    expect(res.body.settings.supportPhone).toBe('+91 98765 43210');

    await request(app).patch('/admin/settings').set(bearer(token)).send({ supportEmail: '' }).expect(200);
    res = await request(app).get('/admin/settings').set(bearer(token)).expect(200);
    expect(res.body.settings.supportEmail).toBeNull();
  });

  it('refuses a malformed email', async () => {
    const { token } = await makeStaff('superadmin');
    await request(app).patch('/admin/settings').set(bearer(token)).send({ supportEmail: 'not-an-email' }).expect(400);
  });
});

describe('the allowlist holds', () => {
  it('refuses an unknown key rather than ignoring it', async () => {
    const { token } = await makeStaff('superadmin');
    // The named exclusions from D8 — caps, OTP knobs, secrets — must not be
    // settable here by simply posting them.
    for (const body of [
      { activeProductCap: 5 },
      { otpTtlSeconds: 999 },
      { smtpPassword: 'hunter2' },
    ]) {
      await request(app).patch('/admin/settings').set(bearer(token)).send(body).expect(400);
    }
  });

  it('refuses an empty body', async () => {
    const { token } = await makeStaff('superadmin');
    await request(app).patch('/admin/settings').set(bearer(token)).send({}).expect(400);
  });
});

describe('§11.1 — every change is recorded', () => {
  it('writes an audit entry naming the actor and the before/after', async () => {
    const { user, token } = await makeStaff('superadmin');
    await request(app).patch('/admin/settings').set(bearer(token)).send({ aiGuestDailyMax: 42 }).expect(200);

    const entry = await AuditLog.findOne({ action: 'settings.update' }).sort({ occurredAt: -1 });
    expect(entry).toBeTruthy();
    expect(String(entry.actorId)).toBe(String(user._id));
    expect(entry.actorRole).toBe('superadmin');
    expect(entry.after.aiGuestDailyMax).toBe(42);
    // "from what" is half the value of the record.
    expect(entry.before).toHaveProperty('aiGuestDailyMax');
  });

  it('a NO-OP save records nothing', async () => {
    const { token } = await makeStaff('superadmin');
    await request(app).patch('/admin/settings').set(bearer(token)).send({ aiGuestDailyMax: 11 }).expect(200);
    const count = await AuditLog.countDocuments({ action: 'settings.update' });

    // Same value again — the log must not claim a change happened.
    await request(app).patch('/admin/settings').set(bearer(token)).send({ aiGuestDailyMax: 11 }).expect(200);
    expect(await AuditLog.countDocuments({ action: 'settings.update' })).toBe(count);
  });

  it('stays a SINGLE document no matter how many saves', async () => {
    const { token } = await makeStaff('superadmin');
    for (const n of [1, 2, 3]) {
      await request(app).patch('/admin/settings').set(bearer(token)).send({ aiGuestDailyMax: n }).expect(200);
    }
    expect(await Settings.countDocuments({})).toBe(1);
  });
});
