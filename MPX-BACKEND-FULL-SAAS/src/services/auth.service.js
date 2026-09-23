import { randomBytes } from 'node:crypto';

import { User } from '../models/User.js';
import { Organisation } from '../models/Organisation.js';
import { OtpChallenge } from '../models/OtpChallenge.js';
import { AppError } from '../utils/AppError.js';
import { slugify } from '../utils/slug.js';
import { hashPassword, verifyPassword, verifyDummy } from './password.service.js';
import {
  signAccessToken,
  signLoginToken,
  verifyLoginToken,
  startRefreshFamily,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} from './token.service.js';
import { requestOtp, verifyOtp } from './otp.service.js';
import { verifyTotp } from './twofactor.service.js';
import { recordAudit } from './audit.service.js';
import { notifyPasswordChanged } from './emailNotifications.service.js';
// ONE mask definition, shared with signup — see utils/mask.js.
import { maskEmail, maskMobile } from '../utils/mask.js';
import { logger } from '../utils/logger.js';
import { ERROR_CODES } from '../utils/errorCodes.js';

// --- helpers ------------------------------------------------------------------

// Exported for signup.service.js (A21). The identity rules must have exactly ONE
// implementation — a second copy in the signup path is how buyer/exporter
// coexistence and staff exclusivity drift apart.
export function normalizeMobile({ countryCode, number }) {
  const cc = String(countryCode).replace(/\D/g, '');
  const num = String(number).replace(/\D/g, '');
  return { countryCode: `+${cc}`, number: num, e164: `+${cc}${num}` };
}

// Match by email, exact e164, or an e164 derived from the input's digits (so
// "+919…" and "919…" both work). A bare local number without a country code is
// intentionally NOT matched — ambiguous across countries.
function identifierQuery(identifier) {
  const id = String(identifier).trim();
  const clauses = [{ email: id.toLowerCase() }, { 'mobile.e164': id }];
  const digits = id.replace(/\D/g, '');
  if (digits) clauses.push({ 'mobile.e164': `+${digits}` });
  return { $or: clauses };
}

function mapDuplicate(err) {
  if (err?.code === 11000) {
    return AppError.conflict('duplicate account', 'An account with this email or mobile already exists.');
  }
  return err;
}

const STAFF_ROLES = new Set(['employee', 'superadmin']);
const isStaffRole = (r) => STAFF_ROLES.has(r);

// A21 identity rules (service-layer enforcement; the compound (email|mobile, role)
// unique indexes are the race backstop for same-role duplicates):
//  - buyer + exporter (party roles) MAY share an email/mobile — one of each, never
//    two of the same role;
//  - staff (employee/superadmin) are EXCLUSIVE both ways — a staff identity may not
//    coexist with ANY other account, and an email/mobile already used by a buyer or
//    exporter may not be given to staff.
export async function assertIdentityAvailable({ email, e164, role }) {
  const existing = await User.find({
    $or: [{ email: String(email).trim().toLowerCase() }, { 'mobile.e164': e164 }],
  }).select('role');
  if (existing.length === 0) return;

  const newIsStaff = isStaffRole(role);
  for (const u of existing) {
    // Staff on either side is exclusive — no coexistence at all.
    if (newIsStaff || isStaffRole(u.role)) {
      throw AppError.conflict('identity reserved', 'An account with this email or mobile already exists.');
    }
    // Two party accounts: only a DIFFERENT role may share (buyer + exporter).
    if (u.role === role) {
      throw AppError.conflict('duplicate account', 'An account with this email or mobile already exists.');
    }
  }
}

// The slug pre-validate hook resolves a VISIBLE clash, but two same-name signups
// racing can both pass its check and one insert then loses on the unique index.
// Retry once with a random suffix (an explicitly set slug skips the hook). Any
// other org-level duplicate (e.g. the registrationNumber+country partial index)
// is mapped to a clean conflict instead of leaking a raw Mongo 500.
async function createOrgHandlingDuplicates(org) {
  try {
    return await Organisation.create(org);
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.slug) {
      const base = slugify(org.name) || 'org';
      return Organisation.create({ ...org, slug: `${base}-${randomBytes(2).toString('hex')}` });
    }
    if (err?.code === 11000) {
      throw AppError.conflict('duplicate organisation', 'An organisation with these details already exists.');
    }
    throw err;
  }
}

// Create org then user. No transactions on standalone Mongo, so compensate by
// removing the org if the user insert loses a uniqueness race.
export async function createUserWithOrg({ org, user }) {
  await assertIdentityAvailable({ email: user.email, e164: user.mobile.e164, role: user.role });
  const orgDoc = await createOrgHandlingDuplicates(org);
  try {
    return await User.create({ ...user, orgId: orgDoc._id });
  } catch (err) {
    await Organisation.deleteOne({ _id: orgDoc._id });
    throw mapDuplicate(err);
  }
}

/**
 * A21 step 2 · attach a NEW user to an EXISTING organisation (D7 claim).
 *
 * The counterpart to `createUserWithOrg`: same identity guard, no org insert.
 * `assertIdentityAvailable` still runs — it is what stops a second account of
 * the SAME role joining, so claiming can only ever add the missing side.
 *
 * 🔴 The org is resolved by the CALLER from the pending signup's verified
 * identity. Never pass an org the client named: that is the difference between
 * "join the company that already holds my email" and "join any company".
 */
export async function createUserInOrg({ orgId, user }) {
  await assertIdentityAvailable({ email: user.email, e164: user.mobile.e164, role: user.role });
  try {
    return await User.create({ ...user, orgId });
  } catch (err) {
    // F5 · the unique `(orgId, role)` index lost this race for the seat — the
    // SAME situation as rule 5 discovered late, so it gets the same answer and
    // the client falls through to create. Anything else is an identity clash.
    if (err?.code === 11000 && err?.keyPattern?.orgId) {
      throw AppError.conflict(
        'claim seat taken in race',
        'That company can no longer be joined from this signup. You can continue by setting up your company.',
        ERROR_CODES.CLAIM_SEAT_TAKEN,
      );
    }
    throw mapDuplicate(err);
  }
}


// --- registration -------------------------------------------------------------
//
// 🔴 `registerBuyer` / `registerExporter` were REMOVED (A21 signup verification,
// 2026-08-03). They created the User and the Organisation up front and only then
// sent a single MOBILE otp — so an account existed, and an exporter's profile was
// publicly live, before anyone had proved they owned either address. Because
// `User` is uniquely indexed on `(email, role)` and `(mobile.e164, role)`, that
// let a stranger's email or phone be burned permanently with no proof, locking
// its real owner out of that role for good. Email was never verified at all.
//
// Self-registration now lives in `signup.service.js`: details are held in a
// short-lived `PendingSignup`, BOTH channels are verified with separate codes,
// and `users` / `organisations` are only written at the final step. The helpers
// above (`assertIdentityAvailable`, `createUserWithOrg`, `normalizeMobile`) are
// exported for it so the identity rules keep exactly one implementation.

// Superadmin-created employee: generated-password account, so mustChangePassword
// is set (enforced by authorize until they change it). Writes an audit entry.
export async function createEmployee({ actor, name, email, mobile, password, permissions = [], meta }) {
  const mob = normalizeMobile(mobile);
  // Staff exclusivity (A21): an email/mobile already used by ANY account (buyer,
  // exporter, or other staff) cannot be given an employee.
  await assertIdentityAvailable({ email: email.toLowerCase(), e164: mob.e164, role: 'employee' });

  let created;
  try {
    created = await User.create({
      name,
      email: email.toLowerCase(),
      mobile: mob,
      passwordHash: await hashPassword(password),
      role: 'employee',
      orgId: actor.orgId,
      permissions,
      isActive: true,
      mustChangePassword: true,
      createdBy: actor.userId,
    });
  } catch (err) {
    throw mapDuplicate(err);
  }

  await recordAudit({
    actor: { userId: actor.userId, role: actor.role },
    action: 'employee.create',
    entityType: 'User',
    entityId: created._id,
    orgId: actor.orgId,
    meta,
  });
  return created;
}

// --- login (password → second factor → tokens) --------------------------------

const STAFF_LOGIN_FILTER = { role: { $in: [...STAFF_ROLES] } };

// A21: login is scoped by role. Buyer/exporter come through /auth/login with a
// `portal` (→ role filter); staff come through /auth/staff/login (staff roles
// only). A WRONG portal simply matches no user → the SAME "Invalid credentials"
// as a bad password, so it never reveals the account exists under another portal.
async function loginWithRole({ identifier, password, roleFilter }) {
  const user = await User.findOne({ ...identifierQuery(identifier), ...roleFilter }).select('+passwordHash');

  // Same outcome whether the user is missing (incl. wrong portal) or the password
  // is wrong.
  if (!user) {
    await verifyDummy(password);
    throw AppError.unauthorized('no such user', 'Invalid credentials.');
  }
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok || !user.isActive) throw AppError.unauthorized('bad credentials', 'Invalid credentials.');

  // ON HOLD (docs/Note.md D4): all roles use OTP for now (TOTP deferred).
  // requestOtp enforces a durable lock, so it may throw "too many attempts".
  const method = 'otp';
  await requestOtp({ user, purpose: 'login', channel: 'mobile' });

  // `sentTo` is the MASKED destination the code actually went to. The client
  // used to render whatever identifier the user typed, which was wrong whenever
  // they signed in with an email: the code always goes to the MOBILE
  // (`channel: 'mobile'` on every path), so the screen sent people to their
  // inbox to wait for something that would never arrive.
  //
  // Safe to return here and only here: the password has just been verified, so
  // this is the account holder. `forgot-password` must NOT do this — it would
  // become an account-enumeration oracle.
  return { loginToken: signLoginToken(user, method), method, sentTo: maskMobile(user.mobile.e164) };
}

export function login({ identifier, password, portal }) {
  return loginWithRole({ identifier, password, roleFilter: { role: portal } });
}

export function staffLogin({ identifier, password }) {
  return loginWithRole({ identifier, password, roleFilter: STAFF_LOGIN_FILTER });
}

export async function completeLogin({ loginToken, code, ip, userAgent, requestId }) {
  const { sub, method } = verifyLoginToken(loginToken);
  const user = await User.findOne({ _id: sub, isActive: true }).select('+twoFactorSecret');
  if (!user) throw AppError.unauthorized('user gone', 'Invalid credentials.');
  let otpChannel = null;

  if (method === 'totp') {
    if (!(await verifyTotp(user.twoFactorSecret, code))) {
      throw AppError.unauthorized('totp failed', 'Invalid code.');
    }
  } else {
    await verifyOtp({ userId: user._id, purpose: 'login', code });
    // Which channel carried it — the challenge just consumed. An email-channel
    // sign-in is the one worth being able to find later.
    const used = await OtpChallenge.findOne({ userId: user._id, purpose: 'login', consumedAt: { $ne: null } })
      .sort({ consumedAt: -1 })
      .select('channel')
      .lean();
    otpChannel = used?.channel ?? null;
  }

  const accessToken = signAccessToken(user);
  const { raw } = await startRefreshFamily({ userId: user._id, ip, userAgent });
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  await recordAudit({
    actor: { userId: user._id, role: user.role },
    action: 'auth.login',
    entityType: 'User',
    entityId: user._id,
    orgId: user.orgId,
    // Which channel carried the second factor — an email-channel sign-in is the
    // one worth being able to find later (2026-09-23 "no phone to hand").
    after: { method, otpChannel },
    meta: { ip, userAgent, requestId },
  });

  return { accessToken, refreshToken: raw, user };
}

// --- refresh / logout ---------------------------------------------------------

export async function refresh({ refreshToken, ip, userAgent, requestId }) {
  // rotateRefreshToken validates the user is active before issuing a new token,
  // and audits a reuse/theft event.
  const { user, raw } = await rotateRefreshToken({ presentedRaw: refreshToken, ip, userAgent, requestId });
  return { accessToken: signAccessToken(user), refreshToken: raw };
}

export async function logout({ refreshToken }) {
  if (refreshToken) await revokeRefreshToken(refreshToken);
}

/**
 * 2026-09-23 (owner) · a buyer or seller who does not have their phone to hand
 * can take the code by EMAIL instead. Staff stay phone-only: the superadmin's
 * second factor is already weaker than planned (TOTP moved to month 2, D4), and
 * this must not weaken it further.
 *
 * 🔴 `channel` picks one of the account's OWN stored addresses — it is never an
 * address (A3). Switching replaces the live challenge (one per subject+purpose),
 * so the phone code stops working; the A3 lock is checked before that, so a
 * switch never resets it.
 */
function assertChannelAllowed(user, channel) {
  if (channel === 'email' && isStaffRole(user.role)) {
    throw AppError.badRequest('email otp not for staff', 'Codes for staff accounts are sent to your phone.');
  }
}

// Resend the login OTP using only the login-pending token (no password re-entry).
// requestOtp still enforces the durable lock, so this can throw "too many attempts".
export async function resendLoginOtp({ loginToken, channel = 'mobile' }) {
  const { sub } = verifyLoginToken(loginToken);
  const user = await User.findOne({ _id: sub, isActive: true });
  if (!user) throw AppError.unauthorized('user gone', 'Login session expired. Please sign in again.');
  assertChannelAllowed(user, channel);
  await requestOtp({ user, purpose: 'login', channel });
  // Masked destination — safe here for the same reason as at login: the
  // password was verified to obtain this token.
  return { sentTo: channel === 'email' ? maskEmail(user.email) : maskMobile(user.mobile.e164) };
}

// --- change / forgot / reset password -----------------------------------------

// Authenticated password change (also clears mustChangePassword). Bumps
// tokenVersion + revokes refresh tokens (kills old sessions), then issues a fresh
// session so the caller stays logged in.
export async function changePassword({ userId, currentPassword, newPassword, ip, userAgent, requestId }) {
  const user = await User.findOne({ _id: userId, isActive: true }).select('+passwordHash');
  if (!user) throw AppError.unauthorized('user gone', 'Not authenticated.');
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw AppError.unauthorized('bad current password', 'Current password is incorrect.');
  }

  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(newPassword), mustChangePassword: false }, $inc: { tokenVersion: 1 } },
  );
  await revokeAllUserTokens(user._id);

  const fresh = await User.findOne({ _id: user._id });
  const accessToken = signAccessToken(fresh);
  const { raw } = await startRefreshFamily({ userId: fresh._id, ip, userAgent });
  await recordAudit({
    actor: { userId: fresh._id, role: fresh.role },
    action: 'auth.password_change',
    entityType: 'User',
    entityId: fresh._id,
    orgId: fresh.orgId,
    meta: { ip, userAgent, requestId },
  });

  // Security notice (D5 email carve-out, owner 2026-08-04). Fire-and-forget: the
  // password is already changed and the sessions already revoked, so a mail
  // failure must not turn a successful change into an error the user retries.
  notifyPasswordChanged({ user: fresh });

  return { accessToken, refreshToken: raw };
}

// Generic; never reveal whether an account exists; only active accounts get an OTP.
// Role-scoped like login (A21): a wrong portal finds no user → still generic.
//
// 🔴 FIXED 2026-09-23 — the identical response message was NOT enough. This
// awaited `requestOtp`, which THROWS in two reachable states, while an unknown
// identifier never reaches it and so can never throw:
//
//   real account, OTP-locked  → 401 OTP_LOCKED   |  unknown → 200
//   real account, no transport → 500             |  unknown → 200
//
// Either one is an account-enumeration oracle an unauthenticated caller can read,
// and the first is self-inflicted: five wrong codes on the reset form locks the
// challenge (A3). So the OTP is now dispatched inside a catch — the caller's
// response is identical in EVERY state, not just the happy one.
//
// 🔴 Swallowed for the RESPONSE only, never for the operator: the failure is
// logged at error level (`secrets-and-hygiene.md` — channel and purpose only, no
// identifier, no code). A silent catch here would hide a dead SMTP/SMS config
// behind a reset screen that looks like it worked, which is the failure mode
// `otp.sender.js` throws to expose.
//
// `channel: 'email'` (2026-09-23, buyer/seller portals only — the staff route's
// schema has no channel) sends the reset code to the account's OWN email. Owner
// accepted the trade-off: control of that inbox alone can now reset a password.
async function forgotWithRole({ identifier, roleFilter, channel = 'mobile' }) {
  const user = await User.findOne({ ...identifierQuery(identifier), ...roleFilter, isActive: true });
  if (!user) return;

  try {
    await requestOtp({ user, purpose: 'forgot_password', channel });
  } catch (err) {
    logger.error(
      { purpose: 'forgot_password', code: err?.code ?? null, err: err?.message },
      'forgot-password: otp not issued — response stays generic',
    );
  }
}

export function forgotPassword({ identifier, portal, channel }) {
  return forgotWithRole({ identifier, roleFilter: { role: portal }, channel });
}

export function staffForgotPassword({ identifier }) {
  return forgotWithRole({ identifier, roleFilter: STAFF_LOGIN_FILTER });
}

async function resetWithRole({ identifier, code, newPassword, roleFilter, ip, userAgent, requestId }) {
  const user = await User.findOne({ ...identifierQuery(identifier), ...roleFilter, isActive: true });
  if (!user) throw AppError.unauthorized('no user', 'Invalid or expired code.');

  await verifyOtp({ userId: user._id, purpose: 'forgot_password', code });

  // Password change → bump tokenVersion (kills access tokens) and revoke every
  // refresh token (auth-sessions A7).
  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(newPassword), mustChangePassword: false }, $inc: { tokenVersion: 1 } },
  );
  await revokeAllUserTokens(user._id);
  await recordAudit({
    actor: { userId: user._id, role: user.role },
    action: 'auth.password_reset',
    entityType: 'User',
    entityId: user._id,
    orgId: user.orgId,
    meta: { ip, userAgent, requestId },
  });

  // Security notice (D5 email carve-out, owner 2026-08-04). This is the mail
  // that tells a victim someone else reset their password, so it goes out on the
  // reset path too — not just the authenticated change path. Fire-and-forget.
  notifyPasswordChanged({ user });
}

export function resetPassword({ identifier, code, newPassword, portal, ip, userAgent, requestId }) {
  return resetWithRole({ identifier, code, newPassword, roleFilter: { role: portal }, ip, userAgent, requestId });
}

export function staffResetPassword({ identifier, code, newPassword, ip, userAgent, requestId }) {
  return resetWithRole({ identifier, code, newPassword, roleFilter: STAFF_LOGIN_FILTER, ip, userAgent, requestId });
}
