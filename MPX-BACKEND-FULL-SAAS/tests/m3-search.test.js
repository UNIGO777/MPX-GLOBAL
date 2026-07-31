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

let pharmaTop;
let pharmaLeaf;
let textileTop;
let textileLeaf;
let serviceLeaf;
let verifiedOrg;
let plainOrg;

async function seedWorld() {
  pharmaTop = await Category.create({ name: 'Pharmaceuticals', slug: 'pharmaceuticals' });
  pharmaLeaf = await Category.create({
    name: 'Pharmaceutical formulations',
    parentId: pharmaTop._id,
    type: 'goods',
    synonyms: ['medicine', 'medicines', 'dawai'],
  });
  textileTop = await Category.create({ name: 'Textiles', slug: 'textiles' });
  textileLeaf = await Category.create({
    name: 'Cotton fabric',
    parentId: textileTop._id,
    type: 'goods',
    synonyms: ['kapda'],
  });
  const itTop = await Category.create({ name: 'IT Services', slug: 'it-services' });
  serviceLeaf = await Category.create({ name: 'Web development', parentId: itTop._id, type: 'service' });

  await CategoryAttribute.create({
    categoryId: textileLeaf._id,
    name: 'GSM',
    key: 'gsm',
    inputType: 'number',
    filterable: true,
  });
  await CategoryAttribute.create({
    categoryId: textileLeaf._id,
    name: 'Material',
    key: 'material',
    inputType: 'select',
    options: ['Cotton', 'Silk'],
    filterable: true,
  });

  verifiedOrg = await Organisation.create({
    name: 'TextileHub Exports',
    type: 'business',
    exporterSide: true,
    country: 'IN',
    kycStatus: 'verified',
  });
  plainOrg = await Organisation.create({
    name: 'Generic Traders',
    type: 'business',
    exporterSide: true,
    country: 'AE',
    kycStatus: 'pending',
  });
}

// Create through the model + rebuild the denorms, mirroring what the service does.
async function makeProduct({ org, leaf, name, status = 'active', price, attributes = [], ...rest }) {
  const p = await Product.create({
    exporterOrgId: org._id,
    categoryId: leaf._id,
    name,
    status,
    price: price ?? { mode: 'on_request' },
    attributes,
    sellerCountry: org.country,
    sellerVerified: org.kycStatus === 'verified',
    ...rest,
  });
  return p;
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([Organisation.deleteMany({}), Category.deleteMany({}), CategoryAttribute.deleteMany({}), Product.deleteMany({})]);
  invalidateLeafCache();
  await seedWorld();
});

describe('GET /public/search — keyword + synonym (M3-B / Part D)', () => {
  it('THE headline case: "medicines" finds a Pharmaceuticals product via synonyms', async () => {
    await makeProduct({ org: plainOrg, leaf: pharmaLeaf, name: 'Paracetamol 500mg' });
    await makeProduct({ org: plainOrg, leaf: textileLeaf, name: 'Cotton Roll' });
    await rebuildAll();

    const res = await request(app).get('/public/search').query({ q: 'medicines' });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('product');
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].name).toBe('Paracetamol 500mg');
  });

  it('English stemming makes singular/plural match without any fuzzy engine', async () => {
    await makeProduct({ org: plainOrg, leaf: pharmaLeaf, name: 'Paracetamol 500mg' });
    await rebuildAll();
    // the category synonym list holds "medicine"/"medicines"; stemming covers the rest
    for (const q of ['medicine', 'medicines']) {
      const res = await request(app).get('/public/search').query({ q });
      expect(res.body.total).toBe(1);
    }
  });

  it('matches the product name, and the SELLER company name (memo F8/K2)', async () => {
    await makeProduct({ org: verifiedOrg, leaf: textileLeaf, name: 'Premium Roll' });
    await makeProduct({ org: plainOrg, leaf: pharmaLeaf, name: 'Syrup' });
    await rebuildAll();

    const byName = await request(app).get('/public/search').query({ q: 'Premium' });
    expect(byName.body.total).toBe(1);

    const bySeller = await request(app).get('/public/search').query({ q: 'TextileHub' });
    expect(bySeller.body.total).toBe(1);
    expect(bySeller.body.products[0].name).toBe('Premium Roll');
  });

  it('availability still holds under search: draft/inactive/archived/taken-down/dead-category are absent', async () => {
    const visible = await makeProduct({ org: plainOrg, leaf: textileLeaf, name: 'Cotton Visible' });
    await makeProduct({ org: plainOrg, leaf: textileLeaf, name: 'Cotton Draft', status: 'draft' });
    await makeProduct({ org: plainOrg, leaf: textileLeaf, name: 'Cotton Inactive', status: 'inactive' });
    await makeProduct({ org: plainOrg, leaf: textileLeaf, name: 'Cotton Archived', status: 'archived' });
    await makeProduct({
      org: plainOrg,
      leaf: textileLeaf,
      name: 'Cotton Blocked',
      takedown: { isDown: true, reason: 'x', at: new Date() },
    });
    const deadTop = await Category.create({ name: 'Paper', slug: 'paper', active: false });
    const deadLeaf = await Category.create({ name: 'Kraft cotton', parentId: deadTop._id, type: 'goods' });
    await makeProduct({ org: plainOrg, leaf: deadLeaf, name: 'Cotton DeadCat' });
    await rebuildAll();
    invalidateLeafCache();

    const res = await request(app).get('/public/search').query({ q: 'cotton' });
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].id).toBe(String(visible._id));
  });
});

describe('ranking + sorting (M3-B)', () => {
  it('B7: unverified sellers are RANKED below verified but never filtered out', async () => {
    await makeProduct({ org: plainOrg, leaf: textileLeaf, name: 'Cotton Alpha' });
    await makeProduct({ org: verifiedOrg, leaf: textileLeaf, name: 'Cotton Beta' });
    await rebuildAll();

    const res = await request(app).get('/public/search').query({ q: 'cotton' });
    expect(res.body.total).toBe(2); // both present — verification never filters
    expect(res.body.products[0].seller.verified).toBe(true); // verified boosted first
    expect(JSON.stringify(res.body)).not.toContain('kycStatus');
  });

  it('verifiedOnly filters ONLY when the buyer opts in (the B7 carve-out)', async () => {
    await makeProduct({ org: plainOrg, leaf: textileLeaf, name: 'Cotton Alpha' });
    await makeProduct({ org: verifiedOrg, leaf: textileLeaf, name: 'Cotton Beta' });
    await rebuildAll();

    const res = await request(app).get('/public/search').query({ q: 'cotton', verifiedOnly: 'true' });
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].seller.verified).toBe(true);
  });

  it('price sort tiers by currency and never changes the result set (§A27.1)', async () => {
    await makeProduct({
      org: plainOrg,
      leaf: textileLeaf,
      name: 'INR Cheap',
      price: { mode: 'fixed', min: 100, currency: 'INR' },
    });
    await makeProduct({
      org: plainOrg,
      leaf: textileLeaf,
      name: 'INR Dear',
      price: { mode: 'fixed', min: 900, currency: 'INR' },
    });
    await makeProduct({
      org: plainOrg,
      leaf: textileLeaf,
      name: 'USD Cheap',
      price: { mode: 'fixed', min: 5, currency: 'USD' },
    });
    await makeProduct({ org: plainOrg, leaf: textileLeaf, name: 'On Request' });
    await rebuildAll();

    const res = await request(app).get('/public/search').query({ sort: 'priceAsc', currency: 'INR' });
    expect(res.body.total).toBe(4); // sorting never filters
    const names = res.body.products.map((p) => p.name);
    expect(names.slice(0, 2)).toEqual(['INR Cheap', 'INR Dear']); // selected currency first, ordered
    expect(names[3]).toBe('On Request'); // on-request always last
  });
});

describe('filters (M3-B)', () => {
  it('§A27.1: a price range only matches the SELECTED currency', async () => {
    await makeProduct({
      org: plainOrg,
      leaf: textileLeaf,
      name: 'INR Match',
      price: { mode: 'fixed', min: 200, currency: 'INR' },
    });
    await makeProduct({
      org: plainOrg,
      leaf: textileLeaf,
      name: 'USD Trap',
      price: { mode: 'fixed', min: 200, currency: 'USD' },
    });
    await rebuildAll();

    const res = await request(app)
      .get('/public/search')
      .query({ priceMin: 100, priceMax: 500, currency: 'INR' });
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].name).toBe('INR Match');
  });

  it('on-request products need their own toggle — a price range must not silently drop them', async () => {
    await makeProduct({ org: plainOrg, leaf: textileLeaf, name: 'On Request' });
    await makeProduct({
      org: plainOrg,
      leaf: textileLeaf,
      name: 'Priced',
      price: { mode: 'fixed', min: 200, currency: 'INR' },
    });
    await rebuildAll();

    const ranged = await request(app).get('/public/search').query({ priceMin: 100, priceMax: 500 });
    expect(ranged.body.products.map((p) => p.name)).toEqual(['Priced']);

    const onRequest = await request(app).get('/public/search').query({ onRequest: 'true' });
    expect(onRequest.body.products.map((p) => p.name)).toEqual(['On Request']);
  });

  it('attribute filters: bracket VALUES (OR) and bracket RANGE (numbers only)', async () => {
    await makeProduct({
      org: plainOrg,
      leaf: textileLeaf,
      name: 'Cotton 120',
      attributes: [{ key: 'gsm', value: 120 }, { key: 'material', value: 'Cotton' }],
    });
    await makeProduct({
      org: plainOrg,
      leaf: textileLeaf,
      name: 'Silk 200',
      attributes: [{ key: 'gsm', value: 200 }, { key: 'material', value: 'Silk' }],
    });
    await rebuildAll();

    const byValue = await request(app)
      .get('/public/search')
      .query({ category: 'cotton-fabric', 'attr[material]': 'Cotton' });
    expect(byValue.body.products.map((p) => p.name)).toEqual(['Cotton 120']);

    const byRange = await request(app)
      .get('/public/search')
      .query({ category: 'cotton-fabric', 'attr[gsm][min]': 150, 'attr[gsm][max]': 250 });
    expect(byRange.body.products.map((p) => p.name)).toEqual(['Silk 200']);

    // OR within a group
    const both = await request(app)
      .get('/public/search')
      .query({ category: 'cotton-fabric', 'attr[material]': 'Cotton,Silk' });
    expect(both.body.total).toBe(2);
  });

  it('rejects an unknown attribute key, a range on a non-number attribute, and a DOTTED param', async () => {
    const unknown = await request(app)
      .get('/public/search')
      .query({ category: 'cotton-fabric', 'attr[voltage]': '5' });
    expect(unknown.status).toBe(400);

    const badRange = await request(app)
      .get('/public/search')
      .query({ category: 'cotton-fabric', 'attr[material][min]': 1 });
    expect(badRange.status).toBe(400);

    // The dotted form is stopped by rejectMongoOperators before the controller —
    // this is why the API uses bracket notation at all.
    const dotted = await request(app).get('/public/search').query({ 'attr.gsm': '120' });
    expect(dotted.status).toBe(400);
  });

  it('filters by category (top or leaf), country and goods/service', async () => {
    await makeProduct({ org: verifiedOrg, leaf: textileLeaf, name: 'IN Cotton' }); // IN
    await makeProduct({ org: plainOrg, leaf: pharmaLeaf, name: 'AE Syrup' }); // AE
    await makeProduct({ org: plainOrg, leaf: serviceLeaf, name: 'Web Build' }); // service
    await rebuildAll();

    expect((await request(app).get('/public/search').query({ category: 'textiles' })).body.total).toBe(1);
    expect((await request(app).get('/public/search').query({ category: 'cotton-fabric' })).body.total).toBe(1);
    expect((await request(app).get('/public/search').query({ country: 'AE' })).body.total).toBe(2);
    expect(
      (await request(app).get('/public/search').query({ goodsOrService: 'service' })).body.total,
    ).toBe(1);
  });
});

describe('suppliers mode (§A27.3)', () => {
  it('matches company name/description, returns the public projection + batched productCount', async () => {
    await makeProduct({ org: verifiedOrg, leaf: textileLeaf, name: 'Live A' });
    await makeProduct({ org: verifiedOrg, leaf: textileLeaf, name: 'Hidden', status: 'inactive' });
    await rebuildAll();

    const res = await request(app).get('/public/search').query({ type: 'supplier', q: 'TextileHub' });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('supplier');
    expect(res.body.total).toBe(1);
    const seller = res.body.suppliers[0];
    expect(seller.name).toBe('TextileHub Exports');
    expect(seller.verified).toBe(true);
    expect(seller.productCount).toBe(1); // live listings only
    expect(seller).not.toHaveProperty('kycStatus');
    expect(seller).not.toHaveProperty('website');
  });

  it('sellers with ZERO live listings still appear (B7 — profiles are public from signup)', async () => {
    const res = await request(app).get('/public/search').query({ type: 'supplier' });
    expect(res.body.total).toBe(2);
    expect(res.body.suppliers.every((s) => s.productCount === 0)).toBe(true);
  });

  it('400s product-only params instead of silently ignoring them', async () => {
    for (const query of [
      { type: 'supplier', category: 'textiles' },
      { type: 'supplier', priceMin: 10 },
      { type: 'supplier', moqMin: 5 },
      { type: 'supplier', sort: 'priceAsc' },
      { type: 'supplier', 'attr[gsm]': '120' },
    ]) {
      const res = await request(app).get('/public/search').query(query);
      expect(res.status).toBe(400);
    }
  });
});

describe('projection + paging (M3-B / Part D)', () => {
  it('a search row is EXACTLY a browse row — same whitelist, no denorms, no takedown', async () => {
    const p = await makeProduct({ org: verifiedOrg, leaf: textileLeaf, name: 'Cotton Roll' });
    await rebuildAll();

    const search = await request(app).get('/public/search').query({ q: 'cotton' });
    const browse = await request(app).get('/public/products');
    expect(search.body.products[0]).toEqual(browse.body.products[0]);

    const body = JSON.stringify(search.body);
    for (const forbidden of ['searchKeywords', 'categoryType', 'topCategoryId', 'sellerCountry', 'sellerVerified', 'takedown', 'exporterOrgId', 'publicId']) {
      expect(body).not.toContain(forbidden);
    }
    expect(search.body.products[0].id).toBe(String(p._id));
  });

  it('pageSize is capped and paging works', async () => {
    for (let i = 0; i < 3; i += 1) {
      await makeProduct({ org: plainOrg, leaf: textileLeaf, name: `Cotton ${i}` });
    }
    await rebuildAll();

    expect((await request(app).get('/public/search').query({ pageSize: 9999 })).status).toBe(400);
    const page = await request(app).get('/public/search').query({ page: 2, pageSize: 2 });
    expect(page.body.total).toBe(3);
    expect(page.body.products).toHaveLength(1);
  });
});
