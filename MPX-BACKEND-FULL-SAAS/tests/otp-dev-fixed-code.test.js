import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `OTP_DEV_FIXED_CODE` — the predictable "000000" used by the seeded demo
 * accounts (`src/seed/test-accounts.js`, owner request 2026-09-21).
 *
 * 🔴 WHAT THESE TESTS EXIST TO PROTECT. A fixed OTP is a loaded gun: on a server
 * real users can reach, anyone who knows an email could sign in as them. The
 * safety is TWO INDEPENDENT LOCKS — `NODE_ENV === 'development'` AND the flag —
 * and that pairing is precisely the kind of thing a later "simplification"
 * collapses into one check. Every combination is pinned below, including the two
 * that matter most: production-with-the-flag-on, and test-with-the-flag-on.
 *
 * The second property pinned here is the design itself: the flag changes the
 * code's VALUE, never the verification. The challenge is still argon2-hashed, so
 * `verifyOtp` keeps comparing properly and there is no bypass branch to inherit.
 *
 * No database: `OtpChallenge` and the delivery adapter are both stubbed, so
 * these run anywhere.
 */

const OTP_LENGTH = 6;

/** Load a pristine `otp.service` under a chosen env, capturing what it issues. */
async function loadService({ nodeEnv, fixedCode }) {
  vi.resetModules();

  vi.doMock('../src/config/env.js', () => ({
    env: {
      NODE_ENV: nodeEnv,
      OTP_DEV_FIXED_CODE: fixedCode,
      OTP_LENGTH,
      OTP_TTL_SECONDS: 300,
      OTP_MAX_ATTEMPTS: 5,
      LOG_LEVEL: 'silent',
    },
  }));

  const created = [];
  vi.doMock('../src/models/OtpChallenge.js', () => ({
    OtpChallenge: {
      findOne: async () => null,
      deleteMany: async () => ({}),
      create: async (doc) => {
        created.push(doc);
        return doc;
      },
    },
  }));

  const delivered = [];
  vi.doMock('../src/services/otp.sender.js', () => ({
    sendOtp: async (payload) => {
      delivered.push(payload);
    },
  }));

  const { requestOtp } = await import('../src/services/otp.service.js');
  return { requestOtp, created, delivered };
}

const USER = {
  _id: 'u1',
  mobile: { e164: '+447700900101' },
  email: 'demo-buyer@mpx.test',
};

const issue = async (envSpec) => {
  const svc = await loadService(envSpec);
  await svc.requestOtp({ user: USER, purpose: 'login', channel: 'mobile' });
  return svc;
};

const ZEROS = '0'.repeat(OTP_LENGTH);

beforeEach(() => {
  vi.resetModules();
});

describe('OTP_DEV_FIXED_CODE · both locks are required', () => {
  it('development + flag on → the code is the known run of zeros', async () => {
    const { delivered } = await issue({ nodeEnv: 'development', fixedCode: true });
    expect(delivered[0].code).toBe(ZEROS);
  });

  it('🔴 production + flag on → still RANDOM (NODE_ENV is the lock that holds)', async () => {
    const { delivered } = await issue({ nodeEnv: 'production', fixedCode: true });
    expect(delivered[0].code).not.toBe(ZEROS);
    expect(delivered[0].code).toHaveLength(OTP_LENGTH);
  });

  it('🔴 test + flag on → still random; `test` is deliberately not "non-production"', async () => {
    const { delivered } = await issue({ nodeEnv: 'test', fixedCode: true });
    expect(delivered[0].code).not.toBe(ZEROS);
  });

  it('development + flag off → random, because the flag is default-deny', async () => {
    const { delivered } = await issue({ nodeEnv: 'development', fixedCode: false });
    expect(delivered[0].code).not.toBe(ZEROS);
  });
});

describe('OTP_DEV_FIXED_CODE · it is not a verification bypass', () => {
  it('🔴 the challenge still stores an argon2 hash, never the code itself', async () => {
    const { created, delivered } = await issue({ nodeEnv: 'development', fixedCode: true });

    // If the flag had been implemented as a `code === "000000"` shortcut in
    // verifyOtp, there would be nothing meaningful to hash here.
    expect(created[0].codeHash).toMatch(/^\$argon2/);
    expect(created[0].codeHash).not.toContain(delivered[0].code);
  });

  it('the challenge keeps its expiry and attempt cap — nothing is relaxed', async () => {
    const { created } = await issue({ nodeEnv: 'development', fixedCode: true });
    expect(created[0].maxAttempts).toBe(5);
    expect(created[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

/** Load a pristine `otp.sender` with both transports configured and watched. */
async function loadSender({ nodeEnv, fixedCode }) {
  vi.resetModules();
  // The service tests above stub the sender wholesale; without this the real
  // module never loads here and every transport assertion silently passes on a
  // stub. Cost one confusing red run to find.
  vi.doUnmock('../src/services/otp.sender.js');

  vi.doMock('../src/config/env.js', () => ({
    env: { NODE_ENV: nodeEnv, OTP_DEV_FIXED_CODE: fixedCode, OTP_DEV_PRINT: false, OTP_TTL_SECONDS: 300, LOG_LEVEL: 'silent' },
  }));

  const attempts = { sms: 0, email: 0 };
  vi.doMock('../src/services/sms.provider.js', () => ({
    isSmsConfigured: () => true,
    canDeliverTo: () => true,
    sendSms: async () => {
      attempts.sms += 1;
      return { requestId: 'r1' };
    },
  }));
  vi.doMock('../src/services/email.provider.js', () => ({
    isEmailConfigured: () => true,
    sendEmail: async () => {
      attempts.email += 1;
      return { messageId: 'm1' };
    },
  }));

  const { sendOtp } = await import('../src/services/otp.sender.js');
  return { sendOtp, attempts };
}

describe('OTP_DEV_FIXED_CODE · nothing is actually delivered', () => {
  it('🔴 fixed-code mode sends NO sms and NO email', async () => {
    // The demo accounts carry invented numbers. `canDeliverTo` only checks the
    // +91-and-ten-digits SHAPE, so without this a dev box with Fast2SMS keys
    // would text whoever really owns that number — and if the provider rejected
    // it instead, the throw would fail the login these accounts exist for.
    const { sendOtp, attempts } = await loadSender({ nodeEnv: 'development', fixedCode: true });
    await sendOtp({ channel: 'mobile', identifier: '+919000000001', code: '000000', purpose: 'login' });
    expect(attempts).toEqual({ sms: 0, email: 0 });
  });

  it('with the flag off, delivery happens as normal', async () => {
    const { sendOtp, attempts } = await loadSender({ nodeEnv: 'development', fixedCode: false });
    await sendOtp({ channel: 'mobile', identifier: '+919000000001', code: '123456', purpose: 'login' });
    expect(attempts.sms).toBe(1);
  });
});
