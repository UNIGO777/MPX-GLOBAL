import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * OTP delivery routing (Fast2SMS + SMTP).
 *
 * The two things worth protecting here:
 *
 *  1. **International buyers can still receive a code.** Fast2SMS is India-only,
 *     and buyer login is OTP-gated — so a non-+91 number MUST fall through to
 *     email rather than being posted to a gateway that cannot deliver it.
 *  2. **The code never leaks.** A3 / security-baseline #4: no OTP in a log line,
 *     an error message, or a thrown stack.
 */

const INDIAN = '+919876543210';
const INTERNATIONAL = '+14155550123';
const EMAIL = 'buyer@example.com';
const CODE = '654321';

const sms = vi.hoisted(() => ({ send: vi.fn(), configured: true }));
const email = vi.hoisted(() => ({ send: vi.fn(), configured: true }));
const log = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }));

vi.mock('../src/services/sms.provider.js', async () => {
  // canDeliverTo is the real implementation on purpose — it is the guard under
  // test, and mocking it would assert nothing about India-only routing.
  const actual = await vi.importActual('../src/services/sms.provider.js');
  return {
    ...actual,
    isSmsConfigured: () => sms.configured,
    sendSms: sms.send,
  };
});

vi.mock('../src/services/email.provider.js', () => ({
  isEmailConfigured: () => email.configured,
  sendEmail: email.send,
}));

vi.mock('../src/utils/logger.js', () => ({ logger: log }));


const { sendOtp, describeOtpTransports } = await import('../src/services/otp.sender.js');
const { canDeliverTo } = await import('../src/services/sms.provider.js');

beforeEach(() => {
  sms.configured = true;
  email.configured = true;
  sms.send.mockReset().mockResolvedValue({ requestId: 'req_1' });
  email.send.mockReset().mockResolvedValue({ messageId: 'msg_1' });
  log.info.mockReset();
  log.error.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env.NODE_ENV = 'test';
  delete process.env.AI_GUEST_DAILY_MAX;
});

/**
 * Flip the process into production for a re-import.
 *
 * 🔴 Setting NODE_ENV alone is no longer enough (2026-08-21). `env.js` now
 * REQUIRES `AI_GUEST_DAILY_MAX` in production — the Client-set guest AI-search
 * ceiling, agreement §3.3/§5.1 — so a bare NODE_ENV='production' re-import now
 * fails validation and exits before the module under test is reached.
 *
 * The right fix is to give the test a COMPLETE production environment rather
 * than to relax the check: a real production deploy carries this variable, and
 * a schema that let it be absent would rebuild the fail-open it exists to
 * remove. The value is irrelevant to anything in this file.
 */
function enterProduction() {
  process.env.NODE_ENV = 'production';
  process.env.AI_GUEST_DAILY_MAX = '500';
}

describe('canDeliverTo — Fast2SMS is India-only', () => {
  it('accepts a well-formed Indian mobile', () => {
    expect(canDeliverTo(INDIAN)).toBe(true);
  });

  it.each([
    ['international', INTERNATIONAL],
    ['UK', '+447700900123'],
    ['missing country code', '9876543210'],
    ['too short', '+91987654321'],
    ['too long', '+9198765432100'],
    ['empty', ''],
    ['nullish', null],
  ])('rejects %s', (_label, value) => {
    expect(canDeliverTo(value)).toBe(false);
  });
});

describe('routing', () => {
  it('sends an Indian mobile code over SMS', async () => {
    await sendOtp({ channel: 'mobile', identifier: INDIAN, code: CODE, purpose: 'login' });

    expect(sms.send).toHaveBeenCalledOnce();
    expect(email.send).not.toHaveBeenCalled();
    expect(sms.send.mock.calls[0][0].to).toBe(INDIAN);
  });

  it('🔴 falls back to EMAIL for an international number — the buyer path', async () => {
    // Regression guard: without this, every non-Indian buyer is locked out of
    // login because their code is posted to a gateway that cannot deliver it.
    await sendOtp({ channel: 'mobile', identifier: INTERNATIONAL, code: CODE, purpose: 'login' });

    expect(sms.send).not.toHaveBeenCalled();
  });

  it('uses SMTP when the channel is email', async () => {
    await sendOtp({ channel: 'email', identifier: EMAIL, code: CODE, purpose: 'login' });

    expect(email.send).toHaveBeenCalledOnce();
    expect(sms.send).not.toHaveBeenCalled();
    expect(email.send.mock.calls[0][0].to).toBe(EMAIL);
  });

  it('falls back to email when SMS is unconfigured', async () => {
    sms.configured = false;
    await sendOtp({ channel: 'email', identifier: EMAIL, code: CODE, purpose: 'login' });

    expect(sms.send).not.toHaveBeenCalled();
    expect(email.send).toHaveBeenCalledOnce();
  });
});

describe('failure posture', () => {
  it('THROWS in production when nothing can deliver', async () => {
    // A warn-and-return would leave the user on a code screen forever and make a
    // broken deploy look healthy.
    enterProduction();
    vi.resetModules();
    const { sendOtp: prodSendOtp } = await import('../src/services/otp.sender.js');

    sms.configured = false;
    email.configured = false;

    await expect(
      prodSendOtp({ channel: 'mobile', identifier: INDIAN, code: CODE, purpose: 'login' }),
    ).rejects.toThrow(/no transport/i);
  });

  it('propagates a gateway rejection rather than swallowing it', async () => {
    sms.send.mockRejectedValue(new Error('fast2sms: gateway rejected the message'));

    await expect(
      sendOtp({ channel: 'mobile', identifier: INDIAN, code: CODE, purpose: 'login' }),
    ).rejects.toThrow(/gateway rejected/);
  });
});

/**
 * The developer convenience — and the gate that keeps it a convenience.
 * `env` is frozen at import, so each case re-imports the module under a
 * different NODE_ENV (same pattern as the production-throw case above).
 */
describe('🔴 dev OTP terminal print needs BOTH locks', () => {
  const ORIGINAL_PRINT = process.env.OTP_DEV_PRINT;

  afterEach(() => {
    if (ORIGINAL_PRINT === undefined) delete process.env.OTP_DEV_PRINT;
    else process.env.OTP_DEV_PRINT = ORIGINAL_PRINT;
  });

  // `devPrint: null` means "leave the variable unset". NOT `undefined` — a
  // destructuring default fires on an explicitly-passed undefined, so
  // `{ devPrint: undefined }` would silently become 'true' and the test would
  // assert the opposite of what it claims (this exact bug, caught 2026-08-07).
  async function sendUnder(nodeEnv, { devPrint = 'true', channel = 'mobile', ...overrides } = {}) {
    if (nodeEnv === 'production') enterProduction();
    else process.env.NODE_ENV = nodeEnv;
    if (devPrint === null) delete process.env.OTP_DEV_PRINT;
    else process.env.OTP_DEV_PRINT = devPrint;
    vi.resetModules();
    const { sendOtp: scoped } = await import('../src/services/otp.sender.js');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    Object.assign(sms, overrides.sms ?? {});
    Object.assign(email, overrides.email ?? {});
    const identifier = channel === 'email' ? EMAIL : INDIAN;
    await scoped({ channel, identifier, code: CODE, purpose: 'login' }).catch(() => {});
    return spy;
  }

  const printed = (spy) => spy.mock.calls.flat().join(' ').includes(CODE);

  it('prints in development EVEN WHEN a transport delivers successfully', async () => {
    // The regression this guards: the print used to be a last resort, so
    // configuring SMTP silently took the code away from the terminal.
    const spy = await sendUnder('development');
    expect(sms.send).toHaveBeenCalled();
    expect(printed(spy)).toBe(true);
  });

  it('prints in development when NO transport is configured', async () => {
    const spy = await sendUnder('development', { sms: { configured: false }, email: { configured: false } });
    expect(printed(spy)).toBe(true);
  });

  it('prints for the EMAIL channel too, not just mobile', async () => {
    const spy = await sendUnder('development', { channel: 'email' });
    expect(printed(spy)).toBe(true);
  });

  // 🔴 DEFAULT-DENY: only the exact string 'true' may enable this. Two footguns
  // are pinned here — `z.coerce.boolean()` would make the string 'false' TRUE,
  // and `z.enum(['true','false'])` would REJECT the blank value `.env.example`
  // ships and kill the server at boot.
  //
  // "Unset" is not tested through the env var itself: env.js runs dotenv, which
  // fills anything process.env does not already define, so deleting the key just
  // lets the developer's own .env answer for it. Every non-'true' value below is
  // equivalent to unset as far as the transform is concerned.
  it.each([
    ['empty string (what .env.example ships)', ''],
    ['the literal false', 'false'],
    ['wrong case', 'TRUE'],
    ['a truthy-looking 1', '1'],
    ['yes', 'yes'],
  ])('🔴 lock 2: stays OFF for %s', async (_label, value) => {
    const spy = await sendUnder('development', { devPrint: value });
    expect(printed(spy)).toBe(false);
  });

  it('🔴 lock 1: NEVER prints in production, even with OTP_DEV_PRINT=true — success path', async () => {
    const spy = await sendUnder('production', { devPrint: 'true' });
    expect(printed(spy)).toBe(false);
  });

  it('🔴 lock 1: NEVER prints in production, even with OTP_DEV_PRINT=true — nothing-could-deliver path', async () => {
    const spy = await sendUnder('production', {
      devPrint: 'true',
      sms: { configured: false },
      email: { configured: false },
    });
    expect(printed(spy)).toBe(false);
  });

  it('stays silent under test, so suites do not print thousands of codes', async () => {
    const spy = await sendUnder('test', { devPrint: 'true', sms: { configured: false }, email: { configured: false } });
    expect(printed(spy)).toBe(false);
  });
});

describe('🔴 the code never leaks (A3 / security-baseline #4)', () => {
  it('is absent from every log line on the SMS path', async () => {
    await sendOtp({ channel: 'mobile', identifier: INDIAN, code: CODE, purpose: 'login' });

    const logged = JSON.stringify([log.info.mock.calls, log.error.mock.calls]);
    expect(logged).not.toContain(CODE);
  });

  it('is absent from every log line on the email path', async () => {
    await sendOtp({ channel: 'email', identifier: EMAIL, code: CODE, purpose: 'login' });

    const logged = JSON.stringify([log.info.mock.calls, log.error.mock.calls]);
    expect(logged).not.toContain(CODE);
  });

  it('is absent from a delivery error', async () => {
    sms.send.mockRejectedValue(new Error('fast2sms: gateway rejected the message'));

    const error = await sendOtp({
      channel: 'mobile',
      identifier: INDIAN,
      code: CODE,
      purpose: 'login',
    }).catch((e) => e);

    expect(String(error.message)).not.toContain(CODE);
    expect(String(error.stack)).not.toContain(CODE);
  });
});

describe('🔴 Fast2SMS OTP API — endpoint and payload, proven against the live gateway', () => {
  // The REAL provider refuses to send unless Fast2SMS is configured, and the
  // live credentials are deliberately NOT in `.env` (rotated out —
  // secrets-and-hygiene), so this block supplies DUMMY values whose only job
  // is to get past `isSmsConfigured()`. 🔴 Never put a real key here: every
  // assertion below is about the URL, headers and payload SHAPE, which a fake
  // key proves just as well. Set on `process.env` + `resetModules` (NOT by
  // mocking `config/env.js`) so the NODE_ENV-toggling tests elsewhere in this
  // file keep re-parsing a live env — mocking the module froze it for them.
  beforeEach(() => {
    process.env.FAST2SMS_API_KEY = 'test-api-key';
    process.env.FAST2SMS_OTP_ID = 'test-otp-id';
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.FAST2SMS_API_KEY;
    delete process.env.FAST2SMS_OTP_ID;
    vi.resetModules();
  });

  it('posts JSON to /dev/otp/send with a bare 10-digit mobile', async () => {
    // Regression guard. The first implementation used `bulkV2` + `route=dlt` and
    // the live gateway answered **"Invalid Sender ID"** — DLT also needs an
    // approved sender id this account does not have. `/dev/otp/send` is a
    // DIFFERENT product that renders the account's approved OTP template and
    // needs no sender id. Verified live 2026-08-04.
    const actual = await vi.importActual('../src/services/sms.provider.js');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ return: true, request_id: 'req_x' }),
    });

    await actual.sendSms({ to: INDIAN, code: CODE });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://www.fast2sms.com/dev/otp/send');
    expect(init.headers['content-type']).toBe('application/json');

    const sent = JSON.parse(init.body);
    expect(sent.mobile).toBe('9876543210'); // bare 10-digit, not E.164
    expect(sent.otp).toBe(CODE);
    expect(sent.otp_id).toBeTruthy();
  });

  it('🔴 derives otp_expiry/otp_length from the SERVER settings', async () => {
    // The whole reason FAST2SMS_OTP_EXPIRY / _LENGTH were refused as env vars:
    // the SMS must never advertise a window the server does not honour.
    const actual = await vi.importActual('../src/services/sms.provider.js');
    const { env } = await import('../src/config/env.js');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ return: true }),
    });

    await actual.sendSms({ to: INDIAN, code: CODE });

    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(sent.otp_length).toBe(env.OTP_LENGTH);
    expect(sent.otp_expiry).toBe(Math.max(1, Math.round(env.OTP_TTL_SECONDS / 60)));
  });

  it('treats `return: false` as a failure even on HTTP 200', async () => {
    // Fast2SMS answers 200 with `return:false` for some rejections; trusting the
    // status alone would report a code as sent that never left.
    const actual = await vi.importActual('../src/services/sms.provider.js');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ return: false, message: 'Invalid OTP ID' }),
    });

    await expect(actual.sendSms({ to: INDIAN, code: CODE })).rejects.toThrow(/rejected/i);
  });

  it('refuses to post an international number as if it were Indian', async () => {
    // The gateway rejects 11-digit numbers with "The mobile must be 10 digits."
    // (confirmed live) — stripping a country code to fit would silently send an
    // international buyer's code nowhere.
    const actual = await vi.importActual('../src/services/sms.provider.js');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(actual.sendSms({ to: INTERNATIONAL, code: CODE })).rejects.toThrow(
      /not an Indian mobile/i,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('message content is derived from server settings', () => {
  it('states the expiry the SERVER enforces, not an independent value', async () => {
    // The whole reason FAST2SMS_OTP_EXPIRY was dropped: the message must never
    // claim a validity window the server does not honour.
    await sendOtp({ channel: 'email', identifier: EMAIL, code: CODE, purpose: 'login' });

    const { env } = await import('../src/config/env.js');
    const expectedMinutes = Math.max(1, Math.round(env.OTP_TTL_SECONDS / 60));
    expect(email.send.mock.calls[0][0].text).toContain(`${expectedMinutes} minute`);
  });

  it('reports transport status without asserting anything', () => {
    expect(describeOtpTransports()).toEqual({
      sms: expect.stringContaining('India'),
      email: 'smtp',
    });
  });
});
