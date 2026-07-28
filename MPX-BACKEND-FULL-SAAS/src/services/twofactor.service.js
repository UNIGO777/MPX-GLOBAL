import crypto from 'node:crypto';

import argon2 from 'argon2';
// otplib v13 functional API (named ESM exports). generate/verify are async.
import { generateSecret, generate, verify, generateURI } from 'otplib';

const ISSUER = 'MPX Global';
const BACKUP_CODE_COUNT = 8;

// --- TOTP (Super Admin 2FA, auth-sessions A4) ---------------------------------

export function generateTotpSecret() {
  return generateSecret();
}

export function totpKeyUri(accountName, secret) {
  return generateURI({ issuer: ISSUER, label: accountName, secret });
}

export function generateTotp(secret) {
  return generate({ secret });
}

export async function verifyTotp(secret, token) {
  if (!secret || token == null) return false;
  try {
    // v13 verify() returns { valid, delta, ... } — coerce to a strict boolean.
    const result = await verify({ token: String(token), secret });
    return result?.valid === true;
  } catch {
    return false;
  }
}

// --- Backup codes (stored hashed, single use) ---------------------------------

export function generateBackupCodes() {
  return Array.from({ length: BACKUP_CODE_COUNT }, () => crypto.randomBytes(5).toString('hex'));
}

export function hashBackupCodes(codes) {
  return Promise.all(
    codes.map(async (code) => ({
      codeHash: await argon2.hash(code, { type: argon2.argon2id }),
      usedAt: null,
    })),
  );
}

// Consume a backup code on a user doc whose twoFactorBackupCodes were selected.
export async function consumeBackupCode(user, code) {
  for (const entry of user.twoFactorBackupCodes ?? []) {
    if (entry.usedAt) continue;
    // Sequential by design: stop as soon as a code matches.
    if (await argon2.verify(entry.codeHash, code)) {
      entry.usedAt = new Date();
      await user.save();
      return true;
    }
  }
  return false;
}
