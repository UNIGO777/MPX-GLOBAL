import * as authService from '../services/auth.service.js';

// Async handlers: Express 5 forwards a rejected promise to the central error
// handler, so no try/catch wrapper is needed here.

function clientMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

// Curated self view for auth responses (signup / verify-otp). The document's
// toJSON DOES strip select:false paths, but it still carries internal fields the
// client has no use for (tokenVersion, verification flags, timestamps) — return
// only what the frontend actually renders. Same shape as /auth/me plus identity
// basics. (API contract logged in docs/UiWebNotes.md.)
function authUserView(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    mobile: user.mobile?.e164 ?? null,
    role: user.role,
    orgId: user.orgId ? String(user.orgId) : null,
    isActive: user.isActive,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

// A21 §4a: signup issues an OTP and returns a login-pending token — NOT a session.
// A curated `user` view is returned for convenience; access/refresh tokens are
// only issued after /auth/verify-otp succeeds.
function signupResponse(res, { user, loginToken, method }) {
  res.status(201).json({
    user: authUserView(user),
    loginToken,
    method,
    message: 'An OTP has been sent. Verify it to activate your session.',
  });
}

export async function buyerSignup(req, res) {
  signupResponse(res, await authService.registerBuyer({ ...req.body, meta: clientMeta(req) }));
}

export async function exporterSignup(req, res) {
  signupResponse(res, await authService.registerExporter({ ...req.body, meta: clientMeta(req) }));
}

export async function createEmployee(req, res) {
  const user = await authService.createEmployee({ actor: req.user, ...req.body, meta: clientMeta(req) });
  // Curated, not the raw document. `toJSON` only strips `select:false` paths, so
  // returning the doc shipped tokenVersion/createdBy/verification flags and would
  // ship any field added to the model later — the "never return a full user
  // document" case in the api-endpoints rule. `permissions` is included on
  // purpose (the superadmin just set them), matching PATCH .../permissions.
  res.status(201).json({ user: { ...authUserView(user), permissions: user.permissions ?? [] } });
}

function loginResponse(res, { loginToken, method }) {
  res.json({
    loginToken,
    method,
    message: method === 'otp' ? 'An OTP has been sent.' : 'Enter your authenticator code.',
  });
}

export async function login(req, res) {
  loginResponse(res, await authService.login(req.body));
}

// A21: staff portal (employee/superadmin) — no `portal` field.
export async function staffLogin(req, res) {
  loginResponse(res, await authService.staffLogin(req.body));
}

export async function verifyOtp(req, res) {
  const result = await authService.completeLogin({ ...req.body, ...clientMeta(req) });
  res.json({ accessToken: result.accessToken, refreshToken: result.refreshToken, user: authUserView(result.user) });
}

export async function resendOtp(req, res) {
  await authService.resendLoginOtp(req.body);
  res.json({ message: 'A new OTP has been sent.' });
}

export async function refresh(req, res) {
  const tokens = await authService.refresh({ ...req.body, ...clientMeta(req) });
  res.json(tokens);
}

export async function logout(req, res) {
  await authService.logout(req.body);
  res.json({ ok: true });
}

// Server-authoritative identity of the caller (from authenticate, DB-sourced).
export function me(req, res) {
  res.json({ user: req.user });
}

export async function forgotPassword(req, res) {
  await authService.forgotPassword(req.body);
  res.json({ message: 'If an account exists, a reset code has been sent.' });
}

export async function staffForgotPassword(req, res) {
  await authService.staffForgotPassword(req.body);
  res.json({ message: 'If an account exists, a reset code has been sent.' });
}

export async function resetPassword(req, res) {
  await authService.resetPassword({ ...req.body, ...clientMeta(req) });
  res.json({ ok: true });
}

export async function staffResetPassword(req, res) {
  await authService.staffResetPassword({ ...req.body, ...clientMeta(req) });
  res.json({ ok: true });
}

export async function changePassword(req, res) {
  const tokens = await authService.changePassword({ userId: req.user.userId, ...req.body, ...clientMeta(req) });
  res.json(tokens);
}
