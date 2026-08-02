import crypto, { randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { User } from '../models/User.js';
import { recordAudit } from './audit.service.js';

const ACCESS_TYP = 'access';
const LOGIN_PENDING_TYP = 'login_pending';
const SIGNUP_PENDING_TYP = 'signup_pending';

// A21 signup. Long enough to read an email, read an SMS and fill the company
// step; short enough that an abandoned signup does not leave a usable handle
// lying around. Kept equal to the PendingSignup TTL so the token and the record
// it names can never outlive one another.
export const SIGNUP_TOKEN_TTL_SECONDS = 60 * 60;

// --- Access token (stateless JWT, 15 min) -------------------------------------

export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), tv: user.tokenVersion, typ: ACCESS_TYP },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL },
  );
}

export function verifyAccessToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw AppError.unauthorized('invalid access token', 'Not authenticated.');
  }
  if (payload.typ !== ACCESS_TYP) throw AppError.unauthorized('wrong token type', 'Not authenticated.');
  return payload;
}

// --- Login-pending token: proof the password step passed, names the 2nd factor.
// It is NOT a session and can access nothing.

export function signLoginToken(user, method) {
  return jwt.sign({ sub: String(user._id), typ: LOGIN_PENDING_TYP, method }, env.JWT_ACCESS_SECRET, {
    expiresIn: '5m',
  });
}

export function verifyLoginToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw AppError.unauthorized('invalid login token', 'Login session expired. Please sign in again.');
  }
  if (payload.typ !== LOGIN_PENDING_TYP) throw AppError.unauthorized('wrong token type', 'Not authenticated.');
  return payload;
}

// --- Signup-pending token: names an A21 PendingSignup while its two codes are
// being proved. It is NOT a session, has no user behind it yet, and can access
// nothing but the signup endpoints for that one pending record.

export function signSignupToken(pendingSignup) {
  return jwt.sign(
    { sub: String(pendingSignup._id), typ: SIGNUP_PENDING_TYP },
    env.JWT_ACCESS_SECRET,
    { expiresIn: SIGNUP_TOKEN_TTL_SECONDS },
  );
}

export function verifySignupToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw AppError.unauthorized('invalid signup token', 'Signup session expired. Please start again.');
  }
  // Without this the type check would let an access or login token be presented
  // here — they are signed with the same secret.
  if (payload.typ !== SIGNUP_PENDING_TYP) {
    throw AppError.unauthorized('wrong token type', 'Signup session expired. Please start again.');
  }
  return payload;
}

// --- Refresh tokens (opaque, hashed, rotating) --------------------------------

function hashRefresh(raw) {
  return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(raw).digest('hex');
}

function newRawToken() {
  return crypto.randomBytes(32).toString('base64url');
}

async function issue({ userId, familyId, expiresAt, ip, userAgent }) {
  const raw = newRawToken();
  const doc = await RefreshToken.create({
    userId,
    familyId,
    tokenHash: hashRefresh(raw),
    status: 'active',
    expiresAt,
    ip,
    userAgent,
  });
  return { raw, doc };
}

// Fresh login → a new family with an absolute 7-day lifetime.
export function startRefreshFamily({ userId, ip, userAgent }) {
  const familyId = randomUUID();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  return issue({ userId, familyId, expiresAt, ip, userAgent });
}

export async function revokeFamily(familyId) {
  await RefreshToken.updateMany(
    { familyId, status: { $ne: 'revoked' } },
    { $set: { status: 'revoked', revokedAt: new Date() } },
  );
}

// Kill every refresh token for a user (e.g. on password reset, alongside a
// tokenVersion bump that invalidates access tokens).
export async function revokeAllUserTokens(userId) {
  await RefreshToken.updateMany(
    { userId, status: { $ne: 'revoked' } },
    { $set: { status: 'revoked', revokedAt: new Date() } },
  );
}

// Rotate on use. Reuse of a non-active token = theft → revoke the whole family.
export async function rotateRefreshToken({ presentedRaw, ip, userAgent, requestId }) {
  const current = await RefreshToken.findOne({ tokenHash: hashRefresh(presentedRaw) });
  if (!current) throw AppError.unauthorized('unknown refresh token', 'Session invalid. Please sign in again.');

  if (current.status !== 'active') {
    // Reuse of a rotated/revoked token = theft. Revoke the family and record it.
    await revokeFamily(current.familyId);
    await recordAudit({
      actor: { userId: current.userId },
      action: 'auth.refresh.reuse',
      entityType: 'User',
      entityId: current.userId,
      meta: { ip, userAgent, requestId },
    });
    throw AppError.unauthorized('refresh token reuse', 'Session invalid. Please sign in again.');
  }
  if (current.expiresAt.getTime() <= Date.now()) {
    throw AppError.unauthorized('refresh token expired', 'Session expired. Please sign in again.');
  }

  // Validate the user is still active BEFORE issuing a new token — otherwise a
  // deactivated/deleted user would leave an orphan live token. If they're gone,
  // revoke the whole family.
  const user = await User.findOne({ _id: current.userId, isActive: true });
  if (!user) {
    await revokeFamily(current.familyId);
    throw AppError.unauthorized('user gone/inactive', 'Session invalid. Please sign in again.');
  }

  // Absolute family lifetime — inherit the original expiry, do not extend.
  const { raw, doc } = await issue({
    userId: current.userId,
    familyId: current.familyId,
    expiresAt: current.expiresAt,
    ip,
    userAgent,
  });
  current.status = 'rotated';
  current.rotatedAt = new Date();
  current.replacedByTokenId = doc._id;
  await current.save();

  return { user, raw };
}

export async function revokeRefreshToken(presentedRaw) {
  await RefreshToken.updateMany(
    { tokenHash: hashRefresh(presentedRaw), status: 'active' },
    { $set: { status: 'revoked', revokedAt: new Date() } },
  );
}
