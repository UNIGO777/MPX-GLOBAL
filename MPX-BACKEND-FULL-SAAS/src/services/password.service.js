import argon2 from 'argon2';

// argon2id only (auth-sessions A1). The hash never leaves the server.
const OPTS = { type: argon2.argon2id };

export function hashPassword(plain) {
  return argon2.hash(plain, OPTS);
}

export function verifyPassword(hash, plain) {
  return argon2.verify(hash, plain);
}

// Verify against a throwaway hash when no user is found, so login latency does
// not reveal whether an account exists (auth-sessions: same error either way).
let dummyHashPromise;
export async function verifyDummy(plain) {
  if (!dummyHashPromise) dummyHashPromise = argon2.hash('timing-equalizer', OPTS);
  try {
    await argon2.verify(await dummyHashPromise, plain);
  } catch {
    /* always false — only here to spend the same time */
  }
}
