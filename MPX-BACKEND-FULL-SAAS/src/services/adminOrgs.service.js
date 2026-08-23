import mongoose from 'mongoose';

import { Organisation } from '../models/Organisation.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Inquiry } from '../models/Inquiry.js';
import { SavedItem } from '../models/SavedItem.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../utils/AppError.js';
import { countConversationsForOrg } from './adminConversations.service.js';

/**
 * M5-D — Organisation list and detail.
 *
 * §7: A21 made the COMPANY the unit an admin governs, not the user — an
 * Organisation can hold a buyer side, an exporter side, or both.
 *
 * Rule 14 — no new models and no new persisted fields. Everything here is read
 * from what M1–M4 already store, and the four values with no field anywhere
 * ("which side was reviewed", resubmit count, side-enabled dates, claim history)
 * are derived from AuditLog.
 */

const MAX_PAGE = 50;

// V5 — the platform org is the single non-company row that owns the superadmin.
// It has no sides, no products and no chats; rendering it as a company is
// meaningless, and `loadCompanyOrg` already refuses it for block/unblock.
const COMPANY_ONLY = { type: { $ne: 'platform' } };

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildListFilter({ side, verification, blocked, q }) {
  const filter = { ...COMPANY_ONLY };

  if (side === 'buyer') filter.buyerSide = true;
  else if (side === 'exporter') filter.exporterSide = true;
  else if (side === 'both') Object.assign(filter, { buyerSide: true, exporterSide: true });

  if (verification === 'change_pending') {
    // Verified companies with a reviewable profile change (2026-08-19).
    filter.kycStatus = 'verified';
    filter['pendingChanges.state'] = 'awaiting_review';
  } else if (verification) {
    filter.kycStatus = verification;
  }
  if (blocked === true) filter.isActive = false;
  else if (blocked === false) filter.isActive = { $ne: false };

  // Rule 9 — regex-ESCAPED and prefix-anchored. `rejectMongoOperators` blocks
  // operator objects, not metacharacters inside a string, so `.*` must not
  // become a pattern.
  if (q) filter.name = new RegExp(`^${escapeRegex(q)}`, 'i');

  return filter;
}

/**
 * V4 — live product counts for a whole page in ONE aggregation.
 *
 * The obvious `countDocuments` per row is twenty queries for a twenty-row page.
 * "Live" is the same shape as the D1 cap query and the public `productCount`:
 * active and not taken down.
 */
async function liveProductCounts(orgIds) {
  if (orgIds.length === 0) return new Map();
  const rows = await Product.aggregate([
    {
      $match: {
        exporterOrgId: { $in: orgIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
        status: 'active',
        'takedown.isDown': { $ne: true },
      },
    },
    { $group: { _id: '$exporterOrgId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export async function listOrganisations(params) {
  const size = Math.min(params.pageSize ?? 20, MAX_PAGE);
  const page = params.page ?? 1;
  const filter = buildListFilter(params);

  const [rows, total] = await Promise.all([
    Organisation.find(filter)
      // §7 sorts by takedown count — the column that surfaces repeat offenders.
      // `createdAt` + `_id` are the tiebreaker, or rows repeat across pages.
      .sort({ takedownCount: -1, createdAt: -1, _id: -1 })
      .skip((page - 1) * size)
      .limit(size)
      .lean(),
    Organisation.countDocuments(filter),
  ]);

  return {
    rows,
    productCounts: await liveProductCounts(rows.map((r) => r._id)),
    total,
    page,
    pageSize: size,
  };
}

async function loadCompany(id) {
  // Rule 7 — staff read by id, no ownership filter; missing → 404, never 403.
  // V5: the platform org is not a company, so it 404s here too.
  const org = await Organisation.findOne({ _id: id, ...COMPANY_ONLY }).select('+kycDocuments');
  if (!org) throw AppError.notFound('organisation not found', 'Not found.');
  return org;
}

/**
 * The four values that have NO field anywhere (rule 14 — do NOT add one).
 *
 * ⚠️ `org.claim` rows are never written today because A21 Step 4b (signup
 * step-2 organisation claim) is not built. So `claimHistory` comes back empty
 * and the screen must say "no claim recorded" — not imply the data went missing.
 */
async function deriveFromAudit(orgId) {
  const rows = await AuditLog.find({
    orgId,
    action: { $in: ['buyer.approve', 'exporter.verify', 'kyc.submit', 'org.claim', 'auth.signup'] },
  })
    .select('action occurredAt actorId')
    .sort({ occurredAt: 1 })
    .lean();

  const reviews = rows.filter((r) => r.action === 'buyer.approve' || r.action === 'exporter.verify');

  return {
    /**
     * §7/rule 13 — `kycStatus` is ONE shared value, so whichever side is reviewed
     * first verifies the whole company. The screen has to name the side, or an
     * unreviewed exporter side reads as verified.
     *
     * An ARRAY, not a single value: both sides can be reviewed over time, and
     * reporting only the first would say "buyer" for a company whose exporter
     * side has since been reviewed too — understating the evidence rather than
     * overstating it, but still wrong.
     */
    reviewedSides: [
      ...new Set(reviews.map((r) => (r.action === 'buyer.approve' ? 'buyer' : 'exporter'))),
    ],
    reviewedAt: reviews.length ? reviews[0].occurredAt : null,
    resubmitCount: rows.filter((r) => r.action === 'kyc.submit').length,
    claimHistory: rows
      .filter((r) => r.action === 'org.claim')
      .map((r) => ({ at: r.occurredAt, byUserId: r.actorId ? String(r.actorId) : null })),
    signupAt: rows.find((r) => r.action === 'auth.signup')?.occurredAt ?? null,
  };
}

/**
 * Products by status — a COUNT, including archived (W3: the count is not a list).
 *
 * The buckets are DISJOINT and sum to the total. `blocked` takes precedence over
 * the seller's own `status`, because an admin takedown is the fact that matters
 * and `status` underneath it is whatever the seller happened to leave. Counting
 * a blocked-and-inactive product in both buckets would produce a breakdown whose
 * parts add up to more than the whole — the kind of number an admin quietly
 * stops trusting.
 */
async function productBreakdown(orgId) {
  const notBlocked = { $ne: ['$takedown.isDown', true] };
  const rows = await Product.aggregate([
    { $match: { exporterOrgId: new mongoose.Types.ObjectId(String(orgId)) } },
    {
      $group: {
        _id: null,
        active: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'active'] }, notBlocked] }, 1, 0] } },
        inactive: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'inactive'] }, notBlocked] }, 1, 0] } },
        draft: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'draft'] }, notBlocked] }, 1, 0] } },
        archived: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'archived'] }, notBlocked] }, 1, 0] } },
        blocked: { $sum: { $cond: [{ $eq: ['$takedown.isDown', true] }, 1, 0] } },
      },
    },
  ]);
  const r = rows[0] ?? {};
  return {
    active: r.active ?? 0,
    inactive: r.inactive ?? 0,
    draft: r.draft ?? 0,
    archived: r.archived ?? 0,
    blocked: r.blocked ?? 0,
  };
}

/**
 * §7 — "Verification: status · WHO verified · when". The model stores an id, and
 * an id is not an answer to "who". Same fix as G5 on the monitoring list; the
 * reviewer is a staff member, so naming them to staff is not a §A9 concern.
 */
async function resolveVerifier(org) {
  if (!org.verifiedBy) return null;
  const user = await User.findOne({ _id: org.verifiedBy }).select('name role').lean();
  return {
    id: String(org.verifiedBy),
    // Null when the account is gone — the row still renders, it just cannot
    // name them, exactly as the audit viewer behaves.
    name: user?.name ?? null,
    role: user?.role ?? null,
  };
}

export async function getOrganisation(id) {
  const org = await loadCompany(id);

  const [users, derived, chats, verifier] = await Promise.all([
    // V2 — rule 8 forbids returning ANOTHER user's permissions. Permission sets
    // belong to the Employees screen, which is superadmin-only.
    User.find({ orgId: org._id }).select('name email role isActive lastLoginAt createdAt').lean(),
    deriveFromAudit(org._id),
    countConversationsForOrg(org._id),
    resolveVerifier(org),
  ]);

  const products = org.exporterSide ? await productBreakdown(org._id) : null;

  const buyerActivity = org.buyerSide
    ? {
        enquiriesSent: await Inquiry.countDocuments({ buyerOrgId: org._id }),
        savedItems: await SavedItem.countDocuments({ buyerOrgId: org._id }),
      }
    : null;

  return { org, users, derived, chats, products, buyerActivity, verifier };
}
