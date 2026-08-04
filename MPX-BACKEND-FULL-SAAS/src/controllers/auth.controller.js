import * as authService from '../services/auth.service.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { ERROR_CODES } from '../utils/errorCodes.js';
import {
  clearRefreshCookie,
  isWebClient,
  requireWebClientForCookie,
  readRefreshToken,
  refreshTokenForBody,
  setRefreshCookie,
} from '../utils/refreshCookie.js';

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

// Self-registration moved to `signup.controller.js` (A21, 2026-08-03): signup is
// now two steps with BOTH the email and the mobile verified before any account
// exists. The old single-call handlers were removed rather than deprecated —
// see the note in auth.service.js for why leaving them mounted was not an option.

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
  // Browser → the refresh token goes ONLY into the httpOnly cookie and is
  // omitted from the body, so no script on the page can ever read it (A2).
  // Native clients still receive it in the body — see refreshTokenForBody.
  if (isWebClient(req)) setRefreshCookie(res, result.refreshToken);
  res.json({
    accessToken: result.accessToken,
    ...refreshTokenForBody(req, result.refreshToken),
    user: authUserView(result.user),
  });
}

export async function resendOtp(req, res) {
  await authService.resendLoginOtp(req.body);
  res.json({ message: 'A new OTP has been sent.' });
}

export async function refresh(req, res) {
  // 🔴 CSRF. SameSite=None means a cross-site page can make the browser attach
  // this cookie, so a cookie-borne call must prove it came from our own app.
  // Body-token callers (the Expo app) are untouched — they carry no cookie.
  if (!requireWebClientForCookie(req)) {
    throw AppError.forbidden('cookie call without web-client header', 'Not allowed.');
  }

  // Cookie first, body second. A browser sends the cookie automatically; native
  // clients keep sending the body token.
  const refreshToken = readRefreshToken(req);
  if (!refreshToken) {
    throw AppError.unauthorized(
      'no refresh token presented',
      'Session expired. Please sign in again.',
      ERROR_CODES.REFRESH_TOKEN_MISSING,
    );
  }
  const tokens = await authService.refresh({ refreshToken, ...clientMeta(req) });
  // Rotation issues a NEW refresh token — the cookie must be replaced or the
  // next refresh presents a rotated-away token and reads as theft (A7).
  if (isWebClient(req)) setRefreshCookie(res, tokens.refreshToken);
  res.json({ accessToken: tokens.accessToken, ...refreshTokenForBody(req, tokens.refreshToken) });
}

export async function logout(req, res) {
  // Guard BEFORE clearing: a cross-site page must not be able to force a
  // logout now that SameSite=None lets the cookie ride along. A call that
  // fails this check is not our app, so it has nothing to clear.
  if (!requireWebClientForCookie(req)) {
    throw AppError.forbidden('cookie call without web-client header', 'Not allowed.');
  }
  const refreshToken = readRefreshToken(req);
  // Clear the cookie FIRST and unconditionally — the header survives even if the
  // call then errors, so a logout never leaves a live cookie behind.
  clearRefreshCookie(res);
  // Presenting neither cookie nor body token stays a 400, exactly as when the
  // validator required it: this is a malformed call, not an anonymous one.
  if (!refreshToken) {
    throw AppError.badRequest(
      'no refresh token presented',
      'Invalid request.',
      ERROR_CODES.REFRESH_TOKEN_MISSING,
    );
  }
  await authService.logout({ refreshToken });
  res.json({ ok: true });
}

/**
 * Server-authoritative identity of the caller.
 *
 * Returns the SAME curated shape as verify-otp, on purpose. `authenticate` keeps
 * `req.user` deliberately lean (ids, role, permissions) because every route and
 * every audit row uses it — so identity is read here, on this one endpoint.
 *
 * A2: this is what makes a reload survivable. After a silent refresh there is no
 * verify-otp response to merge, so /auth/me is the ONLY source of the user's
 * name; without it a restored session renders a blank header.
 */
export async function me(req, res) {
  // `findOne({ _id })`, not `findById` — the A6 lint rule bans the latter
  // outright and this file has to pass it. The id is the caller's OWN, taken
  // from the verified token, so there is no tenant question here; the rule is
  // absolute precisely so nobody has to make that judgement call per call site.
  const user = await User.findOne({ _id: req.user.userId }).select(
    'name email mobile role orgId isActive mustChangePassword',
  );
  if (!user) throw AppError.unauthorized('user not found', 'Not authenticated.');
  res.json({ user: { ...authUserView(user), permissions: req.user.permissions ?? [] } });
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
  // A password change revokes every session and issues a fresh pair — the
  // cookie must follow, or the browser keeps a token that was just revoked.
  if (isWebClient(req)) setRefreshCookie(res, tokens.refreshToken);
  res.json({ accessToken: tokens.accessToken, ...refreshTokenForBody(req, tokens.refreshToken) });
}
