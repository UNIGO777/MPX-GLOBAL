import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from '../config/env.js';

/**
 * Reversible encryption for a single stored field (owner, 2026-09-25 — bank
 * account numbers). AES-256-GCM.
 *
 * ── What this protects against, and what it does not ──────────────────────
 *
 * 🔴 It protects a **database that leaves the server**: a stolen backup, a
 * mis-set Mongo permission, a dump handed to a contractor, a decommissioned
 * disk. In all of those the key is not present and the numbers are unreadable.
 *
 * 🔴 It does **NOT** protect against anyone who has the application's own
 * environment. The server must be able to print these numbers on a quotation,
 * so it must be able to decrypt them — which means whoever holds `.env` holds
 * the plaintext. Anyone saying "the bank details are encrypted" should know
 * that sentence ends there. Hashing is not an option: a hash cannot be printed
 * on a document.
 *
 * 🔴 **GCM, not CBC.** The auth tag means tampered ciphertext fails loudly
 * instead of decrypting to rubbish. On an account number that matters: silently
 * garbled digits on a payment document is worse than an error.
 *
 * 🔴 **A fresh random IV per encryption**, never reused. GCM with a repeated IV
 * and the same key leaks the plaintext relationship between records — it is the
 * one mistake that turns this from real protection into decoration.
 *
 * ⚠️ **If FIELD_ENCRYPTION_KEY is lost, every encrypted field is lost too.** No
 * recovery exists, by design. It belongs in the same place as the database
 * password and must be part of the same backup discipline. Rotating it needs a
 * re-encryption pass over the stored rows; there is no automatic migration.
 */

const PREFIX = 'v1';
const IV_BYTES = 12; // 96 bits — the size GCM is specified for
const KEY_BYTES = 32; // AES-256

let cachedKey = null;

/**
 * The key, decoded once.
 *
 * Accepts base64 or hex so an operator can paste whatever their generator gave
 * them, and refuses anything that is not exactly 32 bytes — a short key is the
 * failure that looks like it works.
 */
function getKey() {
  if (cachedKey) return cachedKey;

  const raw = env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('FIELD_ENCRYPTION_KEY is not set — cannot store or read an encrypted field');
  }

  let key = null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, 'hex');
  else {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === KEY_BYTES) key = decoded;
  }

  if (!key || key.length !== KEY_BYTES) {
    throw new Error(`FIELD_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (base64 or hex)`);
  }

  cachedKey = key;
  return cachedKey;
}

/** True when the key is configured — used by the boot self-check, not by callers. */
export function isFieldCryptoConfigured() {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/** `v1:<iv>:<tag>:<ciphertext>`, all base64. */
export function encryptField(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [PREFIX, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** True for a value this module produced. */
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(`${PREFIX}:`);
}

/**
 * Decrypt a stored value.
 *
 * 🔴 A value that is NOT in our format is returned unchanged. That is the
 * migration path for rows written before encryption existed (2026-09-25), and
 * it is one-way: the model's write hook keys on "is this plaintext?" rather
 * than "did it change?", so ANY save of a legacy row converts it. Remove this
 * tolerance once no plaintext remains, or it quietly becomes a way to store
 * unencrypted numbers forever.
 */
export function decryptField(stored) {
  if (stored == null || stored === '') return stored;
  if (!isEncrypted(stored)) return stored;

  const [, ivB64, tagB64, dataB64] = String(stored).split(':');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  // Throws on a tampered or truncated value rather than returning rubbish.
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
