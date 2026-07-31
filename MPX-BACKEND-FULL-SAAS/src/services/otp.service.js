import crypto from 'node:crypto';

import argon2 from 'argon2';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { OtpChallenge } from '../models/OtpChallenge.js';
import { sendOtp } from './otp.sender.js';

function randomNumericCode(length) {
  let code = '';
  while (code.length < length) code += crypto.randomInt(0, 10).toString();
  return code;
}

// Issue an OTP to the account's OWN address (never a request-supplied one). The
// code is hashed before storage and only handed to the delivery adapter.
export async function requestOtp({ user, purpose, channel = 'mobile' }) {
  const identifier = channel === 'email' ? user.email : user.mobile.e164;

  // Durable lock: if a live challenge is currently locked, do NOT replace it —
  // otherwise the 5-attempt/15-min lock (A3) could be reset just by requesting a
  // new OTP. Refuse until the lock expires.
  const locked = await OtpChallenge.findOne({
    userId: user._id,
    purpose,
    consumedAt: null,
    lockedUntil: { $gt: new Date() },
  });
  if (locked) {
    throw AppError.unauthorized('otp locked', 'Too many attempts. Please try again later.');
  }

  // Only one live challenge per (user, purpose).
  await OtpChallenge.deleteMany({ userId: user._id, purpose, consumedAt: null });

  const code = randomNumericCode(env.OTP_LENGTH);
  await OtpChallenge.create({
    userId: user._id,
    identifier,
    channel,
    purpose,
    codeHash: await argon2.hash(code, { type: argon2.argon2id }),
    expiresAt: new Date(Date.now() + env.OTP_TTL_SECONDS * 1000),
    maxAttempts: env.OTP_MAX_ATTEMPTS,
  });

  await sendOtp({ channel, purpose, identifier, code });
  // Code is never returned.
}

// Verify the latest live challenge. Wrong code counts an attempt; hitting the
// max locks the challenge for the configured window. Same generic message for
// every failure path.
export async function verifyOtp({ userId, purpose, code }) {
  const challenge = await OtpChallenge.findOne({ userId, purpose, consumedAt: null })
    .sort({ createdAt: -1 })
    .select('+codeHash');

  const fail = () => AppError.unauthorized('otp check failed', 'Invalid or expired code.');
  if (!challenge) throw fail();

  const now = Date.now();
  if (challenge.lockedUntil && challenge.lockedUntil.getTime() > now) {
    throw AppError.unauthorized('otp locked', 'Too many attempts. Please try again later.');
  }
  if (challenge.expiresAt.getTime() <= now) throw fail();

  if (!(await argon2.verify(challenge.codeHash, code))) {
    // Count the attempt ATOMICALLY. A read-modify-write here (`challenge.attempts
    // += 1; save()`) lets N concurrent wrong guesses all read the same value and
    // collapse into a single increment — which defeats the 5-attempt lock (A3)
    // outright, turning a 6-digit code into an unlimited brute-force target. The
    // argon2 verify above takes ~100ms, so that window is wide and easy to hit.
    const updated = await OtpChallenge.findOneAndUpdate(
      { _id: challenge._id },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after', projection: { attempts: 1, maxAttempts: 1, lockedUntil: 1 } },
    );
    if (updated && updated.attempts >= updated.maxAttempts) {
      // `lockedUntil: null` also matches "field absent", so the lock is stamped
      // exactly once — a later loser cannot slide the window forward.
      await OtpChallenge.updateOne(
        { _id: challenge._id, lockedUntil: null },
        { $set: { lockedUntil: new Date(Date.now() + env.OTP_LOCK_SECONDS * 1000) } },
      );
    }
    throw fail();
  }

  // Consume ATOMICALLY too: an OTP is single-use, so only the request that
  // actually flips `consumedAt` may proceed. Without the guard, two concurrent
  // submissions of the same correct code both open a session.
  const consumed = await OtpChallenge.findOneAndUpdate(
    { _id: challenge._id, consumedAt: null },
    { $set: { consumedAt: new Date() } },
  );
  if (!consumed) throw fail();
  return true;
}
