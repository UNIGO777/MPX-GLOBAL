import { createHash, randomBytes } from 'node:crypto';

import { PendingSignup } from '../models/PendingSignup.js';
import { User } from '../models/User.js';
import { Organisation } from '../models/Organisation.js';
import { OtpChallenge } from '../models/OtpChallenge.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
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
// ONE mask definition, shared with login — see utils/mask.js.
import { maskEmail, maskMobile } from '../utils/mask.js';
import {
  assertIdentityAvailable,
  createUserInOrg,
  createUserWithOrg,
  normalizeMobile,
} from './auth.service.js';
import { notifyOrganisationJoined, notifyWelcome } from './emailNotifications.service.js';

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
    claimSalt: randomBytes(16).toString('hex'),
    expiresAt: new Date(Date.now() + SIGNUP_TOKEN_TTL_SECONDS * 1000),
  });

  // Two independent challenges under two different purposes — see OTP_PURPOSE in
  // models/enums.js for why a shared purpose would make them cancel each other.
  //
  // 🔴 DELIVERY IS PER-CHANNEL AND MUST NOT BE ALL-OR-NOTHING. These were two
  // bare awaits, so a single provider outage — an SMTP failure in production —
  // threw out of the whole request: the pending record was already written, the
  // mobile code was never even attempted, and the caller got a 500 with no way
  // forward. One provider having a bad minute must not stop people signing up.
  //
  // So: try both, and judge on the results. The codes are STORED before the send
  // is attempted, so a channel that failed to deliver can still be retried from
  // the verify screen's resend button.
  const delivery = await Promise.allSettled([
    requestOtp({ pendingSignup: pending, purpose: CHANNEL_PURPOSE.email, channel: 'email' }),
    requestOtp({ pendingSignup: pending, purpose: CHANNEL_PURPOSE.mobile, channel: 'mobile' }),
  ]);

  for (const [i, result] of delivery.entries()) {
    if (result.status === 'rejected') {
      logger.error(
        {
          channel: i === 0 ? 'email' : 'mobile',
          // Shaped, never the raw error: a provider error can quote its own
          // credentials or the recipient address.
          err: { name: result.reason?.name, message: result.reason?.message },
        },
        'signup otp delivery failed; the code is stored and can be resent',
      );
    }
  }

  // Both channels down is the one case the user genuinely cannot work around —
  // they would land on the verify screen with no codes and no idea why. Fail
  // honestly, and remove the pending record rather than leaving an orphan behind.
  if (delivery.every((r) => r.status === 'rejected')) {
    await PendingSignup.deleteOne({ _id: pending._id });
    throw new AppError('otp delivery failed on every channel', {
      statusCode: 503,
      clientMessage: "We couldn't send your verification codes. Please try again in a moment.",
    });
  }

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

// ═══ A21 step 2 · Organisation CLAIM (D7) ═══════════════════════════════════
//
// The rules (owner, 2026-09-23 — authoritative text: build-prompt §A21):
//   1. One organisation = at most one ACTIVE buyer + one ACTIVE exporter.
//   2. The verified email OR mobile matching a member of a company → offer to join.
//   3. Email reaches company A, mobile reaches company B → show BOTH, labelled by
//      which identifier matched, and let the person pick one.
//   4. The identity already holds both roles → "account already exists"
//      (enforced at `start` by `assertIdentityAvailable`, not here).
//   5. The company already has an active holder of this role → no offer; the
//      signup falls through to create.
//   6. A claim always proves the EXISTING member's email. Skipped only when that
//      email is the claimant's own — signup already proved it.
//   7. With an exporter in the company, the exporter controls the company
//      profile (enforced in `profileControl.service.js`, not here).
//
// 🔴 THE ONE RULE THAT MAKES THIS SAFE. Every company offered is derived from the
// identity the caller has ALREADY PROVED with both OTPs — never from a name they
// typed and never from an id they supplied. The client echoes back an opaque
// `choice` token; the orgId never leaves the server. Change that and the
// endpoint becomes a company-membership oracle, then a way to join an arbitrary
// organisation.

/** The locked, KYC-reviewed fields a side needs before it can carry a tick. */
function missingForSide(org, role) {
  if (role !== 'exporter') return [];
  // A buyer-created org holds only name + country; the exporter side is a
  // SUPERSET (owner, 2026-08-19). Carry-over is therefore not symmetric.
  const missing = [];
  if (!org.entityType) missing.push('entityType');
  const a = org.address ?? {};
  if (!a.line1 || !a.city || !a.postalCode) missing.push('address');
  return missing;
}

const PARTY_ROLES = ['buyer', 'exporter'];

/**
 * 8a · WHO proves the company for rule 6: the member already in it.
 *
 * Under rules 1 + 5 a claimable company holds no active user of the joining
 * role, so the active party member is the other side's account. Oldest first so
 * repeat offers always reach the same inbox. `null` when only deactivated
 * holders remain — and then the company is NOT offered (owner, 2026-09-23): a
 * dead mailbox must not be the only gate, and recovering such a company is a
 * support action (build-prompt §A21 "seat changes").
 */
async function verifierOf(orgId) {
  return User.findOne({ orgId, role: { $in: PARTY_ROLES }, isActive: true })
    .select('name email role')
    .sort({ createdAt: 1, _id: 1 });
}

/**
 * 🔴 RULE 6 — does joining this company still need a code from the member's
 * inbox? Only when the member's email is not the claimant's own. Recycled mobile
 * numbers are why (F1): Indian carriers reissue a number ~90 days after it
 * lapses, so "the phone matched" does not mean the claimant is the person who
 * registered it. A stranger holding a recycled SIM cannot read the member's
 * inbox.
 */
function needsOrgEmailProof({ pending, verifier }) {
  return verifier.email !== pending.email;
}

/**
 * Every organisation this pending signup may claim RIGHT NOW, with how it was
 * reached and who verifies it.
 *
 * Called both when the offer is served AND again at `complete` (8b): the stored
 * candidate list restricts what may be chosen, but eligibility is always
 * re-derived here from current state.
 */
export async function findClaimableOrgs({ pending }) {
  if (!pending?.isFullyVerified?.()) return [];

  // ACTIVE party members only. A deactivated account neither vouches for a match
  // nor holds a seat — the same condition the unique index uses.
  const users = await User.find({
    $or: [{ email: pending.email }, { 'mobile.e164': pending.mobile?.e164 }],
    role: { $in: PARTY_ROLES },
    isActive: true,
  }).select('orgId email mobile.e164');
  if (users.length === 0) return [];

  // How each company was reached, merged per org: the email may match one
  // account on it and the mobile another.
  const reached = new Map();
  for (const u of users) {
    if (!u.orgId) continue;
    const key = String(u.orgId);
    const byEmail = u.email === pending.email;
    const byMobile = u.mobile?.e164 === pending.mobile?.e164;
    const via = byEmail && byMobile ? 'both' : byEmail ? 'email' : 'mobile';
    const prev = reached.get(key);
    reached.set(key, prev && prev !== via ? 'both' : (prev ?? via));
  }

  // 🔴 RULES 1 + 5 — the seat must be free.
  const taken = await User.find({
    orgId: { $in: [...reached.keys()] },
    role: pending.role,
    isActive: true,
  }).select('orgId');
  for (const u of taken) reached.delete(String(u.orgId));
  if (reached.size === 0) return [];

  // 🔴 F7 — a BLOCKED company is never offered, never named. Naming it would
  // confirm to whoever holds a recycled number that the company exists and was
  // suspended; joining it would put someone inside a suspended business.
  // The platform org is excluded by type for the same belt-and-braces reason the
  // staff check exists: nothing party-side ever joins it.
  const orgs = await Organisation.find({
    _id: { $in: [...reached.keys()] },
    isActive: { $ne: false },
    type: { $ne: 'platform' },
  });

  const out = [];
  for (const org of orgs) {
    const verifier = await verifierOf(org._id);
    if (!verifier?.email) continue; // 8a step 3
    out.push({ org, matchedOn: reached.get(String(org._id)), verifier });
  }
  // Stable order, so a re-served offer does not shuffle the rows.
  return out.sort((a, b) => String(a.org._id).localeCompare(String(b.org._id)));
}

/** A rule-6 proof stands only for the company AND the member who gave it. */
function proofStands(pending, orgId, verifier) {
  return (pending.claimProofs ?? []).some(
    (p) => String(p.orgId) === String(orgId) && String(p.userId) === String(verifier._id),
  );
}

/**
 * The per-signup salt behind `choice` tokens. Set at `start`; a signup begun
 * before that existed gets one here, first writer wins, so concurrent readers
 * still agree.
 */
async function saltOf(pending) {
  if (pending.claimSalt) return pending.claimSalt;
  await PendingSignup.updateOne(
    { _id: pending._id, claimSalt: { $exists: false } },
    { $set: { claimSalt: randomBytes(16).toString('hex') } },
  );
  const fresh = await PendingSignup.findOne({ _id: pending._id }).select('claimSalt').lean();
  pending.claimSalt = fresh?.claimSalt;
  return pending.claimSalt;
}

/**
 * Opaque, stable token for one company in one signup. A hash of a secret
 * per-signup salt and the org id: not an id, not guessable, and the same on
 * every read — so concurrent reads cannot disagree about it.
 */
function choiceFor(salt, orgId) {
  return createHash('sha256').update(`${salt}:${String(orgId)}`).digest('hex').slice(0, 32);
}

/**
 * What the claim screen may render for one company.
 *
 * 🔴 No `kycStatus` and no org id: the status is reduced to a derived `verified`
 * boolean (raw `kycStatus` never reaches a public response, and this route is
 * public by necessity), and the id is replaced by the opaque `choice`.
 *
 * 🔴 The company's NAME and everything about it is WITHHELD while rule 6's code
 * is outstanding. The caller has proved only an identifier that reached the
 * company — for a mobile match that may be a recycled SIM, and naming the
 * company would hand a stranger exactly what F1 is about. What they see instead
 * is which identifier matched and the masked inbox the code will go to, which
 * is enough for a real colleague to know whom to ask.
 */
export function claimOffer({ org, role, matchedOn, choice, needsOrgEmailOtp, verifier }) {
  if (needsOrgEmailOtp) {
    return {
      choice,
      matchedOn,
      needsOrgEmailOtp: true,
      verifierEmail: maskEmail(verifier.email),
      name: null,
      country: null,
      verified: null,
      needs: null,
      carriesTickOver: null,
    };
  }
  const needs = missingForSide(org, role);
  return {
    choice,
    matchedOn,
    needsOrgEmailOtp: false,
    verifierEmail: null,
    name: org.name,
    country: org.country ?? null,
    verified: org.kycStatus === 'verified',
    // Which locked details this side still has to supply — the screen asks for
    // them and warns that supplying them sends the company back for review.
    needs,
    // Honest about the consequence BEFORE the user commits.
    carriesTickOver: org.kycStatus === 'verified' && needs.length === 0,
  };
}

/**
 * The claim offers for a signup token — the screen's own read.
 *
 * Side effect by design: this is where `claimCandidates` is written. The offer
 * and the set `complete` will accept must come from the same query, or they can
 * disagree. A company already offered keeps its `choice` and any proof already
 * given, so re-reading the screen neither breaks a code in flight nor asks for
 * it twice.
 */
export async function getClaimOffer({ signupToken }) {
  const pending = await loadPending(signupToken);
  assertFullyVerified(pending);

  const candidates = await findClaimableOrgs({ pending });
  const salt = await saltOf(pending);
  const rows = candidates.map(({ org, matchedOn }) => ({
    orgId: org._id,
    matchedOn,
    choice: choiceFor(salt, org._id),
  }));

  // Atomic, unversioned write: concurrent reads compute the same rows, so the
  // last writer changes nothing — and proofs live elsewhere, untouched.
  await PendingSignup.updateOne({ _id: pending._id }, { $set: { claimCandidates: rows } });
  pending.claimCandidates = rows;

  return {
    organisations: candidates.map(({ org, matchedOn, verifier }, i) =>
      claimOffer({
        org,
        role: pending.role,
        matchedOn,
        choice: rows[i].choice,
        verifier,
        needsOrgEmailOtp:
          needsOrgEmailProof({ pending, verifier }) && !proofStands(pending, org._id, verifier),
      }),
    ),
  };
}

/**
 * Resolve a client `choice` against BOTH the stored offer and current state.
 *
 * 🔴 8b · the stored list RESTRICTS, it never GRANTS. Minutes can pass between
 * the offer and its use (rule 6 sends someone to a colleague's inbox) — the seat
 * can be filled, the company blocked, the member replaced. So membership of the
 * stored list is necessary, and the full eligibility check is re-run on top.
 * Either failing is the same answer: that company can no longer be joined, and
 * the pending signup is KEPT so the person can still finish by creating.
 */
async function resolveChoice(pending, choice) {
  const stored = (pending.claimCandidates ?? []).find((c) => c.choice === choice);
  const current = stored
    ? (await findClaimableOrgs({ pending })).find((c) => String(c.org._id) === String(stored.orgId))
    : null;
  if (!stored || !current) {
    throw AppError.conflict(
      'claim target no longer eligible',
      'That company can no longer be joined from this signup. You can continue by setting up your company.',
      ERROR_CODES.CLAIM_SEAT_TAKEN,
    );
  }
  return { stored, ...current };
}

function assertFullyVerified(pending) {
  if (!pending.isFullyVerified()) {
    throw AppError.forbidden(
      'signup not fully verified',
      'Verify your email and mobile number before continuing.',
    );
  }
}

/**
 * Rule 6 · send the join code to the existing member's inbox.
 *
 * 🔴 9c · every attempt is audited, not just successful joins: the code lands in
 * a THIRD PARTY's inbox, so probing is possible, and with the SMS alert dropped
 * (owner, 2026-09-23) this row is the only forensic trail of it.
 */
export async function sendClaimOrgCode({ signupToken, choice, meta }) {
  const pending = await loadPending(signupToken);
  assertFullyVerified(pending);
  const { stored, org, matchedOn, verifier } = await resolveChoice(pending, choice);

  if (!needsOrgEmailProof({ pending, verifier }) || proofStands(pending, org._id, verifier)) {
    throw AppError.badRequest('no claim code needed', 'No code is needed to join this company.');
  }

  await PendingSignup.updateOne({ _id: pending._id }, { $set: { claimCodeFor: stored.choice } });

  await requestOtp({
    pendingSignup: pending,
    purpose: 'claim_org_email',
    channel: 'email',
    recipient: verifier,
    context: { orgName: org.name, matchedOn, joiningRole: pending.role },
  });

  await recordAudit({
    actor: { userId: null, role: null },
    action: 'organisation.claim_attempt',
    entityType: 'Organisation',
    entityId: org._id,
    orgId: org._id,
    // No claimant contact details (m5-rules §4) — the pending id links the row
    // to the signup, and `matchedOn` answers "how did they reach this company".
    after: { joiningRole: pending.role, matchedOn, pendingSignupId: String(pending._id) },
    meta,
  });

  return { sentTo: maskEmail(verifier.email) };
}

/** Rule 6 · check the join code. On success the offer is re-served, now named. */
export async function verifyClaimOrgCode({ signupToken, choice, code }) {
  const pending = await loadPending(signupToken);
  assertFullyVerified(pending);
  const { org, verifier } = await resolveChoice(pending, choice);

  // The single live challenge must have been issued for THIS company — a code
  // sent to company A's member must never unlock company B.
  if (pending.claimCodeFor !== choice) {
    throw AppError.unauthorized('claim code for another choice', 'Invalid or expired code.');
  }

  await verifyOtp({ pendingSignupId: pending._id, purpose: 'claim_org_email', code });

  // `$push`, never a rewrite of the candidate list: no concurrent offer read can
  // erase this proof.
  await PendingSignup.updateOne(
    { _id: pending._id },
    {
      $push: { claimProofs: { orgId: org._id, userId: verifier._id, at: new Date() } },
      $unset: { claimCodeFor: '' },
    },
  );

  return getClaimOffer({ signupToken });
}

/**
 * The claim half of `completeSignup`. Returns the new user and the org.
 *
 * Ordering is deliberate: the USER is inserted before the org is touched. The
 * unique `(orgId, role)` index is what finally arbitrates a race for the seat
 * (F5), and inserting first means a loser leaves the organisation exactly as it
 * found it — no side flag flipped, no tick withdrawn on behalf of an account
 * that was never created.
 */
async function claimInto({ pending, passwordHash, choice, entityType, address, meta, ip, userAgent }) {
  const { org, matchedOn, verifier } = await resolveChoice(pending, choice);

  const viaOwnEmail = !needsOrgEmailProof({ pending, verifier });
  if (!viaOwnEmail && !proofStands(pending, org._id, verifier)) {
    throw AppError.forbidden(
      'claim needs org email proof',
      "Enter the code sent to your company's email before joining.",
    );
  }

  const needs = missingForSide(org, pending.role);
  if (needs.includes('address') && !(address?.line1 && address?.city && address?.postalCode)) {
    throw AppError.badRequest('address required', 'Add your registered business address to continue.');
  }

  const claimed = await createUserInOrg({
    orgId: org._id,
    user: {
      name: pending.name,
      email: pending.email,
      mobile: pending.mobile,
      passwordHash,
      role: pending.role,
      isActive: true,
      mustChangePassword: false,
      isEmailVerified: true,
      isMobileVerified: true,
    },
  });

  const before = {
    kycStatus: org.kycStatus,
    buyerSide: org.buyerSide,
    exporterSide: org.exporterSide,
  };

  // `company`/`country` from the body are IGNORED on a claim — the existing
  // company's own name and country win, or a claimant could rename someone
  // else's organisation from a signup form.
  if (pending.role === 'exporter') org.exporterSide = true;
  else org.buyerSide = true;

  // 🔴 The asymmetry (owner, 2026-08-19): the exporter side needs `entityType` +
  // address — KYC-LOCKED fields nobody has reviewed for this company — so
  // supplying them withholds the tick until the exporter side is approved.
  if (needs.includes('entityType')) org.entityType = entityType;
  if (needs.includes('address')) {
    org.address = { ...(org.address?.toObject?.() ?? org.address ?? {}), ...address };
    org.markModified('address');
  }
  // 8d · a REJECTED org receiving new unreviewed details goes back to the queue
  // too, with the stale reason cleared — otherwise it sits looking rejected while
  // holding details no reviewer has seen. `pending` stays `pending`: there are no
  // documents yet, so there is nothing to review.
  if (needs.length > 0 && ['verified', 'rejected'].includes(org.kycStatus)) {
    org.kycStatus = 'submitted';
    org.verifiedBy = undefined;
    org.verifiedAt = undefined;
    org.kycRejectionReason = undefined;
  }
  // A claiming exporter's slug: the org may never have had one (buyer-only).
  if (pending.role === 'exporter') await org.retireAndRegenerateSlug();
  await org.save();

  await recordAudit({
    actor: { userId: claimed._id, role: claimed.role },
    action: 'organisation.claim',
    entityType: 'Organisation',
    entityId: org._id,
    orgId: org._id,
    before,
    after: {
      kycStatus: org.kycStatus,
      buyerSide: org.buyerSide,
      exporterSide: org.exporterSide,
      // What the claimant had to supply, and therefore why the tick moved.
      suppliedLockedFields: needs,
      // 9b · the field an F1 investigation needs: "how did this person get into
      // Acme?" is answered by a phone match, and by whose inbox vouched for it.
      matchedOn,
      verifiedVia: viaOwnEmail ? 'own_email' : 'org_email_otp',
      verifierUserId: String(verifier._id),
    },
    meta: { ip, userAgent, requestId: meta?.requestId },
  });

  // F6 · the member already in the company hears about it, every time.
  notifyOrganisationJoined({ org, recipient: verifier, joiner: claimed });

  return { user: claimed, org };
}

/**
 * Step 2 — create the real account. The FIRST point at which anything reaches
 * `users` or `organisations`.
 *
 * ✅ Organisation **claim** (A21 step 2 / D7): pass `claimChoice` — the opaque
 * token from the offer — to join that company instead of creating a second one.
 * The client cannot name a target; see the CLAIM block above for why that is the
 * whole security model, and `resolveChoice` for why the choice is re-checked.
 */
export async function completeSignup({
  signupToken,
  company,
  country,
  entityType,
  address,
  claimChoice,
  meta,
  ip,
  userAgent,
}) {
  const pending = await loadPending(signupToken);

  assertFullyVerified(pending);

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

  // ── CLAIM (A21 step 2 / D7) ────────────────────────────────────────────────
  if (claimChoice) {
    const { user: claimed, org } = await claimInto({
      pending,
      passwordHash: withHash.passwordHash,
      choice: claimChoice,
      entityType,
      address,
      meta,
      ip,
      userAgent,
    });

    await Promise.all([
      PendingSignup.deleteOne({ _id: pending._id }),
      OtpChallenge.deleteMany({ pendingSignupId: pending._id }),
    ]);

    // The signup itself is still a signup — same action as the create path so
    // `auth.signup` remains the complete list of account creations, with
    // `organisation.claim` explaining where the org came from.
    await recordAudit({
      actor: { userId: claimed._id, role: claimed.role },
      action: 'auth.signup',
      entityType: 'User',
      entityId: claimed._id,
      orgId: org._id,
      after: { emailVerified: true, mobileVerified: true, claimedOrganisation: true },
      meta,
    });

    notifyWelcome({ user: claimed, org: { name: org.name } });

    // A claim ends in a session exactly like a create.
    const claimAccess = signAccessToken(claimed);
    const { raw: claimRefresh } = await startRefreshFamily({ userId: claimed._id, ip, userAgent });
    return { accessToken: claimAccess, refreshToken: claimRefresh, user: claimed };
  }

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
