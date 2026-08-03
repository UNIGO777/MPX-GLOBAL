import request from 'supertest';

/**
 * Drive the real A21 signup: start → verify email → verify mobile → complete.
 *
 * Every suite used to call `/auth/buyer/signup` and get an account in one shot.
 * That endpoint is gone, because it created the account before anyone proved they
 * owned the email or the phone. Fixtures go through the real flow instead of a
 * shortcut, so the tests keep exercising the path production actually uses.
 *
 * `otpBox` is the per-file capture map from that suite's `otp.sender.js` mock —
 * passed in rather than imported, because each test file hoists its own.
 *
 * Returns the `complete` response, whose body is
 * `{ accessToken, refreshToken, user }` — the same shape `/auth/verify-otp`
 * returned before, so call sites mostly do not change.
 */
export async function signupThroughOtp(
  app,
  otpBox,
  { name, email, mobile, password, role, company, country, entityType, address },
  // Optional request headers (e.g. the web client's X-Client/Origin pair, which
  // decides cookie vs body refresh token). Defaults to none = a native client.
  headers = {},
) {
  const started = await request(app)
    .post('/auth/signup/start')
    .set(headers)
    .send({ name, email, mobile, password, role });

  const signupToken = started.body.signupToken;
  if (!signupToken) return started; // surface the failure to the caller as-is

  // Same normalisation the server applies, so the captured identifiers match.
  const digits = (v) => String(v).replace(/\D/g, '');
  const e164 = `+${digits(mobile.countryCode)}${digits(mobile.number)}`;

  await request(app).post('/auth/signup/verify').send({
    signupToken,
    channel: 'email',
    code: otpBox.byId.get(String(email).toLowerCase()),
  });
  await request(app).post('/auth/signup/verify').send({
    signupToken,
    channel: 'mobile',
    code: otpBox.byId.get(e164),
  });

  return request(app)
    .post('/auth/signup/complete')
    .set(headers)
    .send({ signupToken, company, country, entityType, address });
}
