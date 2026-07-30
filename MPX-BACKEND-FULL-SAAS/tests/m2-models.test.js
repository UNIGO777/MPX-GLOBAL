import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import '../src/models/index.js';
import { Category } from '../src/models/Category.js';
import { CategoryAttribute } from '../src/models/CategoryAttribute.js';
import { Product } from '../src/models/Product.js';

const oid = () => new mongoose.Types.ObjectId();

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of ['Category', 'CategoryAttribute', 'Product']) {
    await mongoose.model(name).syncIndexes();
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Category.deleteMany({});
  await CategoryAttribute.deleteMany({});
  await Product.deleteMany({});
});

describe('Category model (M2-B)', () => {
  it('A16: a top category must NOT carry a type', async () => {
    await expect(Category.create({ name: 'Agriculture', type: 'goods' })).rejects.toThrow(/must not have a type/);
  });

  it('A16: a sub-category REQUIRES a type', async () => {
    const top = await Category.create({ name: 'Agriculture' });
    await expect(Category.create({ name: 'Seeds', parentId: top._id })).rejects.toThrow(/requires a type/);
  });

  it('valid top (no type) and sub (typed) both save; slug auto-generates', async () => {
    const top = await Category.create({ name: 'Textiles, Fabrics & Yarn' });
    expect(top.slug).toBe('textiles-fabrics-yarn');
    expect(top.type).toBeUndefined();
    expect(top.active).toBe(true);

    const sub = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
    expect(sub.slug).toBe('cotton-fabric');
    expect(sub.type).toBe('goods');
  });

  it('slug clash gets an id-suffix (visible-clash path)', async () => {
    const a = await Category.create({ name: 'Footwear' });
    const top = await Category.create({ name: 'Leather' });
    const b = await Category.create({ name: 'Footwear', parentId: top._id, type: 'goods' });
    expect(a.slug).toBe('footwear');
    expect(b.slug).toMatch(/^footwear-/);
    expect(b.slug).not.toBe(a.slug);
  });
});

describe('CategoryAttribute model (M2-B)', () => {
  it('select requires options; non-select must have none', async () => {
    const catId = oid();
    await expect(
      CategoryAttribute.create({ categoryId: catId, name: 'Material', key: 'material', inputType: 'select' }),
    ).rejects.toThrow(/at least one option/);
    await expect(
      CategoryAttribute.create({
        categoryId: catId,
        name: 'GSM',
        key: 'gsm',
        inputType: 'number',
        options: ['x'],
      }),
    ).rejects.toThrow(/only valid on a select/);
  });

  it('(categoryId, key) is unique — same key allowed under a different category', async () => {
    const catA = oid();
    const catB = oid();
    await CategoryAttribute.create({ categoryId: catA, name: 'GSM', key: 'gsm', inputType: 'number' });
    await expect(
      CategoryAttribute.create({ categoryId: catA, name: 'GSM 2', key: 'gsm', inputType: 'number' }),
    ).rejects.toThrow(/E11000/);
    await expect(
      CategoryAttribute.create({ categoryId: catB, name: 'GSM', key: 'gsm', inputType: 'number' }),
    ).resolves.toBeTruthy();
  });
});

describe('Product model (M2-B)', () => {
  const base = () => ({
    exporterOrgId: oid(),
    categoryId: oid(),
    name: 'Cotton Fabric Roll',
  });

  it('defaults: status draft, on_request price mode, no takedown, sellerVerified false', async () => {
    const p = await Product.create(base());
    expect(p.status).toBe('draft');
    expect(p.price.mode).toBe('on_request');
    expect(p.takedown.isDown).toBe(false);
    expect(p.sellerVerified).toBe(false);
    expect(p.slug).toBe('cotton-fabric-roll');
  });

  it('rejects a 6th image (§A25.3 cap is 5)', async () => {
    const images = Array.from({ length: 6 }, (_, i) => ({
      url: `https://res.cloudinary.com/x/p_${i}.jpg`,
      publicId: `mpx/products/org/p_${i}`,
    }));
    await expect(Product.create({ ...base(), images })).rejects.toThrow(/at most 5 images/);
  });

  it('rejects an unknown currency and an unknown status (enum backstops)', async () => {
    await expect(
      Product.create({ ...base(), price: { mode: 'fixed', min: 10, currency: 'XXX' } }),
    ).rejects.toThrow();
    await expect(Product.create({ ...base(), status: 'deleted' })).rejects.toThrow();
  });

  it('slug clash on the same name gets a suffix', async () => {
    const a = await Product.create(base());
    const b = await Product.create(base());
    expect(a.slug).toBe('cotton-fabric-roll');
    expect(b.slug).toMatch(/^cotton-fabric-roll-/);
  });
});
