import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';

import '../src/models/index.js';
import { Category } from '../src/models/Category.js';
import { CategoryAttribute } from '../src/models/CategoryAttribute.js';
import { seedCatalogue } from '../src/seed/catalogue.js';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await Category.syncIndexes();
  await CategoryAttribute.syncIndexes();
  await Category.deleteMany({});
  await CategoryAttribute.deleteMany({});
});

afterAll(async () => {
  await Category.deleteMany({});
  await CategoryAttribute.deleteMany({});
  await mongoose.disconnect();
});

describe('catalogue seed (M2-C)', () => {
  it('seeds 40 tops (no type) + subs (typed) + attribute defaults', async () => {
    const counts = await seedCatalogue();
    expect(counts.topsInserted).toBe(40);
    expect(counts.subsInserted).toBeGreaterThanOrEqual(250);

    const tops = await Category.find({ parentId: null });
    expect(tops).toHaveLength(40);
    // A16: no top carries a type — not even 'Other'.
    expect(tops.every((t) => t.type == null)).toBe(true);

    const subs = await Category.find({ parentId: { $ne: null } });
    expect(subs.length).toBe(counts.subsInserted);
    expect(subs.every((s) => s.type === 'goods' || s.type === 'service')).toBe(true);
  });

  it('is idempotent — a second run inserts nothing and clobbers nothing', async () => {
    const catBefore = await Category.countDocuments({});
    const attrBefore = await CategoryAttribute.countDocuments({});

    // Simulate an admin edit that a re-run must NOT clobber.
    await Category.updateOne({ slug: 'textiles-fabrics-yarn' }, { $set: { synonyms: ['kapda', 'cloth'] } });

    const counts = await seedCatalogue();
    expect(counts.topsInserted).toBe(0);
    expect(counts.subsInserted).toBe(0);
    expect(counts.attrsInserted).toBe(0);
    expect(await Category.countDocuments({})).toBe(catBefore);
    expect(await CategoryAttribute.countDocuments({})).toBe(attrBefore);

    const textiles = await Category.findOne({ slug: 'textiles-fabrics-yarn' });
    expect(textiles.synonyms).toEqual(['kapda', 'cloth']);
  });

  it('A14: "Other" has exactly two typed subs (goods + service) with the A17 fixed set', async () => {
    const other = await Category.findOne({ slug: 'other', parentId: null });
    const subs = await Category.find({ parentId: other._id }).sort({ order: 1 });
    expect(subs.map((s) => [s.slug, s.type])).toEqual([
      ['other-goods', 'goods'],
      ['other-services', 'service'],
    ]);
    const attrs = await CategoryAttribute.find({ categoryId: subs[0]._id }).sort({ order: 1 });
    expect(attrs.map((a) => a.key)).toEqual(['specification', 'application']);
  });

  it('resolves the Footwear slug clash (leather sub gets a parent-prefixed slug)', async () => {
    const top = await Category.findOne({ slug: 'footwear', parentId: null });
    const leatherSub = await Category.findOne({ slug: 'leather-footwear' });
    expect(top).toBeTruthy();
    expect(leatherSub).toBeTruthy();
    expect(leatherSub.parentId).not.toBeNull();
    expect(leatherSub.name).toBe('Footwear');
  });

  it('spot-check: a Textiles sub carries the §A25.2 defaults (gsm number+filterable, material text)', async () => {
    const cotton = await Category.findOne({ slug: 'cotton-fabric' });
    const attrs = await CategoryAttribute.find({ categoryId: cotton._id });
    const byKey = Object.fromEntries(attrs.map((a) => [a.key, a]));

    expect(byKey.gsm.inputType).toBe('number');
    expect(byKey.gsm.unit).toBe('gsm');
    expect(byKey.gsm.filterable).toBe(true);
    expect(byKey.material.inputType).toBe('text');
    expect(byKey.material.filterable).toBe(false);
    // No select options are ever invented; nothing is required by default.
    expect(attrs.every((a) => a.options.length === 0)).toBe(true);
    expect(attrs.every((a) => a.required === false)).toBe(true);
  });
});
