import { Product } from '../models/Product.js';
import { Organisation } from '../models/Organisation.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from './audit.service.js';
import { notifyUnblockRejected, notifyUnblockRequested } from './unblockNotifications.service.js';

/**
 * D6 · seller "request unblock" for a taken-down product (owner, 2026-09-25).
 *
 * - The seller only ASKS. Approval is the existing staff restore
 *   (`restoreProduct`); nothing here can bring a product back.
 * - One pending request per takedown. After a rejection the seller waits
 *   REASK_AFTER_DAYS before asking again.
 * - A pending request pauses the 180-day purge (`PURGE_NOT_PAUSED`).
 * - Raise and reject are audited here; approve is audited by the restore.
 */
export const REASK_AFTER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** When a rejected request may be followed by a new one; null = any time. */
export function reaskAt(appeal) {
  if (appeal?.status !== 'rejected' || !appeal.decidedAt) return null;
  return new Date(new Date(appeal.decidedAt).getTime() + REASK_AFTER_DAYS * DAY_MS);
}

export async function requestUnblock({ user, id, message, meta }) {
  // Ownership-scoped: another seller's product is a 404, never a 403 (A6).
  const product = await Product.findOne({ _id: id, exporterOrgId: user.orgId });
  if (!product) throw AppError.notFound('product not found', 'Not found.');
  if (!product.takedown?.isDown) {
    throw AppError.conflict('not taken down', 'This product is not taken down.');
  }
  const appeal = product.takedown.appeal;
  if (appeal?.status === 'pending') {
    throw AppError.conflict('unblock already requested', 'You have already asked for this product to be unblocked.');
  }
  const now = new Date();
  const retry = reaskAt(appeal);
  if (retry && retry > now) {
    throw AppError.conflict(
      'unblock re-ask too soon',
      `You can ask again after ${retry.toISOString().slice(0, 10)}.`,
    );
  }

  // Guarded write: a double submit can't create two requests, and a restore
  // or a second request landing in between wins cleanly.
  const res = await Product.updateOne(
    { _id: product._id, exporterOrgId: user.orgId, 'takedown.isDown': true, 'takedown.appeal.status': { $ne: 'pending' } },
    { $set: { 'takedown.appeal': { status: 'pending', message, at: now } } },
  );
  if (!res.modifiedCount) {
    throw AppError.conflict('unblock already requested', 'You have already asked for this product to be unblocked.');
  }

  await recordAudit({
    actor: user,
    action: 'product.unblock_request',
    entityType: 'Product',
    entityId: product._id,
    orgId: product.exporterOrgId,
    after: { message },
    meta,
  });

  const org = await Organisation.findOne({ _id: product.exporterOrgId }).select('name').lean();
  notifyUnblockRequested({ product, sellerName: org?.name });
  return Product.findOne({ _id: product._id, exporterOrgId: user.orgId });
}

/** Staff decline. The reason is shown to the seller; who declined is not (A9). */
export async function rejectUnblock({ id, reason, actor, meta }) {
  const now = new Date();
  const product = await Product.findOneAndUpdate(
    { _id: id, 'takedown.isDown': true, 'takedown.appeal.status': 'pending' },
    { $set: { 'takedown.appeal.status': 'rejected', 'takedown.appeal.decidedAt': now, 'takedown.appeal.rejectReason': reason } },
    { new: true },
  );
  if (!product) {
    // Missing product → 404; present but nothing pending → 409.
    const exists = await Product.exists({ _id: id });
    if (!exists) throw AppError.notFound('product not found', 'Not found.');
    throw AppError.conflict('no pending unblock request', 'There is no unblock request waiting on this product.');
  }

  await recordAudit({
    actor,
    action: 'product.unblock_reject',
    entityType: 'Product',
    entityId: product._id,
    orgId: product.exporterOrgId,
    before: { message: product.takedown.appeal.message ?? null },
    after: { reason },
    meta,
  });
  notifyUnblockRejected(product);
  return product;
}
