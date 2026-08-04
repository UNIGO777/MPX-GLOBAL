import { PendingSignup } from '../models/PendingSignup.js';
import { OtpChallenge } from '../models/OtpChallenge.js';
import { AppError } from '../utils/AppError.js';
import { ERROR_CODES } from '../utils/errorCodes.js';
import { hashPassword } from './password.service.js';
import { requestOtp, verifyOtp } from './otp.service.js';
import {
  signSignupToken,
  verifySignupToken,
  signAccessToken,
  startRefreshFamily,
  SIGNUP_TOKEN_TTL_SECONDS,
} from './token.service.js';
import { recordAudit } from './audit.service.js';
import { assertIdentityAvailable, createUserWithOrg, normalizeMobile } from './auth.service.js';
import { notifyWelcome } from './emailNotifications.service.js';

/**
 * A21 · signup, with BOTH the email and the mobile proved before an account
 * exists.
 *
 * What this replaces and why: the previous `/auth/buyer/signup` wrote the `User`
 * **and** the `Organisation` immediately and only then sent a single mobile OTP —
 * so an account existed, and was public in the exporter's case, before anyone had
 * proved they owned either address. Worse, `User` is uniquely indexed on
 * `(email, role)` and `(mobile.e164, role)`, so a stranger's address could be
 * permanently burned with no proof at all and its real owner locked out forever.
 *
 * Nothing here touches `users` or `organisations` until `completeSignup`.
 */

const CHANNEL_PURPOSE = Object.freeze({
  email: 'signup_email',
  mobile: 'signup_mobile',
});

/**
 * Show enough for the screen to say "we sent it to …" without reprinting the
 * whole address. The caller typed these values a moment ago, so this is a
 * shoulder-surfing courtesy rather than a secrecy boundary.
 */
function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  const head = local.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

function maskMobile(e164) {
  const s = String(e164);
  return `${s.slice(0, 3)}${'*'.repeat(Math.max(s.length - 5, 1))}${s.slice(-2)}`;
}

function stateOf(pending) {
  return {
    emailVerified: Boolean(pending.emailVerifiedAt),
    mobileVerified: Boolean(pending.mobileVerifiedAt),
    complete: pending.isFullyVerified(),
  };
}

/** Resolve the token to its record. A missing record is an expired signup. */
async function loadPending(signupToken) {
  const { sub } = verifySignupToken(signupToken);
  const pending = await PendingSignup.findOne({ _id: sub });
  if (!pending) {
    // The TTL removed it, or it was completed. Same message either way — this
    // must not become an oracle for "did that signup finish".
    throw AppError.unauthorized('pending signup gone', 'Signup session expired. Please start again.', ERROR_CODES.SIGNUP_SESSION_EXPIRED);
  }
  return pending;
}

/**
 * Step 1 — hold the details, send BOTH codes. Creates no account.
 *
 * Deliberately NOT unique per (email, role): two people may hold pending signups
 * for the same address at once and neither is harmed, because neither gets
 * anything without controlling both channels. Enforcing uniqueness here would
 * re-open a milder squat — start a signup, block the real owner for an hour.
 */
export async function startSignup({ name, email, mobile, password, role, meta }) {
  const mob = normalizeMobile(mobile);
  const normalisedEmail = String(email).trim().toLowerCase();

  // Checked up front so the caller is not asked for two codes before being told
  // the address is taken. This does reveal that an account exists — but that is
  // the behaviour signup already had (`assertIdentityAvailable` threw the same
  // conflict), so it is preserved rather than newly introduced. The pending
  // collection itself must never become a SECOND oracle, which is why nothing
  // below distinguishes "no pending record" from "wrong token".
  await assertIdentityAvailable({ email: normalisedEmail, e164: mob.e164, role });

  const pending = await PendingSignup.create({
    name,
    email: normalisedEmail,
    mobile: mob,
    // Hashed now so the plaintext never has to survive the OTP round trip.
    passwordHash: await hashPassword(password),
    role,
    expiresAt: new Date(Date.now() + SIGNUP_TOKEN_TTL_SECONDS * 1000),
  });

  // Two independent challenges under two different purposes — see OTP_PURPOSE in
  // models/enums.js for why a shared purpose would make them cancel each other.
  await requestOtp({ pendingSignup: pending, purpose: CHANNEL_PURPOSE.email, channel: 'email' });
  await requestOtp({ pendingSignup: pending, purpose: CHANNEL_PURPOSE.mobile, channel: 'mobile' });

  await recordAudit({
    actor: { userId: null, role: null },
    action: 'auth.signup.start',
    entityType: 'PendingSignup',
    entityId: pending._id,
    // No name, no address, no password material — an audit row is not the place
    // for contact details (m5-rules §4).
    after: { role },
    meta,
  });

  return {
    signupToken: signSignupToken(pending),
    email: maskEmail(pending.email),
    mobile: maskMobile(pending.mobile.e164),
    ...stateOf(pending),
  };
}

/**
 * Verify one channel. The two are independent and ORDER-AGNOSTIC on purpose: the
 * screens present them in sequence, but the API must not encode that, or a later
 * client that wants a different order would need a server change.
 */
export async function verifySignupChannel({ signupToken, channel, code }) {
  const pending = await loadPending(signupToken);
  const field = channel === 'email' ? 'emailVerifiedAt' : 'mobileVerifiedAt';

  // Already proved — treat a repeat as a no-op rather than "invalid code". A
  // double-tap or a retried request must not read as a failure.
  if (pending[field]) return stateOf(pending);

  await verifyOtp({
    pendingSignupId: pending._id,
    purpose: CHANNEL_PURPOSE[channel],
    code,
  });

  pending[field] = new Date();
  await pending.save();
  return stateOf(pending);
}

/** Resend one channel's code. */
export async function resendSignupOtp({ signupToken, channel }) {
  const pending = await loadPending(signupToken);
  const field = channel === 'email' ? 'emailVerifiedAt' : 'mobileVerifiedAt';
  if (pending[field]) {
    throw AppError.badRequest('already verified', 'That has already been verified.');
  }

  await requestOtp({
    pendingSignup: pending,
    purpose: CHANNEL_PURPOSE[channel],
    channel,
  });
  return stateOf(pending);
}

/**
 * Step 2 — create the real account. The FIRST point at which anything reaches
 * `users` or `organisations`.
 *
 * 🚧 Organisation **claim** (A21's "this company already exists — claim it?")
 * is NOT implemented here: this creates a new Organisation exactly as the old
 * signup did. Claim is the remaining half of A21 and is deliberately out of
 * scope for the verification fix.
 */
export async function completeSignup({
  signupToken,
  company,
  country,
  entityType,
  address,
  meta,
  ip,
  userAgent,
}) {
  const pending = await loadPending(signupToken);

  if (!pending.isFullyVerified()) {
    throw AppError.forbidden(
      'signup not fully verified',
      'Verify your email and mobile number before continuing.',
    );
  }

  // Required for an exporter (it drives the KYC document path) and meaningless
  // for a buyer. Enforced here rather than in the schema because the role lives
  // on the PENDING record — a client must not be able to choose which role it is
  // completing by shaping the body.
  if (pending.role === 'exporter' && !entityType) {
    throw AppError.badRequest('entityType required', 'Tell us whether this is a business or an individual.');
  }

  // `+passwordHash` — select:false on the model, and it is exactly what we need.
  const withHash = await PendingSignup.findOne({ _id: pending._id }).select('+passwordHash');

  // `createUserWithOrg` re-runs `assertIdentityAvailable` itself, which is what
  // matters here: an hour may have passed since `start` and someone else may have
  // taken the address meanwhile. The compound unique indexes are the race
  // backstop underneath that check.
  const isExporter = pending.role === 'exporter';
  const user = await createUserWithOrg({
    org: {
      name: company,
      type: 'business',
      country,
      kycStatus: 'pending',
      ...(isExporter ? { exporterSide: true, entityType, address } : { buyerSide: true }),
    },
    user: {
      name: pending.name,
      email: pending.email,
      mobile: pending.mobile,
      passwordHash: withHash.passwordHash,
      role: pending.role,
      isActive: true,
      mustChangePassword: false,
      // The whole point of the flow — recorded on the account, not inferred.
      isEmailVerified: true,
      isMobileVerified: true,
    },
  });

  // The pending record and its spent challenges have no further purpose. The TTL
  // would clear them anyway; removing them now keeps a used signup token from
  // resolving to anything at all.
  await Promise.all([
    PendingSignup.deleteOne({ _id: pending._id }),
    OtpChallenge.deleteMany({ pendingSignupId: pending._id }),
  ]);

  await recordAudit({
    actor: { userId: user._id, role: user.role },
    action: 'auth.signup',
    entityType: 'User',
    entityId: user._id,
    orgId: user.orgId,
    after: { emailVerified: true, mobileVerified: true },
    meta,
  });

  // Welcome mail (D5 email carve-out, owner 2026-08-04). Fire-and-forget: the
  // account exists and is usable, so a mail failure must not fail signup.
  // Copy rule 7 lives in the template — a buyer is active immediately, an
  // exporter is public immediately without a tick.
  notifyWelcome({ user, org: { name: company } });

  // Both factors were just proved, so a session is issued directly. Asking for a
  // third code here would be pure friction.
  const accessToken = signAccessToken(user);
  const { raw } = await startRefreshFamily({ userId: user._id, ip, userAgent });
  return { accessToken, refreshToken: raw, user };
}
