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

/**
 * Resolve who a challenge belongs to — an account, or an A21 pending signup that
 * has no account yet.
 *
 * 🔴 This helper exists to make a missing subject IMPOSSIBLE, not merely unlikely.
 * Mongoose strips `undefined` from a query, so a filter built as
 * `{ userId: undefined, purpose }` silently becomes `{ purpose }` — which matches
 * EVERY user's challenge for that purpose and would let one person's code verify
 * another person's account. Building the filter here, and throwing when neither
 * subject is supplied, is what keeps that from ever being expressible.
 */
function subjectFilter({ user, pendingSignup }) {
  if (user && pendingSignup) {
    throw new Error('otp subject: pass a user OR a pendingSignup, never both');
  }
  if (user) return { userId: user._id };
  if (pendingSignup) return { pendingSignupId: pendingSignup._id };
  throw new Error('otp subject: a user or a pendingSignup is required');
}

// The address is always read off the SUBJECT's own record, never off the request
// (auth-sessions A3) — a code must not be sendable to an address the caller typed.
function identifierFor({ user, pendingSignup, channel }) {
  const subject = user ?? pendingSignup;
  return channel === 'email' ? subject.email : subject.mobile.e164;
}

// Issue an OTP to the subject's OWN address (never a request-supplied one). The
// code is hashed before storage and only handed to the delivery adapter.
export async function requestOtp({ user, pendingSignup, purpose, channel = 'mobile' }) {
  const owner = subjectFilter({ user, pendingSignup });
  const identifier = identifierFor({ user, pendingSignup, channel });

  // Durable lock: if a live challenge is currently locked, do NOT replace it —
  // otherwise the 5-attempt/15-min lock (A3) could be reset just by requesting a
  // new OTP. Refuse until the lock expires.
  const locked = await OtpChallenge.findOne({
    ...owner,
    purpose,
    consumedAt: null,
    lockedUntil: { $gt: new Date() },
  });
  if (locked) {
    throw AppError.unauthorized('otp locked', 'Too many attempts. Please try again later.');
  }

  // Only one live challenge per (subject, purpose). Signup's email and mobile
  // codes survive each other only because they use DIFFERENT purposes — see the
  // note on OTP_PURPOSE in models/enums.js before changing either.
  await OtpChallenge.deleteMany({ ...owner, purpose, consumedAt: null });

  const code = randomNumericCode(env.OTP_LENGTH);
  await OtpChallenge.create({
    ...owner,
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
export async function verifyOtp({ userId, pendingSignupId, purpose, code }) {
  // Same reasoning as `subjectFilter` above: never let an absent subject collapse
  // into "any subject". Built explicitly so `{ userId: undefined }` cannot happen.
  const owner = userId ? { userId } : { pendingSignupId };
  if (!owner.userId && !owner.pendingSignupId) {
    throw new Error('verifyOtp: a userId or a pendingSignupId is required');
  }

  const challenge = await OtpChallenge.findOne({ ...owner, purpose, consumedAt: null })
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
