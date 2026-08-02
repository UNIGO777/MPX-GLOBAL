import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';

/**
 * `twofactor.service.js` — the backup-code half of A4.
 *
 * D4 (Super Admin TOTP) is ON HOLD, so no route reaches this yet. The SERVICE is
 * shipped code all the same, and `auth-sessions.md` A4 commits to it precisely:
 * "Backup codes stored hashed, single use." Only `verifyTotp` had a test, so the
 * hashing and the single-use rule — the two parts a mistake would actually cost
 * something — were unverified.
 *
 * Nothing here builds any part of D4. It tests functions that already exist.
 */

import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import {
  generateTotpSecret,
  totpKeyUri,
  generateTotp,
  verifyTotp,
  generateBackupCodes,
  hashBackupCodes,
  consumeBackupCode,
} from '../src/services/twofactor.service.js';
import { hashPassword } from '../src/services/password.service.js';

let seq = 0;

/**
 * `consumeBackupCode` calls `user.save()`, so the document must be loaded with
 * BOTH `twoFactorBackupCodes` and `passwordHash` — the latter is `select:false`
 * and `required`, so a save on a document that omitted it fails validation.
 * Recorded here because whoever wires D4 has to know it (see the test below).
 */
const FULL = '+twoFactorBackupCodes +passwordHash';

async function makeStaffWithCodes() {
  seq += 1;
  const org =
    (await Organisation.findOne({ type: 'platform' })) ??
    (await Organisation.create({ name: 'MPX Platform', type: 'platform' }));
  const codes = generateBackupCodes();
  const number = `93${1000000 + seq}`;
  const user = await User.create({
    name: 'Super Admin',
    email: `sa_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number, e164: `+91${number}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'superadmin',
    orgId: org._id,
    isActive: true,
    isTwoFactorEnabled: true,
    twoFactorSecret: generateTotpSecret(),
    twoFactorBackupCodes: await hashBackupCodes(codes),
  });
  return { user, codes };
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const n of mongoose.modelNames()) await mongoose.model(n).syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Organisation.deleteMany({})]);
});

describe('TOTP secret and provisioning URI', () => {
  it('generates a usable secret and a code that verifies against it', async () => {
    const secret = generateTotpSecret();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(10);

    const code = await generateTotp(secret);
    expect(await verifyTotp(secret, code)).toBe(true);
  });

  it('a code from one secret does not verify against another', async () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(await verifyTotp(b, await generateTotp(a))).toBe(false);
  });

  it('verifyTotp is strict about junk rather than throwing', async () => {
    const secret = generateTotpSecret();
    expect(await verifyTotp(secret, '000000')).toBe(false);
    expect(await verifyTotp(secret, 'not-a-code')).toBe(false);
    expect(await verifyTotp(secret, '')).toBe(false);
    expect(await verifyTotp(secret, null)).toBe(false);
    expect(await verifyTotp(null, '000000')).toBe(false);
    expect(await verifyTotp(undefined, undefined)).toBe(false);
  });

  it('the provisioning URI names the issuer and carries the secret', () => {
    const secret = generateTotpSecret();
    const uri = totpKeyUri('admin@example.com', secret);

    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain('MPX%20Global');
    expect(uri).toContain(secret);
  });
});

describe('backup codes (A4: stored hashed, single use)', () => {
  it('generates 8 distinct, non-trivial codes', () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) expect(c).toMatch(/^[0-9a-f]{10}$/);

    // Two calls must not produce the same set.
    expect(generateBackupCodes()).not.toEqual(codes);
  });

  it('🔴 stores an argon2 HASH, never the code itself', async () => {
    const codes = generateBackupCodes();
    const stored = await hashBackupCodes(codes);

    expect(stored).toHaveLength(8);
    for (const [i, entry] of stored.entries()) {
      expect(entry.codeHash.startsWith('$argon2')).toBe(true);
      expect(entry.usedAt).toBeNull();
      // The plaintext appears nowhere in the stored record.
      expect(JSON.stringify(entry)).not.toContain(codes[i]);
    }
  });

  it('🔴 a code works exactly once — the second attempt is refused', async () => {
    const { user, codes } = await makeStaffWithCodes();

    const first = await User.findOne({ _id: user._id }).select(FULL);
    expect(await consumeBackupCode(first, codes[0])).toBe(true);

    const second = await User.findOne({ _id: user._id }).select(FULL);
    expect(await consumeBackupCode(second, codes[0])).toBe(false);
  });

  it('🔴 a used code is MARKED, never deleted — the usage stays auditable (A4)', async () => {
    const { user, codes } = await makeStaffWithCodes();

    const doc = await User.findOne({ _id: user._id }).select(FULL);
    await consumeBackupCode(doc, codes[3]);

    const after = await User.findOne({ _id: user._id }).select(FULL);
    // Still eight rows — the entry was stamped, not removed.
    expect(after.twoFactorBackupCodes).toHaveLength(8);
    const used = after.twoFactorBackupCodes.filter((e) => e.usedAt);
    expect(used).toHaveLength(1);
    expect(used[0].usedAt).toBeInstanceOf(Date);
  });

  it('spending one code leaves the other seven usable', async () => {
    const { user, codes } = await makeStaffWithCodes();

    const a = await User.findOne({ _id: user._id }).select(FULL);
    expect(await consumeBackupCode(a, codes[0])).toBe(true);

    const b = await User.findOne({ _id: user._id }).select(FULL);
    expect(await consumeBackupCode(b, codes[1])).toBe(true);

    const c = await User.findOne({ _id: user._id }).select(FULL);
    expect(await consumeBackupCode(c, codes[7])).toBe(true);

    const after = await User.findOne({ _id: user._id }).select(FULL);
    expect(after.twoFactorBackupCodes.filter((e) => e.usedAt)).toHaveLength(3);
  });

  it('refuses a code that was never issued, and does not consume anything trying', async () => {
    const { user } = await makeStaffWithCodes();

    const doc = await User.findOne({ _id: user._id }).select(FULL);
    expect(await consumeBackupCode(doc, 'deadbeef99')).toBe(false);
    expect(await consumeBackupCode(doc, '')).toBe(false);

    const after = await User.findOne({ _id: user._id }).select(FULL);
    expect(after.twoFactorBackupCodes.every((e) => e.usedAt === null)).toBe(true);
  });

  it('an account with no backup codes simply refuses', async () => {
    seq += 1;
    const org = await Organisation.create({ name: 'Plat', type: 'platform' });
    const number = `92${1000000 + seq}`;
    const user = await User.create({
      name: 'No Codes',
      email: `nc_${Date.now()}_${seq}@example.com`,
      mobile: { countryCode: '+91', number, e164: `+91${number}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'superadmin',
      orgId: org._id,
    });

    const doc = await User.findOne({ _id: user._id }).select(FULL);
    expect(await consumeBackupCode(doc, 'anything123')).toBe(false);
  });

  it('the codes never survive a plain read — the field is select:false', async () => {
    const { user } = await makeStaffWithCodes();

    const plain = await User.findOne({ _id: user._id });
    expect(plain.twoFactorBackupCodes).toBeUndefined();
    expect(plain.twoFactorSecret).toBeUndefined();

    // And even force-loaded, toJSON strips both (the baseSchema guard).
    const loaded = await User.findOne({ _id: user._id }).select(FULL + ' +twoFactorSecret');
    const json = loaded.toJSON();
    expect(json.twoFactorBackupCodes).toBeUndefined();
    expect(json.twoFactorSecret).toBeUndefined();
    expect(json.passwordHash).toBeUndefined();
  });

  /**
   * `consumeBackupCode` persists via `user.save()`, and `passwordHash` is
   * `required` + `select:false` — the shape that trips validation elsewhere in
   * this codebase (`userManagement.service` uses `updateOne` specifically to
   * avoid it). It does NOT bite here: Mongoose skips validation for paths a
   * partial load never selected, so redeeming a code works either way.
   *
   * Pinned because it is the kind of thing a future refactor could quietly
   * break — and because whoever restores D4 should not have to rediscover it.
   */
  it('redemption works whether or not passwordHash was selected (no partial-save trap)', async () => {
    const { user, codes } = await makeStaffWithCodes();

    const partial = await User.findOne({ _id: user._id }).select('+twoFactorBackupCodes');
    expect(await consumeBackupCode(partial, codes[0])).toBe(true);

    // It really persisted, and the untouched required field survived intact.
    const after = await User.findOne({ _id: user._id }).select(FULL);
    expect(after.twoFactorBackupCodes.filter((e) => e.usedAt)).toHaveLength(1);
    expect(after.passwordHash.startsWith('$argon2')).toBe(true);

    // And the spent code is genuinely spent.
    const again = await User.findOne({ _id: user._id }).select(FULL);
    expect(await consumeBackupCode(again, codes[0])).toBe(false);
  });
});
