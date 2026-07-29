import * as authService from '../services/auth.service.js';

// Async handlers: Express 5 forwards a rejected promise to the central error
// handler, so no try/catch wrapper is needed here.

function clientMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

export async function buyerSignup(req, res) {
  const user = await authService.registerBuyer({ ...req.body, meta: clientMeta(req) });
  res.status(201).json({ user }); // toJSON strips passwordHash / 2FA fields
}

export async function exporterSignup(req, res) {
  const user = await authService.registerExporter({ ...req.body, meta: clientMeta(req) });
  res.status(201).json({ user });
}

export async function createEmployee(req, res) {
  const user = await authService.createEmployee({ actor: req.user, ...req.body, meta: clientMeta(req) });
  res.status(201).json({ user });
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
  res.json({ accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user });
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
