import * as signupService from '../services/signup.service.js';
import { isWebClient, refreshTokenForBody, setRefreshCookie } from '../utils/refreshCookie.js';

// A21 · two-step signup. Step 1 and the two verify calls return ONLY progress —
// never a session, never a user record, because at that point no account exists.
// `complete` is the first response that carries tokens.

function clientMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

// Same curated view the login path returns. Deliberately omits tokenVersion and
// the verification flags — the client has no use for them.
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

export async function start(req, res) {
  const result = await signupService.startSignup({
    ...req.validated.body,
    meta: clientMeta(req),
  });
  res.status(201).json(result);
}

export async function verify(req, res) {
  const state = await signupService.verifySignupChannel(req.validated.body);
  res.json(state);
}

export async function resend(req, res) {
  const state = await signupService.resendSignupOtp(req.validated.body);
  res.json({ message: 'A new code has been sent.', ...state });
}

export async function complete(req, res) {
  const result = await signupService.completeSignup({
    ...req.validated.body,
    meta: clientMeta(req),
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  // Signup ends in a real session, so it gets the same treatment as verify-otp:
  // cookie for a browser (and no body token), body token for native (A2).
  if (isWebClient(req)) setRefreshCookie(res, result.refreshToken);
  res.status(201).json({
    accessToken: result.accessToken,
    ...refreshTokenForBody(req, result.refreshToken),
    user: authUserView(result.user),
  });
}
