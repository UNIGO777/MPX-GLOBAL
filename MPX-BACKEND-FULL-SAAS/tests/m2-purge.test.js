import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';

vi.mock('../src/services/image.storage.service.js', () => ({
  verifyImageFile: vi.fn(),
  uploadPublicImage: vi.fn(),
  deletePublicImage: vi.fn(async () => {}),
}));

await import('../src/models/index.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { Category } = await import('../src/models/Category.js');
const { Product } = await import('../src/models/Product.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const { purgeBlockedProducts } = await import('../src/jobs/purgeBlockedProducts.js');
const { deletePublicImage } = await import('../src/services/image.storage.service.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-07-31T12:00:00.000Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * DAY_MS);

let org;
let leaf;
let seq = 0;

function blockedProduct({ downDays, status = 'active', extra = {} }) {
  seq += 1;
  return Product.create({
    exporterOrgId: org._id,
    categoryId: leaf._id,
    name: `Blocked ${seq}`,
    status,
    images: [{ url: 'https://res.cloudinary.com/fake/x.jpg', publicId: `mpx/products/${org._id}/x_${seq}` }],
    takedown: {
      isDown: true,
      reason: 'counterfeit',
      byUserId: new mongoose.Types.ObjectId(),
      at: daysAgo(downDays),
    },
    ...extra,
  });
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of ['Organisation', 'Category', 'Product']) await mongoose.model(name).syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([Organisation.deleteMany({}), Category.deleteMany({}), Product.deleteMany({})]);
  await mongoose.connection.db.collection('auditlogs').deleteMany({});
  vi.clearAllMocks();
  org = await Organisation.create({ name: 'Seller Co', type: 'business', exporterSide: true });
  const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
});

describe('A8 · 180-day blocked-product purge (M2-H)', () => {
  it('purges a >180d blocked row: images deleted, audit snapshot FIRST, then the row', async () => {
    const gone = await blockedProduct({ downDays: 181 });
    const { purged } = await purgeBlockedProducts({ now: NOW });
    expect(purged).toBe(1);

    expect(await Product.findById(gone._id)).toBeNull();
    expect(deletePublicImage).toHaveBeenCalledWith(gone.images[0].publicId);

    // The snapshot is all that survives — it must be complete (A8).
    const audit = await AuditLog.findOne({ action: 'product.purge', entityId: gone._id });
    expect(audit).toBeTruthy();
    expect(audit.before.productName).toBe(gone.name);
    expect(audit.before.sellerCompanyName).toBe('Seller Co');
    expect(audit.before.takedownReason).toBe('counterfeit');
    expect(audit.actorId).toBeNull(); // system job, no acting user
  });

  it('does NOT purge: 179d blocked · archived+blocked (A7 drift guard) · restored rows', async () => {
    const young = await blockedProduct({ downDays: 179 });
    const archived = await blockedProduct({ downDays: 300, status: 'archived' });
    const restored = await blockedProduct({ downDays: 300 });
    await Product.updateOne({ _id: restored._id }, { $set: { 'takedown.isDown': false } });

    const { purged } = await purgeBlockedProducts({ now: NOW });
    expect(purged).toBe(0);
    expect(await Product.findById(young._id)).toBeTruthy();
    expect(await Product.findById(archived._id)).toBeTruthy();
    expect(await Product.findById(restored._id)).toBeTruthy();
    expect(await AuditLog.countDocuments({ action: 'product.purge' })).toBe(0);
  });

  it('is idempotent — a second run finds nothing', async () => {
    await blockedProduct({ downDays: 200 });
    expect((await purgeBlockedProducts({ now: NOW })).purged).toBe(1);
    expect((await purgeBlockedProducts({ now: NOW })).purged).toBe(0);
    expect(await AuditLog.countDocuments({ action: 'product.purge' })).toBe(1); // no double audit
  });

  it('a cloudinary failure does not block the purge (best-effort assets)', async () => {
    deletePublicImage.mockRejectedValueOnce(new Error('cloud down'));
    const gone = await blockedProduct({ downDays: 200 });
    const { purged } = await purgeBlockedProducts({ now: NOW });
    expect(purged).toBe(1);
    expect(await Product.findById(gone._id)).toBeNull();
  });
});
