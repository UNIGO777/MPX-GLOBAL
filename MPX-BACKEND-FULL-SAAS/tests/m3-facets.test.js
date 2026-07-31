import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { Organisation } from '../src/models/Organisation.js';
import { Category } from '../src/models/Category.js';
import { CategoryAttribute } from '../src/models/CategoryAttribute.js';
import { Product } from '../src/models/Product.js';
import { invalidateLeafCache } from '../src/services/category.service.js';
import { rebuildAll } from '../src/services/searchSync.service.js';

const app = createApp();

let textileTop;
let cottonLeaf;
let silkLeaf;
let serviceLeaf;
let inOrg;
let aeOrg;

async function seedWorld() {
  textileTop = await Category.create({ name: 'Textiles', slug: 'textiles' });
  cottonLeaf = await Category.create({ name: 'Cotton fabric', parentId: textileTop._id, type: 'goods' });
  silkLeaf = await Category.create({ name: 'Silk fabric', parentId: textileTop._id, type: 'goods' });
  const itTop = await Category.create({ name: 'IT Services', slug: 'it-services' });
  serviceLeaf = await Category.create({ name: 'Web development', parentId: itTop._id, type: 'service' });

  // `gsm` exists on BOTH leaves (so it survives the top-level intersection);
  // `weave` only on cotton (so it must NOT show when the TOP is selected).
  for (const leaf of [cottonLeaf, silkLeaf]) {
    await CategoryAttribute.create({
      categoryId: leaf._id,
      name: 'GSM',
      key: 'gsm',
      inputType: 'number',
      unit: 'gsm',
      filterable: true,
    });
    await CategoryAttribute.create({
      categoryId: leaf._id,
      name: 'Material',
      key: 'material',
      inputType: 'select',
      options: ['Cotton', 'Silk'],
      filterable: true,
    });
  }
  await CategoryAttribute.create({
    categoryId: cottonLeaf._id,
    name: 'Weave',
    key: 'weave',
    inputType: 'select',
    options: ['Plain', 'Twill'],
    filterable: true,
  });
  // not filterable → must never appear as a facet
  await CategoryAttribute.create({
    categoryId: cottonLeaf._id,
    name: 'Notes',
    key: 'notes',
    inputType: 'text',
    filterable: false,
  });

  inOrg = await Organisation.create({
    name: 'India Mills',
    type: 'business',
    exporterSide: true,
    country: 'IN',
    kycStatus: 'verified',
  });
  aeOrg = await Organisation.create({
    name: 'Dubai Traders',
    type: 'business',
    exporterSide: true,
    country: 'AE',
    kycStatus: 'pending',
  });
}

async function makeProduct({ org, leaf, name, attributes = [], price, moq }) {
  return Product.create({
    exporterOrgId: org._id,
    categoryId: leaf._id,
    name,
    status: 'active',
    attributes,
    price: price ?? { mode: 'on_request' },
    moq,
    sellerCountry: org.country,
    sellerVerified: org.kycStatus === 'verified',
  });
}

const facets = (query = {}) => request(app).get('/public/facets').query(query);

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([
    Organisation.deleteMany({}),
    Category.deleteMany({}),
    CategoryAttribute.deleteMany({}),
    Product.deleteMany({}),
  ]);
  invalidateLeafCache();
  await seedWorld();
});

describe('standard facets (M3-C)', () => {
  it('counts by top category, country, type and verified — active rows only', async () => {
    await makeProduct({ org: inOrg, leaf: cottonLeaf, name: 'Cotton A' });
    await makeProduct({ org: aeOrg, leaf: silkLeaf, name: 'Silk B' });
    await makeProduct({ org: aeOrg, leaf: serviceLeaf, name: 'Web C' });
    await Product.create({
      exporterOrgId: inOrg._id,
      categoryId: cottonLeaf._id,
      name: 'Draft D',
      status: 'draft',
      sellerCountry: 'IN',
    });
    await rebuildAll();

    const res = await facets();
    expect(res.status).toBe(200);
    const f = res.body.facets;

    const textiles = f.category.find((c) => c.slug === 'textiles');
    expect(textiles.count).toBe(2); // draft excluded
    expect(f.country).toEqual(
      expect.arrayContaining([
        { value: 'AE', count: 2 },
        { value: 'IN', count: 1 },
      ]),
    );
    expect(f.goodsOrService).toEqual(
      expect.arrayContaining([
        { value: 'goods', count: 2 },
        { value: 'service', count: 1 },
      ]),
    );
    expect(f.verified).toEqual(
      expect.arrayContaining([
        { value: true, count: 1 },
        { value: false, count: 2 },
      ]),
    );
  });

  it('drills into LEAVES whenever a branch is chosen — even a top with a single sub (review fix)', async () => {
    await makeProduct({ org: inOrg, leaf: cottonLeaf, name: 'Cotton A' });
    await makeProduct({ org: aeOrg, leaf: silkLeaf, name: 'Silk B' });
    await makeProduct({ org: aeOrg, leaf: serviceLeaf, name: 'Web C' });
    await rebuildAll();

    // Nothing selected → TOP categories.
    const tops = (await facets()).body.facets.category.map((c) => c.slug);
    expect(tops).toEqual(expect.arrayContaining(['textiles', 'it-services']));

    // A multi-leaf top → its leaves, scoped to that branch (no foreign leaves).
    const textiles = (await facets({ category: 'textiles' })).body.facets.category.map((c) => c.slug);
    expect(textiles.sort()).toEqual(['cotton-fabric', 'silk-fabric']);

    // A SINGLE-leaf top used to fall through to top-level counts — it must not.
    const itLeaves = (await facets({ category: 'it-services' })).body.facets.category.map((c) => c.slug);
    expect(itLeaves).toEqual(['web-development']);

    // Selecting a LEAF shows its siblings, still scoped to the branch.
    const siblings = (await facets({ category: 'cotton-fabric' })).body.facets.category.map((c) => c.slug);
    expect(siblings.sort()).toEqual(['cotton-fabric', 'silk-fabric']);
  });

  it('§A27.2: a group\'s counts EXCLUDE its own selection but respect the others', async () => {
    await makeProduct({ org: inOrg, leaf: cottonLeaf, name: 'IN Cotton' });
    await makeProduct({ org: aeOrg, leaf: cottonLeaf, name: 'AE Cotton' });
    await makeProduct({ org: aeOrg, leaf: serviceLeaf, name: 'AE Web' });
    await rebuildAll();

    // Selecting country=IN must NOT make AE read 0 — the buyer has to see what
    // switching would yield.
    const res = await facets({ country: 'IN' });
    const f = res.body.facets;
    expect(f.country).toEqual(
      expect.arrayContaining([
        { value: 'IN', count: 1 },
        { value: 'AE', count: 2 },
      ]),
    );
    // …but the OTHER groups do respect country=IN.
    expect(f.goodsOrService).toEqual([{ value: 'goods', count: 1 }]);
  });

  it('§A27.1: price bounds are currency-scoped and echo the currency; MOQ hidden for services', async () => {
    await makeProduct({
      org: inOrg,
      leaf: cottonLeaf,
      name: 'INR 100',
      price: { mode: 'fixed', min: 100, currency: 'INR' },
      moq: 50,
    });
    await makeProduct({
      org: inOrg,
      leaf: cottonLeaf,
      name: 'INR 900',
      price: { mode: 'fixed', min: 900, currency: 'INR' },
      moq: 500,
    });
    await makeProduct({
      org: aeOrg,
      leaf: cottonLeaf,
      name: 'USD 5',
      price: { mode: 'fixed', min: 5, currency: 'USD' },
    });
    await rebuildAll();

    const inr = (await facets({ currency: 'INR' })).body.facets;
    expect(inr.price).toEqual({ min: 100, max: 900, currency: 'INR' }); // USD 5 ignored
    expect(inr.moq).toEqual({ min: 50, max: 500 });

    const usd = (await facets({ currency: 'USD' })).body.facets;
    expect(usd.price).toEqual({ min: 5, max: 5, currency: 'USD' });

    // goods-only facets do not render for a service category
    const service = (await facets({ goodsOrService: 'service' })).body.facets;
    expect(service.moq).toBeNull();
  });
});

describe('dynamic attribute facets (M3-C)', () => {
  it('appear only with a category, only when filterable, with counts and number bounds', async () => {
    await makeProduct({
      org: inOrg,
      leaf: cottonLeaf,
      name: 'Cotton 120',
      attributes: [{ key: 'gsm', value: 120 }, { key: 'material', value: 'Cotton' }, { key: 'notes', value: 'x' }],
    });
    await makeProduct({
      org: aeOrg,
      leaf: cottonLeaf,
      name: 'Cotton 200',
      attributes: [{ key: 'gsm', value: 200 }, { key: 'material', value: 'Silk' }],
    });
    await rebuildAll();

    expect((await facets()).body.facets.attributes).toEqual([]); // no category → none

    const f = (await facets({ category: 'cotton-fabric' })).body.facets;
    const keys = f.attributes.map((a) => a.key);
    expect(keys).toContain('gsm');
    expect(keys).toContain('material');
    expect(keys).not.toContain('notes'); // filterable:false

    const gsm = f.attributes.find((a) => a.key === 'gsm');
    expect(gsm.inputType).toBe('number');
    expect(gsm.unit).toBe('gsm');
    expect(gsm.bounds).toEqual({ min: 120, max: 200 });

    const material = f.attributes.find((a) => a.key === 'material');
    expect(material.options).toEqual(
      expect.arrayContaining([
        { value: 'Cotton', count: 1 },
        { value: 'Silk', count: 1 },
      ]),
    );
  });

  it('a TOP shows the INTERSECTION of its leaves\' keys, not the union', async () => {
    await makeProduct({ org: inOrg, leaf: cottonLeaf, name: 'C', attributes: [{ key: 'gsm', value: 120 }] });
    await makeProduct({ org: inOrg, leaf: silkLeaf, name: 'S', attributes: [{ key: 'gsm', value: 90 }] });
    await rebuildAll();

    const keys = (await facets({ category: 'textiles' })).body.facets.attributes.map((a) => a.key);
    expect(keys).toContain('gsm'); // on both leaves
    expect(keys).toContain('material'); // on both leaves
    expect(keys).not.toContain('weave'); // cotton only → excluded at top level
  });

  it('a leaf with NO filterable attributes still vetoes a key at top level (review fix)', async () => {
    // Denim sits under Textiles and defines nothing filterable, so `gsm` (which
    // cotton and silk both have) must NOT be offered when the TOP is selected.
    const denim = await Category.create({ name: 'Denim', parentId: textileTop._id, type: 'goods' });
    await makeProduct({ org: inOrg, leaf: cottonLeaf, name: 'C', attributes: [{ key: 'gsm', value: 120 }] });
    await makeProduct({ org: inOrg, leaf: silkLeaf, name: 'S', attributes: [{ key: 'gsm', value: 90 }] });
    await makeProduct({ org: inOrg, leaf: denim, name: 'D' });
    await rebuildAll();

    const keys = (await facets({ category: 'textiles' })).body.facets.attributes.map((a) => a.key);
    expect(keys).not.toContain('gsm');
    expect(keys).toEqual([]); // nothing is common to all three leaves

    // …but selecting the leaf itself still offers it.
    const leafKeys = (await facets({ category: 'cotton-fabric' })).body.facets.attributes.map((a) => a.key);
    expect(leafKeys).toContain('gsm');
  });

  it('an attribute\'s own selection does not zero out its siblings (§A27.2)', async () => {
    await makeProduct({
      org: inOrg,
      leaf: cottonLeaf,
      name: 'Cotton one',
      attributes: [{ key: 'material', value: 'Cotton' }],
    });
    await makeProduct({
      org: inOrg,
      leaf: cottonLeaf,
      name: 'Silk one',
      attributes: [{ key: 'material', value: 'Silk' }],
    });
    await rebuildAll();

    const f = (await facets({ category: 'cotton-fabric', 'attr[material]': 'Cotton' })).body.facets;
    const material = f.attributes.find((a) => a.key === 'material');
    expect(material.options).toEqual(
      expect.arrayContaining([
        { value: 'Cotton', count: 1 },
        { value: 'Silk', count: 1 }, // still visible — the point of A27.2
      ]),
    );
  });

  it('honours the keyword query — facets describe the CURRENT search', async () => {
    await makeProduct({ org: inOrg, leaf: cottonLeaf, name: 'Premium Roll' });
    await makeProduct({ org: aeOrg, leaf: cottonLeaf, name: 'Basic Roll' });
    await rebuildAll();

    const f = (await facets({ q: 'Premium' })).body.facets;
    expect(f.country).toEqual([{ value: 'IN', count: 1 }]);
  });
});

describe('supplier-mode facets (§A27.3)', () => {
  it('returns country + verified only', async () => {
    const res = await facets({ type: 'supplier' });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.facets).sort()).toEqual(['country', 'verified']);
    expect(res.body.facets.country).toEqual(
      expect.arrayContaining([
        { value: 'IN', count: 1 },
        { value: 'AE', count: 1 },
      ]),
    );
    expect(res.body.facets.verified).toEqual(
      expect.arrayContaining([
        { value: true, count: 1 },
        { value: false, count: 1 },
      ]),
    );
  });

  it('rejects product-only params exactly like search does', async () => {
    expect((await facets({ type: 'supplier', category: 'textiles' })).status).toBe(400);
    expect((await facets({ type: 'supplier', priceMin: 10 })).status).toBe(400);
  });
});
