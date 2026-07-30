import { Organisation } from '../models/Organisation.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from './audit.service.js';

/**
 * F1-A — the org-level block cascade (A21 Step 5).
 *
 * TWO writes are required and neither is sufficient alone:
 *
 *  1. `Organisation.isActive = false` — the public seller read already filters
 *     `{ isActive: true }`, so the profile 404s the moment this flips. But
 *     `authenticate` NEVER reads the Organisation (that per-request lookup is
 *     deliberately avoided), so this alone would hide the shopfront and leave
 *     every one of the org's users happily logged in.
 *
 *  2. The cascade onto the user rows — `isActive: false` + `tokenVersion++` per
 *     user, which is what actually kills live sessions and blocks login
 *     (auth-sessions A7), exactly as the per-user path already does.
 *
 * NOT here: products and chats. Taking a blocked seller's catalogue down and
 * freezing their conversations is **F1-B**, which needs M2 (`Product` is still a
 * stub — no `exporterOrgId`, no `status`, no `takedown`) and M4 (`Conversation`
 * does not exist yet). F1-B must be written deliberately when those models are
 * real, WITH its own prevActive capture — it is intentionally not stubbed,
 * commented out, or staged here, because a half-written cascade that wakes up on
 * its own is worse than no cascade. See modules-in-detailed/m6-Finalization.
 */

// A block/unblock is only ever an admin action on a COMPANY org. The single
// platform org holds the superadmin and has no public profile — blocking it would
// lock the platform out of itself.
async function loadCompanyOrg(id) {
  const org = await Organisation.findOne({ _id: id });
  if (!org) throw AppError.notFound('organisation not found', 'Not found.');
  if (org.type === 'platform') {
    throw AppError.forbidden('cannot block platform org', 'Not allowed.');
  }
  return org;
}

/**
 * Refuse to attach a user to a blocked Organisation.
 *
 * A21 Step 4c (signup step 2 — claim an existing Organisation) is NOT built yet,
 * so nothing calls this today. It lives here, centrally, so the claim path cannot
 * be written without it: claiming a blocked org would hand a fresh, active login
 * to a company an admin has just shut down — the block's most obvious bypass.
 *
 * 4c MUST call this before attaching a user to any existing org.
 */
export function assertOrgClaimable(org) {
  if (!org) throw AppError.notFound('organisation not found', 'Not found.');
  if (org.isActive === false) {
    // Same generic shape as the rest of the auth surface — do not tell an
    // anonymous caller that this specific company is under moderation.
    throw AppError.forbidden('organisation blocked', 'This company cannot be joined.');
  }
  return org;
}

/**
 * Block an Organisation and cascade to its users.
 * Superadmin-only (hard role gate on the route — never a grantable permission).
 */
export async function blockOrganisation({ id, reason, actor, meta }) {
  const org = await loadCompanyOrg(id);

  if (org.isActive === false) {
    throw AppError.conflict('already blocked', 'This organisation is already blocked.');
  }

  // Capture each user's CURRENT state before the cascade overwrites it, so unblock
  // can put back exactly what was there — including a user a superadmin had
  // deactivated individually beforehand. Two updates, not one, because the value
  // written to prevActive differs per row.
  await User.updateMany({ orgId: org._id, isActive: true }, { $set: { prevActive: true } });
  await User.updateMany({ orgId: org._id, isActive: false }, { $set: { prevActive: false } });

  // isActive:false ends login; tokenVersion++ invalidates every access token
  // already issued (authenticate re-checks it on every request).
  const cascade = await User.updateMany(
    { orgId: org._id },
    { $set: { isActive: false }, $inc: { tokenVersion: 1 } },
  );

  const before = { isActive: org.isActive };
  org.isActive = false;
  org.blockReason = reason;
  org.blockedAt = new Date();
  org.blockedBy = actor.userId;
  await org.save();

  await recordAudit({
    actor,
    action: 'org.block',
    entityType: 'Organisation',
    entityId: org._id,
    orgId: org._id,
    before,
    after: { isActive: false, reason, usersCascaded: cascade.modifiedCount },
    meta,
  });

  return { org, usersCascaded: cascade.modifiedCount };
}

/**
 * Unblock an Organisation and restore each user's PRIOR state.
 * Deliberately not a blanket reactivate — see prevActive on User.
 */
export async function unblockOrganisation({ id, reason, actor, meta }) {
  const org = await loadCompanyOrg(id);

  if (org.isActive !== false) {
    throw AppError.conflict('not blocked', 'This organisation is not blocked.');
  }

  // Restore only the users the cascade actually switched off. A user whose
  // prevActive is false was already deactivated before the block and STAYS off —
  // re-activating them would silently undo a separate admin decision.
  const restored = await User.updateMany(
    { orgId: org._id, prevActive: true },
    { $set: { isActive: true }, $unset: { prevActive: '' } },
  );
  // Clear the marker on the rest too, so a later block re-captures cleanly rather
  // than restoring a stale snapshot.
  await User.updateMany({ orgId: org._id, prevActive: false }, { $unset: { prevActive: '' } });

  const before = { isActive: org.isActive };
  org.isActive = true;
  org.blockReason = undefined;
  org.blockedAt = undefined;
  org.blockedBy = undefined;
  await org.save();

  await recordAudit({
    actor,
    action: 'org.unblock',
    entityType: 'Organisation',
    entityId: org._id,
    orgId: org._id,
    before,
    after: { isActive: true, ...(reason ? { reason } : {}), usersRestored: restored.modifiedCount },
    meta,
  });

  return { org, usersRestored: restored.modifiedCount };
}
