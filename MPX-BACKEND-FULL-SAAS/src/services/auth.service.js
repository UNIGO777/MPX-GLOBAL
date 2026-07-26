import { User } from '../models/User.js';
import { Organisation } from '../models/Organisation.js';
import { AppError } from '../utils/AppError.js';
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

// --- helpers ------------------------------------------------------------------

function normalizeMobile({ countryCode, number }) {
  const cc = String(countryCode).replace(/\D/g, '');
  const num = String(number).replace(/\D/g, '');
  return { countryCode: `+${cc}`, number: num, e164: `+${cc}${num}` };
}

function identifierQuery(identifier) {
  const id = String(identifier).trim();
  return { $or: [{ email: id.toLowerCase() }, { 'mobile.e164': id }] };
}

function mapDuplicate(err) {
  if (err?.code === 11000) {
    return AppError.conflict('duplicate account', 'An account with this email or mobile already exists.');
  }
  return err;
}

async function assertUnique({ email, e164 }) {
  const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { 'mobile.e164': e164 }] });
  if (existing) {
    throw AppError.conflict('duplicate account', 'An account with this email or mobile already exists.');
  }
}

// Create org then user. No transactions on standalone Mongo, so compensate by
// removing the org if the user insert loses a uniqueness race.
async function createUserWithOrg({ org, user }) {
  await assertUnique({ email: user.email, e164: user.mobile.e164 });
  const orgDoc = await Organisation.create(org);
  try {
    return await User.create({ ...user, orgId: orgDoc._id });
  } catch (err) {
    await Organisation.deleteOne({ _id: orgDoc._id });
    throw mapDuplicate(err);
  }
}

// --- registration -------------------------------------------------------------

// Phase 1: buyer is active immediately; kycStatus/approval is status only, not a
// gate (see docs/Note.md). No employee-approval gate here.
export async function registerBuyer({ name, email, mobile, password, company, country }) {
  const mob = normalizeMobile(mobile);
  return createUserWithOrg({
    org: { name: company, type: 'buyer', country, kycStatus: 'pending' },
    user: {
      name,
      email: email.toLowerCase(),
      mobile: mob,
      passwordHash: await hashPassword(password),
      role: 'buyer',
      isActive: true,
      mustChangePassword: false,
    },
  });
}

// Phase 1: exporter self-registers; profile is public immediately with
// kycStatus 'pending'. Verification is NOT a gate — do not hide the profile.
export async function registerExporter({ name, email, mobile, password, company, country, businessProfile }) {
  const mob = normalizeMobile(mobile);
  return createUserWithOrg({
    org: { name: company, type: 'exporter', country, kycStatus: 'pending', businessProfile },
    user: {
      name,
      email: email.toLowerCase(),
      mobile: mob,
      passwordHash: await hashPassword(password),
      role: 'exporter',
      isActive: true,
      mustChangePassword: false,
    },
  });
}

// Admin-created employee: joins the admin's (platform) org. Generated-password
// account, so mustChangePassword is set (decision #5, staff only).
export async function createEmployee({ actor, name, email, mobile, password, permissions = [] }) {
  const mob = normalizeMobile(mobile);
  await assertUnique({ email: email.toLowerCase(), e164: mob.e164 });
  try {
    return await User.create({
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
}

// --- login (password → second factor → tokens) --------------------------------

export async function login({ identifier, password }) {
  const user = await User.findOne(identifierQuery(identifier)).select('+passwordHash');

  // Same outcome whether the user is missing or the password is wrong.
  if (!user) {
    await verifyDummy(password);
    throw AppError.unauthorized('no such user', 'Invalid credentials.');
  }
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok || !user.isActive) throw AppError.unauthorized('bad credentials', 'Invalid credentials.');

  // ON HOLD (docs/Note.md D4): admin/superadmin TOTP enrollment is deferred, so
  // ALL roles use OTP login for now. Restore TOTP-for-staff before project close
  // (auth-sessions A4). completeLogin still handles the 'totp' method for then.
  const method = 'otp';
  await requestOtp({ user, purpose: 'login', channel: 'mobile' });
  return { loginToken: signLoginToken(user, method), method };
}

export async function completeLogin({ loginToken, code, ip, userAgent }) {
  const { sub, method } = verifyLoginToken(loginToken);
  const user = await User.findOne({ _id: sub, isActive: true }).select('+twoFactorSecret');
  if (!user) throw AppError.unauthorized('user gone', 'Invalid credentials.');

  if (method === 'totp') {
    if (!(await verifyTotp(user.twoFactorSecret, code))) {
      throw AppError.unauthorized('totp failed', 'Invalid code.');
    }
  } else {
    await verifyOtp({ userId: user._id, purpose: 'login', code });
  }

  const accessToken = signAccessToken(user);
  const { raw } = await startRefreshFamily({ userId: user._id, ip, userAgent });
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

  return { accessToken, refreshToken: raw, user };
}

// --- refresh / logout ---------------------------------------------------------

export async function refresh({ refreshToken, ip, userAgent }) {
  const { userId, raw } = await rotateRefreshToken({ presentedRaw: refreshToken, ip, userAgent });
  const user = await User.findOne({ _id: userId, isActive: true });
  if (!user) throw AppError.unauthorized('user gone', 'Session invalid. Please sign in again.');
  return { accessToken: signAccessToken(user), refreshToken: raw };
}

export async function logout({ refreshToken }) {
  if (refreshToken) await revokeRefreshToken(refreshToken);
}

// --- forgot / reset password --------------------------------------------------

// Always generic: never reveal whether an account exists.
export async function forgotPassword({ identifier }) {
  const user = await User.findOne(identifierQuery(identifier));
  if (user) await requestOtp({ user, purpose: 'forgot_password', channel: 'mobile' });
}

export async function resetPassword({ identifier, code, newPassword }) {
  const user = await User.findOne(identifierQuery(identifier));
  if (!user) throw AppError.unauthorized('no user', 'Invalid or expired code.');

  await verifyOtp({ userId: user._id, purpose: 'forgot_password', code });

  // Password change → bump tokenVersion (kills access tokens) and revoke every
  // refresh token (auth-sessions A7).
  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(newPassword), mustChangePassword: false }, $inc: { tokenVersion: 1 } },
  );
  await revokeAllUserTokens(user._id);
}
