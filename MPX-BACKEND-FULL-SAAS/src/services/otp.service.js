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
    challenge.attempts += 1;
    if (challenge.attempts >= challenge.maxAttempts) {
      challenge.lockedUntil = new Date(now + env.OTP_LOCK_SECONDS * 1000);
    }
    await challenge.save();
    throw fail();
  }

  challenge.consumedAt = new Date();
  await challenge.save();
  return true;
}
