import mongoose from 'mongoose';

import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Organisation } from '../models/Organisation.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from './audit.service.js';

// A8/A18: a product blocked continuously for 180 days is purged. The countdown
// the monitoring list shows derives from this.
export const PURGE_AFTER_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

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
export async function listAdminProducts({ category, status, seller, q, page, pageSize }) {
  const match = { status: { $in: ['active', 'inactive'] } };

  if (category !== undefined) {
    match.categoryId = { $in: await resolveCategoryIdsForAdmin(category) };
  }
  if (seller !== undefined) match.exporterOrgId = new mongoose.Types.ObjectId(seller);
  if (q) match.name = new RegExp(`^${escapeRegex(q)}`, 'i');
  if (status === 'active' || status === 'inactive') match.status = status;
  if (status === 'blocked') match['takedown.isDown'] = true;

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
              category: { id: '$category._id', name: '$category.name', slug: '$category.slug' },
              seller: { orgId: '$org._id', name: '$org.name', takedownCount: '$org.takedownCount' },
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const [result] = await Product.aggregate(pipeline);
  const rows = result.rows.map((r) => ({
    ...r,
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

  await recordAudit({
    actor,
    action: 'product.takedown',
    entityType: 'Product',
    entityId: product._id,
    orgId: product.exporterOrgId,
    after: { reason },
    meta,
  });
  return product;
}

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

  await recordAudit({
    actor,
    action: 'product.restore',
    entityType: 'Product',
    entityId: product._id,
    orgId: product.exporterOrgId,
    before,
    after: { restored: true },
    meta,
  });
  return product;
}
