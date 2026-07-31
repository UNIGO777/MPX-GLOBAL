/**
 * A3 (auth-sessions): six digits, five-minute expiry, FIVE attempts then a
 * fifteen-minute lock, stored hashed. That lock is the only thing standing
 * between a 6-digit code and brute force, and it had no test at all — so these
 * cover it directly at the service layer, including the concurrent path where a
 * read-modify-write counter would silently let the lock be bypassed.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';

vi.mock('../src/services/otp.sender.js', () => ({ sendOtp: vi.fn(async () => {}) }));

const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { OtpChallenge } = await import('../src/models/OtpChallenge.js');
const { requestOtp, verifyOtp } = await import('../src/services/otp.service.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { env } = await import('../src/config/env.js');

let seq = 0;
let user;

async function makeUser() {
  seq += 1;
  const org = await Organisation.create({ name: `Org ${seq}`, type: 'business', buyerSide: true });
  return User.create({
    name: `otp-${seq}`,
    email: `otp_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `77${1000000 + seq}`, e164: `+9177${1000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role: 'buyer',
    orgId: org._id,
  });
}

// The plaintext is never returned or logged by design, so a test cannot read it.
// Re-stamping a KNOWN hash is the only way to exercise the success path without
// weakening the service — the storage format stays exactly as production writes it.
async function forceKnownCode(userId, purpose, code) {
  const argon2 = (await import('argon2')).default;
  await OtpChallenge.updateOne(
    { userId, purpose, consumedAt: null },
    { $set: { codeHash: await argon2.hash(code, { type: argon2.argon2id }) } },
  );
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Organisation.deleteMany({}), OtpChallenge.deleteMany({})]);
  user = await makeUser();
});

describe('OTP attempt lock (A3)', () => {
  it('locks after exactly OTP_MAX_ATTEMPTS wrong codes, and the lock outlives the wrong guesses', async () => {
    await requestOtp({ user, purpose: 'login' });

    for (let i = 1; i < env.OTP_MAX_ATTEMPTS; i += 1) {
      await expect(verifyOtp({ userId: user._id, purpose: 'login', code: '000000' })).rejects.toMatchObject({
        clientMessage: 'Invalid or expired code.',
      });
      const mid = await OtpChallenge.findOne({ userId: user._id, purpose: 'login' });
      expect(mid.attempts).toBe(i);
      expect(mid.lockedUntil).toBeFalsy(); // not yet — the cap is not reached
    }

    // The Nth wrong attempt trips the lock.
    await expect(verifyOtp({ userId: user._id, purpose: 'login', code: '000000' })).rejects.toBeTruthy();
    const locked = await OtpChallenge.findOne({ userId: user._id, purpose: 'login' });
    expect(locked.attempts).toBe(env.OTP_MAX_ATTEMPTS);
    expect(locked.lockedUntil).toBeTruthy();
    expect(locked.lockedUntil.getTime()).toBeGreaterThan(Date.now());

    // Once locked the message changes — and, critically, the CORRECT code is
    // refused too. A lock that the right code walks through is not a lock.
    await forceKnownCode(user._id, 'login', '123456');
    await expect(verifyOtp({ userId: user._id, purpose: 'login', code: '123456' })).rejects.toMatchObject({
      clientMessage: 'Too many attempts. Please try again later.',
    });
  });

  it('a locked challenge cannot be reset by asking for a new OTP (durable lock)', async () => {
    await requestOtp({ user, purpose: 'login' });
    for (let i = 0; i < env.OTP_MAX_ATTEMPTS; i += 1) {
      await expect(verifyOtp({ userId: user._id, purpose: 'login', code: '000000' })).rejects.toBeTruthy();
    }

    await expect(requestOtp({ user, purpose: 'login' })).rejects.toMatchObject({
      clientMessage: 'Too many attempts. Please try again later.',
    });
    // The original challenge is still there — not replaced by a fresh one.
    expect(await OtpChallenge.countDocuments({ userId: user._id, purpose: 'login' })).toBe(1);
  });

  it('CONCURRENT wrong guesses each count — the lock cannot be raced open', async () => {
    await requestOtp({ user, purpose: 'login' });

    // Fire 5x the cap at once. With a read-modify-write counter these collapse
    // into a single increment and the challenge never locks.
    const burst = env.OTP_MAX_ATTEMPTS * 5;
    const results = await Promise.allSettled(
      Array.from({ length: burst }, () => verifyOtp({ userId: user._id, purpose: 'login', code: '000000' })),
    );
    expect(results.every((r) => r.status === 'rejected')).toBe(true);

    const after = await OtpChallenge.findOne({ userId: user._id, purpose: 'login' });
    // NOT `toBe(burst)`: once the lock lands, callers still in flight hit the
    // lockedUntil check and are refused BEFORE they increment — so a count below
    // `burst` is correct behaviour, not a lost write. What must hold is that the
    // guesses that DID get counted were counted individually, so the cap is
    // reached and the lock fires. (Against the old read-modify-write code they
    // collapsed to a single increment and `lockedUntil` stayed empty.)
    expect(after.attempts).toBeGreaterThanOrEqual(env.OTP_MAX_ATTEMPTS);
    expect(after.attempts).toBeLessThanOrEqual(burst);
    expect(after.lockedUntil).toBeTruthy();

    // And it is genuinely closed afterwards.
    await forceKnownCode(user._id, 'login', '654321');
    await expect(verifyOtp({ userId: user._id, purpose: 'login', code: '654321' })).rejects.toMatchObject({
      clientMessage: 'Too many attempts. Please try again later.',
    });
  });
});

describe('OTP single use', () => {
  it('the same correct code cannot be redeemed twice', async () => {
    await requestOtp({ user, purpose: 'login' });
    await forceKnownCode(user._id, 'login', '111222');

    await expect(verifyOtp({ userId: user._id, purpose: 'login', code: '111222' })).resolves.toBe(true);
    await expect(verifyOtp({ userId: user._id, purpose: 'login', code: '111222' })).rejects.toMatchObject({
      clientMessage: 'Invalid or expired code.',
    });
  });

  it('CONCURRENT redemptions of one correct code yield exactly one success', async () => {
    await requestOtp({ user, purpose: 'login' });
    await forceKnownCode(user._id, 'login', '333444');

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => verifyOtp({ userId: user._id, purpose: 'login', code: '333444' })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('an expired challenge fails even with the right code', async () => {
    await requestOtp({ user, purpose: 'login' });
    await forceKnownCode(user._id, 'login', '555666');
    await OtpChallenge.updateOne(
      { userId: user._id, purpose: 'login' },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    await expect(verifyOtp({ userId: user._id, purpose: 'login', code: '555666' })).rejects.toMatchObject({
      clientMessage: 'Invalid or expired code.',
    });
  });

  it('an OTP is scoped to its purpose — a login code cannot reset a password', async () => {
    await requestOtp({ user, purpose: 'login' });
    await forceKnownCode(user._id, 'login', '777888');

    await expect(verifyOtp({ userId: user._id, purpose: 'forgot_password', code: '777888' })).rejects.toBeTruthy();
  });

  it('an OTP is scoped to its user — another account cannot spend it', async () => {
    await requestOtp({ user, purpose: 'login' });
    await forceKnownCode(user._id, 'login', '999000');
    const other = await makeUser();

    await expect(verifyOtp({ userId: other._id, purpose: 'login', code: '999000' })).rejects.toBeTruthy();
  });
});
