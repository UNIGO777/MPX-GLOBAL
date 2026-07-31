import cron from 'node-cron';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { Product } from '../models/Product.js';
import { Organisation } from '../models/Organisation.js';
import { AuditLog } from '../models/AuditLog.js';
import { deletePublicImage } from '../services/image.storage.service.js';
import { PURGE_AFTER_DAYS } from '../services/adminProducts.service.js';
import { removeSavedForProduct } from '../services/saved.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A8 — the ONLY hard delete in the system: a product taken down continuously
 * for more than 180 days (A18) loses its row and its Cloudinary images.
 *
 * Invariants:
 *  - `status: { $ne: 'archived' }` — archived rows are NEVER purged (A7; the
 *    takedown endpoint refuses archived rows too — this clause is
 *    defence-in-depth against data drift).
 *  - The AuditLog entry SNAPSHOTS the product name + seller company name (an
 *    entry holding only an ObjectId is useless once the row is gone).
 *  - Audit is written BEFORE the delete: a crash in between re-purges the row
 *    on the next run (idempotent) — a deleted row without its snapshot is the
 *    one order that can never be repaired.
 *  - Restore before the threshold escapes (isDown flips false → no match).
 *
 * `now` is injectable for tests.
 */
export async function purgeBlockedProducts({ now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - PURGE_AFTER_DAYS * DAY_MS);
  const candidates = await Product.find({
    'takedown.isDown': true,
    'takedown.at': { $lte: cutoff },
    status: { $ne: 'archived' },
  });

  let purged = 0;
  for (const product of candidates) {
    const org = await Organisation.findOne({ _id: product.exporterOrgId }).select('name').lean();

    // Best-effort asset cleanup — a missing remote asset never blocks the purge.
    for (const image of product.images ?? []) {
      try {
        await deletePublicImage(image.publicId);
      } catch (err) {
        logger.warn(
          { err: { name: err?.name, message: err?.message }, publicId: image.publicId },
          'purge: cloudinary delete failed (continuing)',
        );
      }
    }

    await AuditLog.create({
      actorId: null, // system job — no acting user
      action: 'product.purge',
      entityType: 'Product',
      entityId: product._id,
      orgId: product.exporterOrgId,
      before: {
        // A8 snapshot — this is all that survives the delete.
        productName: product.name,
        sellerCompanyName: org?.name ?? null,
        takedownReason: product.takedown.reason ?? null,
        takedownBy: product.takedown.byUserId ? String(product.takedown.byUserId) : null,
        takedownAt: product.takedown.at ?? null,
      },
      after: { purgedAt: now },
      requestId: 'job:purge-blocked-products',
    });

    await Product.deleteOne({ _id: product._id });
    // M3-D: the row is gone for good — drop any buyer's saved entry for it.
    await removeSavedForProduct(product._id);
    purged += 1;
  }

  if (purged > 0 || candidates.length > 0) {
    logger.info({ purged }, 'blocked-product purge complete');
  }
  return { purged };
}

// Daily at 03:15 server time + one catch-up run at boot. Disabled entirely in
// tests. Single-process assumption (plan M2-H): if hosting ever runs multiple
// processes, pin this to one instance.
export function schedulePurgeJob() {
  if (env.NODE_ENV === 'test') return null;

  const task = cron.schedule('15 3 * * *', () => {
    purgeBlockedProducts().catch((err) =>
      logger.error({ err: { name: err?.name, message: err?.message } }, 'blocked-product purge failed'),
    );
  });

  // Boot catch-up: a server that was down over the scheduled slot still purges.
  purgeBlockedProducts().catch((err) =>
    logger.error({ err: { name: err?.name, message: err?.message } }, 'blocked-product purge (boot) failed'),
  );

  return task;
}
