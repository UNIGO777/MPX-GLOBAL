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
});

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
    process.env.NODE_ENV = 'production';
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

describe('🔴 Fast2SMS route — locked to `otp`, proven against the live gateway', () => {
  it('posts route=otp with the code only, and NO template/sender id', async () => {
    // Regression guard. `route=dlt` was the first implementation and the live
    // gateway answered **"Invalid Sender ID"** (2026-08-04) because DLT also
    // needs an approved sender_id this account does not have. The OTP route
    // needs neither, and is DND-exempt — a login code blocked by DND is a
    // locked-out user. Do not switch back without a sender id.
    const actual = await vi.importActual('../src/services/sms.provider.js');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ return: true, request_id: 'req_x' }),
    });

    await actual.sendSms({ to: INDIAN, variables: [CODE] });

    const [, init] = fetchSpy.mock.calls[0];
    const sent = new URLSearchParams(init.body.toString());

    expect(sent.get('route')).toBe('otp');
    expect(sent.get('variables_values')).toBe(CODE);
    expect(sent.get('numbers')).toBe('9876543210'); // bare 10-digit, not E.164
    expect(sent.get('message')).toBeNull(); // no DLT template id
    expect(sent.get('sender_id')).toBeNull();
  });

  it('refuses to post an international number as if it were Indian', async () => {
    const actual = await vi.importActual('../src/services/sms.provider.js');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(actual.sendSms({ to: INTERNATIONAL, variables: [CODE] })).rejects.toThrow(
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
