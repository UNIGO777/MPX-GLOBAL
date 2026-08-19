import mongoose from 'mongoose';

import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Organisation } from '../models/Organisation.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from './audit.service.js';
import { freezeThreadsForProduct, unfreezeThreadsForProduct } from './conversationFreeze.service.js';

// A8/A18: a product blocked continuously for 180 days is purged. The countdown
// the monitoring list shows derives from this.
export const PURGE_AFTER_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

// §5 — "nearing purge" warns well before the deadline; a countdown that only
// appears on the last day is not a warning.
export const NEARING_PURGE_DAYS = 150;

/**
 * The nearing-purge filter, defined ONCE and shared by the monitoring list and
 * the dashboard tile.
 *
 * 🔴 It must mirror the purge JOB: taken down, old enough, and NOT archived —
 * archived rows are never purged (A7). Two copies of this filter would drift,
 * and a tile whose count does not match the list it links to is the exact
 * failure W1 was raised about.
 */
export function nearingPurgeFilter(now = new Date()) {
  return {
    'takedown.isDown': true,
    'takedown.at': { $lte: new Date(now.getTime() - NEARING_PURGE_DAYS * DAY_MS) },
    status: { $ne: 'archived' },
  };
}

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const isObjectId = (v) => mongoose.isValidObjectId(v) && /^[a-fA-F0-9]{24}$/.test(String(v));

// Monitoring category filter — admin sees ALL states, so unlike the public
// resolver this includes inactive categories.
async function resolveCategoryIdsForAdmin(idOrSlug) {
  const filter = isObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: String(idOrSlug).toLowerCase() };
  const cat = await Category.findOne(filter).select('_id parentId').lean();
  if (!cat) return [];
  if (cat.parentId) return [cat._id];
  const subs = await Category.find({ parentId: cat._id }).select('_id').lean();
  return subs.map((s) => s._id);
}

// m5 §4: the monitoring list NEVER shows drafts or seller-archived rows, and
// its status filter has EXACTLY three options — Active/Inactive read `status`,
// Blocked reads `takedown.isDown` (never conflated — m5-rules §2).
export async function listAdminProducts({ category, status, seller, q, nearingPurge, page, pageSize }) {
  const match = { status: { $in: ['active', 'inactive'] } };

  if (category !== undefined) {
    match.categoryId = { $in: await resolveCategoryIdsForAdmin(category) };
  }
  if (seller !== undefined) match.exporterOrgId = new mongoose.Types.ObjectId(seller);
  // SUBSTRING, not prefix (review finding): a moderator searching "cotton"
  // expects to find "Premium Cotton Fabric". Still regex-ESCAPED, so no user
  // input is ever compiled as a pattern (no ReDoS, no injection).
  if (q) match.name = new RegExp(escapeRegex(q), 'i');
  if (status === 'active' || status === 'inactive') match.status = status;
  if (status === 'blocked') match['takedown.isDown'] = true;

  // §5 — the dashboard's "nearing purge" tile links HERE, so the list has to be
  // able to reproduce that exact count. Without it the tile pointed at
  // `status=blocked`, which is every blocked product — a number that does not
  // match the page it opens.
  if (nearingPurge) Object.assign(match, nearingPurgeFilter());

  const pipeline = [
    { $match: match },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $facet: {
        rows: [
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          { $lookup: { from: 'organisations', localField: 'exporterOrgId', foreignField: '_id', as: 'org' } },
          { $unwind: { path: '$org', preserveNullAndEmptyArrays: true } },
          { $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'category' } },
          { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
          {
            // Staff projection (curated — m5-rules §8; A9 restricts the SELLER
            // view only, so `takedown.byUserId` is legitimately present here).
            $project: {
              _id: 0,
              id: '$_id',
              name: 1,
              slug: 1,
              status: 1,
              createdAt: 1,
              takedown: 1,
              // Cover thumbnail for the moderation table (staff-only view —
              // 2026-08-11); the public projections are untouched.
              image: { $arrayElemAt: ['$images.url', 0] },
              category: { id: '$category._id', name: '$category.name', slug: '$category.slug' },
              // `slug` addresses the PUBLIC profile — §4 asks a monitoring row to
              // reach the admin Organisation AND the public page, which are two
              // different destinations.
              seller: {
                orgId: '$org._id',
                name: '$org.name',
                slug: '$org.slug',
                takedownCount: '$org.takedownCount',
              },
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const [result] = await Product.aggregate(pipeline);

  // G5 — m5 §4 wants WHO took a product down, not an opaque id. Resolved in ONE
  // batched lookup for the page, never per row.
  //
  // 🔴 STAFF VIEW ONLY. §A9 keeps the acting admin invisible to the seller, and
  // the seller's own view (`/products/mine`) builds a different projection that
  // carries only `reason` and `at`. Adding the name here must never leak there.
  const actorIds = [
    ...new Set(result.rows.map((r) => r.takedown?.byUserId).filter(Boolean).map(String)),
  ];
  const actors = actorIds.length
    ? await User.find({ _id: { $in: actorIds } }).select('name').lean()
    : [];
  const actorById = new Map(actors.map((u) => [String(u._id), u.name]));

  const rows = result.rows.map((r) => ({
    ...r,
    takedown: r.takedown?.isDown
      ? {
          ...r.takedown,
          // Null when the acting user has since been removed — the row still
          // renders, it just cannot name them.
          byName: actorById.get(String(r.takedown.byUserId)) ?? null,
        }
      : r.takedown,
    // Purge countdown is load-bearing (m5 §4) — without it the 180-day purge is
    // silent and the admin only notices when the row is gone.
    purgeAt: r.takedown?.isDown && r.takedown?.at ? new Date(r.takedown.at.getTime() + PURGE_AFTER_DAYS * DAY_MS) : null,
  }));
  return { rows, total: result.total[0]?.count ?? 0, page, pageSize };
}

async function loadForModeration(id) {
  // Staff RBAC read — fetch by _id, missing → 404 (never 403).
  const product = await Product.findOne({ _id: id });
  if (!product) throw AppError.notFound('product not found', 'Not found.');
  return product;
}

export async function takedownProduct({ id, reason, actor, meta }) {
  const product = await loadForModeration(id);
  if (product.status === 'draft') {
    // A draft was never publicly visible, is deliberately absent from the
    // monitoring list, and taking one down STRANDS it (review finding): the
    // seller can then neither publish nor delete it, it occupies one of their
    // 10 draft slots until the 180-day purge, and it inflates the takedownCount
    // that drives F6 suspension — all for content no buyer ever saw. Moderation
    // acts on what is live-or-was-live, matching the list's own contract.
    throw AppError.conflict('draft not takedownable', 'Draft products are not publicly visible.');
  }
  if (product.status === 'archived') {
    // A7 guard (plan second-verify): a taken-down archived row would match the
    // purge query and get hard-deleted — archived rows must never become
    // purgeable, so takedown on archived is refused outright.
    throw AppError.conflict('archived not takedownable', 'Archived products cannot be taken down.');
  }
  if (product.takedown?.isDown) {
    throw AppError.conflict('already taken down', 'This product is already taken down.');
  }

  // m5-rules §2: the takedown lives in its own object; `status` is untouched —
  // restore returns the product to exactly the state the seller left.
  product.takedown = { isDown: true, reason, byUserId: actor.userId, at: new Date() };
  await product.save();

  // §A24: increment-only offence counter (survives the purge; F6's trigger).
  await Organisation.updateOne({ _id: product.exporterOrgId }, { $inc: { takedownCount: 1 } });

  // M4-21: every thread on this product freezes on BOTH sides, and each gets a
  // system message explaining there is an issue and pointing the buyer at other
  // suppliers. Reading stays open (M4-22) — only writing stops. M4-29 means a
  // thread an admin had already blocked keeps ITS reason.
  const { frozen } = await freezeThreadsForProduct({ productId: product._id, reason: 'takedown' });

  await recordAudit({
    actor,
    action: 'product.takedown',
    entityType: 'Product',
    entityId: product._id,
    orgId: product.exporterOrgId,
    after: { reason, conversationsFrozen: frozen },
    meta,
  });
  return product;
}

/**
 * ⚠️ Known consequence, deliberately NOT guarded (raised in review, left as-is):
 * a takedown frees a D1 slot (A10), so an unverified seller can publish a
 * replacement while one listing is down. Restoring it then puts them at 4 live
 * products — over the cap.
 *
 * We do not block or downgrade the restore, because m5-rules §2 is explicit that
 * a restore returns the product to exactly the state the admin froze; silently
 * publishing it as `inactive` instead would break that guarantee and confuse the
 * seller. The cap governs the SELLER's publish action, not an admin's reversal,
 * and the state self-corrects — they cannot publish anything further until they
 * are back under the cap. Flagged to the owner rather than decided here.
 */
export async function restoreProduct({ id, actor, meta }) {
  const product = await loadForModeration(id);
  if (!product.takedown?.isDown) {
    throw AppError.conflict('not taken down', 'This product is not taken down.');
  }

  const before = { reason: product.takedown.reason ?? null };
  // The AuditLog rows are the history; the live object resets cleanly.
  product.takedown = { isDown: false, reason: undefined, byUserId: undefined, at: undefined };
  await product.save();
  // takedownCount deliberately NOT decremented (§A24 — offences, not state).

  // M4-30: NOT a blanket unfreeze. Each thread is re-derived from live state, so
  // one an admin had separately blocked stays shut and only its own block can
  // reopen it. Runs after the product is saved, so the re-check reads the new state.
  const { reopened } = await unfreezeThreadsForProduct({ productId: product._id });

  await recordAudit({
    actor,
    action: 'product.restore',
    entityType: 'Product',
    entityId: product._id,
    orgId: product.exporterOrgId,
    before,
    after: { restored: true, conversationsReopened: reopened },
    meta,
  });
  return product;
}
