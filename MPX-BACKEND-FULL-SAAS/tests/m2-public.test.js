import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { Organisation } from '../src/models/Organisation.js';
import { Category } from '../src/models/Category.js';
import { Product } from '../src/models/Product.js';
import { invalidateLeafCache } from '../src/services/category.service.js';

const app = createApp();
let seq = 0;

async function makeOrg({ verified = false } = {}) {
  seq += 1;
  return Organisation.create({
    name: `Seller Co ${seq}`,
    type: 'business',
    exporterSide: true,
    country: 'IN',
    kycStatus: verified ? 'verified' : 'pending',
  });
}

let top;
let leaf;
let offTop;
let offLeaf;

async function makeTree() {
  top = await Category.create({ name: 'Textiles', slug: 'textiles' });
  leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
  offTop = await Category.create({ name: 'Paper', slug: 'paper', active: false });
  offLeaf = await Category.create({ name: 'Kraft paper', parentId: offTop._id, type: 'goods' });
}

function productDoc(org, extra = {}) {
  seq += 1;
  return {
    exporterOrgId: org._id,
    categoryId: leaf._id,
    name: `Cotton Roll ${seq}`,
    description: 'Fine cotton',
    images: [{ url: 'https://res.cloudinary.com/fake/p1.jpg', publicId: `mpx/products/${org._id}/p1` }],
    price: { mode: 'range', min: 100, max: 150, currency: 'INR' },
    moq: 500,
    unit: 'meter',
    attributes: [{ key: 'gsm', value: 140 }],
    status: 'active',
    sellerCountry: 'IN',
    ...extra,
  };
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([Organisation.deleteMany({}), Category.deleteMany({}), Product.deleteMany({})]);
  invalidateLeafCache();
  await makeTree();
});

describe('GET /public/products — query-level availability (M2-F / Part D)', () => {
  it('returns ONLY active+visible rows: draft/inactive/archived/taken-down/dead-category all absent', async () => {
    const org = await makeOrg();
    const visible = await Product.create(productDoc(org));
    await Product.create(productDoc(org, { status: 'draft' }));
    await Product.create(productDoc(org, { status: 'inactive' }));
    await Product.create(productDoc(org, { status: 'archived' }));
    await Product.create(productDoc(org, { takedown: { isDown: true, reason: 'x', at: new Date() } }));
    await Product.create(productDoc(org, { categoryId: offLeaf._id })); // active but in a dead tree

    const res = await request(app).get('/public/products');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].id).toBe(String(visible._id));
  });

  it('category filter accepts a TOP (its leaves) and a LEAF, by slug; seller filter serves the seller page', async () => {
    const orgA = await makeOrg();
    const orgB = await makeOrg();
    await Product.create(productDoc(orgA));
    await Product.create(productDoc(orgB));

    const byTop = await request(app).get('/public/products').query({ category: 'textiles' });
    expect(byTop.body.total).toBe(2);
    const byLeaf = await request(app).get('/public/products').query({ category: 'cotton-fabric' });
    expect(byLeaf.body.total).toBe(2);
    const bySeller = await request(app).get('/public/products').query({ seller: String(orgA._id) });
    expect(bySeller.body.total).toBe(1);
    expect(bySeller.body.products[0].seller.name).toBe(orgA.name);

    const unknownCat = await request(app).get('/public/products').query({ category: 'paper' }); // inactive top
    expect(unknownCat.body.total).toBe(0);
  });

  it('pageSize is capped (9999 → 400) and pagination is stable', async () => {
    const org = await makeOrg();
    await Product.create(productDoc(org));
    expect((await request(app).get('/public/products').query({ pageSize: 9999 })).status).toBe(400);
    const page = await request(app).get('/public/products').query({ page: 1, pageSize: 1 });
    expect(page.body.products).toHaveLength(1);
  });
});

describe('public product projection (M2-F / Part D whitelist)', () => {
  it('detail returns EXACTLY the whitelist keys — takedown/ids/denorms/status never serialised', async () => {
    const org = await makeOrg({ verified: true });
    const p = await Product.create(
      productDoc(org, { takedown: { isDown: false, reason: 'old', byUserId: new mongoose.Types.ObjectId() } }),
    );

    const res = await request(app).get(`/public/products/${p._id}`);
    expect(res.status).toBe(200);
    const keys = Object.keys(res.body.product).sort();
    expect(keys).toEqual(
      [
        'attributes',
        'category',
        'countryOfOrigin',
        'deliveryModel',
        'description',
        'engagementType',
        'hsCode',
        'id',
        'images',
        'leadTime',
        'listedSince',
        'moq',
        'name',
        'packaging',
        'price',
        'pricingModel',
        'seller',
        'slug',
        'supplyAbility',
        'teamSize',
        'terms',
        'timeline',
        'unit',
      ].sort(),
    );

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('takedown');
    expect(body).not.toContain('exporterOrgId');
    expect(body).not.toContain('sellerCountry');
    expect(body).not.toContain('sellerVerified');
    expect(body).not.toContain('publicId');
    expect(body).not.toContain('kycStatus');
    expect(res.body.product.images).toEqual(['https://res.cloudinary.com/fake/p1.jpg']);
    expect(res.body.product.attributes).toEqual([{ key: 'gsm', value: 140 }]);

    // seller block = the org's public projection with the derived tick (B7)
    expect(res.body.product.seller.verified).toBe(true);
    expect(res.body.product.seller.slug).toBeTruthy();
    // category block through the category whitelist (no order/synonyms/active)
    expect(res.body.product.category.slug).toBe('cotton-fabric');
    expect(res.body.product.category).not.toHaveProperty('synonyms');
    expect(res.body.product.category).not.toHaveProperty('order');
  });

  it('detail works by id AND by slug; non-public rows 404 both ways', async () => {
    const org = await makeOrg();
    const p = await Product.create(productDoc(org));
    const hidden = await Product.create(productDoc(org, { status: 'inactive' }));

    expect((await request(app).get(`/public/products/${p._id}`)).status).toBe(200);
    expect((await request(app).get(`/public/products/${p.slug}`)).status).toBe(200);
    expect((await request(app).get(`/public/products/${hidden._id}`)).status).toBe(404);
    expect((await request(app).get(`/public/products/${hidden.slug}`)).status).toBe(404);
  });
});

describe('§9b productCount on GET /exporters/:id (M2-F)', () => {
  it('counts LIVE listings only — inactive/draft/archived/taken-down excluded', async () => {
    const org = await makeOrg();
    await Product.create(productDoc(org)); // counts
    await Product.create(productDoc(org)); // counts
    await Product.create(productDoc(org, { status: 'inactive' }));
    await Product.create(productDoc(org, { status: 'draft' }));
    await Product.create(productDoc(org, { takedown: { isDown: true, reason: 'x', at: new Date() } }));

    const res = await request(app).get(`/exporters/${org._id}`);
    expect(res.status).toBe(200);
    expect(res.body.exporter.productCount).toBe(2);
  });
});
