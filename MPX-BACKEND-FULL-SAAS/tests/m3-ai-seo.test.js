import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// The OpenAI call is mocked everywhere — no network, no key needed. One live
// integration check is skipped unless OPENAI_API_KEY is present.
const { aiBox } = vi.hoisted(() => ({ aiBox: { reply: null, error: null, calls: [] } }));
vi.mock('../src/services/ai.client.js', () => ({
  isAiConfigured: () => true,
  completeJson: vi.fn(async ({ system, user }) => {
    aiBox.calls.push({ system, user });
    if (aiBox.error) throw aiBox.error;
    return aiBox.reply;
  }),
}));

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { Category } = await import('../src/models/Category.js');
const { CategoryAttribute } = await import('../src/models/CategoryAttribute.js');
const { Product } = await import('../src/models/Product.js');
const { invalidateLeafCache } = await import('../src/services/category.service.js');
const { invalidateDidYouMeanCache } = await import('../src/services/didYouMean.service.js');
const { invalidateSitemapCache } = await import('../src/services/seo.service.js');
const { rebuildAll } = await import('../src/services/searchSync.service.js');

const app = createApp();

let pharmaTop;
let pharmaLeaf;
let inOrg;

async function seedWorld() {
  pharmaTop = await Category.create({ name: 'Pharmaceuticals', slug: 'pharmaceuticals' });
  pharmaLeaf = await Category.create({
    name: 'Pharmaceutical formulations',
    parentId: pharmaTop._id,
    type: 'goods',
    synonyms: ['medicine', 'medicines', 'dawai'],
  });
  await CategoryAttribute.create({
    categoryId: pharmaLeaf._id,
    name: 'Form',
    key: 'form',
    inputType: 'select',
    options: ['Tablet', 'Syrup'],
    filterable: true,
  });

  inOrg = await Organisation.create({
    name: 'India Pharma',
    type: 'business',
    exporterSide: true,
    country: 'IN',
    kycStatus: 'verified',
  });

  await Product.create({
    exporterOrgId: inOrg._id,
    categoryId: pharmaLeaf._id,
    name: 'Paracetamol 500mg',
    status: 'active',
    price: { mode: 'fixed', min: 50, currency: 'INR' },
    attributes: [{ key: 'form', value: 'Tablet' }],
    sellerCountry: 'IN',
    sellerVerified: true,
  });
  await rebuildAll();
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
  invalidateDidYouMeanCache();
  invalidateSitemapCache();
  aiBox.reply = null;
  aiBox.error = null;
  aiBox.calls = [];
  await seedWorld();
});

describe('POST /search/ai — happy path (M3-E)', () => {
  it('translates a sentence into real filters and runs the SAME engine', async () => {
    aiBox.reply = JSON.stringify({
      target: 'product',
      keywords: ['paracetamol'],
      category: 'Pharmaceuticals',
      priceMax: 100,
      country: 'IN',
      attributes: { form: 'Tablet' },
      verifiedOnly: true,
    });

    const res = await request(app).post('/search/ai').send({ query: 'cheap paracetamol tablets from India' });
    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(false);
    expect(res.body.type).toBe('product');
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].name).toBe('Paracetamol 500mg');
    expect(res.body.extracted.category).toBe('pharmaceuticals');
    expect(res.body.extracted.attributes).toEqual({ form: 'Tablet' });
    expect(res.body.answer).toContain('Found 1');

    // Results carry the SAME public projection as every other surface.
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('kycStatus');
    expect(body).not.toContain('searchKeywords');
  });

  it('injects only the TOP categories + synonyms into the prompt (cost/§A26)', async () => {
    aiBox.reply = JSON.stringify({ target: 'product', keywords: ['x'] });
    await request(app).post('/search/ai').send({ query: 'anything' });

    const { system } = aiBox.calls[0];
    expect(system).toContain('Pharmaceuticals');
    expect(system).toContain('dawai'); // synonyms are injected
    expect(system).not.toContain('Pharmaceutical formulations'); // sub-categories are NOT
    expect(system).not.toContain('Form'); // attributes are NOT — validated post-hoc
  });
});

describe('POST /search/ai — guardrails (M3-E)', () => {
  it('DROPS a hallucinated category — and its attributes with it (they cannot be validated)', async () => {
    aiBox.reply = JSON.stringify({
      target: 'product',
      keywords: ['paracetamol'],
      category: 'Interplanetary Mining', // does not exist
      attributes: { form: 'Tablet' },
    });

    const res = await request(app).post('/search/ai').send({ query: 'paracetamol' });
    expect(res.status).toBe(200);
    expect(res.body.extracted.category).toBeNull();
    // memo I11: "only use attribute keys that belong to the RESOLVED category" —
    // with no category resolved there is nothing to validate against, so they go.
    expect(res.body.extracted.attributes).toEqual({});
    expect(res.body.total).toBe(1); // the keyword search still works
  });

  it('with a REAL category, keeps the valid attribute and drops the bogus one', async () => {
    aiBox.reply = JSON.stringify({
      target: 'product',
      keywords: ['paracetamol'],
      category: 'Pharmaceuticals',
      attributes: { warpFactor: '9', form: 'Tablet', unknownKey: 'x' },
    });

    const res = await request(app).post('/search/ai').send({ query: 'paracetamol' });
    expect(res.body.extracted.attributes).toEqual({ form: 'Tablet' });
    expect(res.body.total).toBe(1);
  });

  it('drops a select value that is not one of the attribute\'s options', async () => {
    aiBox.reply = JSON.stringify({
      target: 'product',
      keywords: ['paracetamol'],
      category: 'Pharmaceuticals',
      attributes: { form: 'Injection' }, // options are Tablet | Syrup
    });

    const res = await request(app).post('/search/ai').send({ query: 'paracetamol' });
    expect(res.body.extracted.attributes).toEqual({});
    expect(res.body.total).toBe(1);
  });

  it('falls back to keyword search on malformed JSON, and on a timeout/API error', async () => {
    aiBox.reply = 'this is not json at all';
    let res = await request(app).post('/search/ai').send({ query: 'paracetamol' });
    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.total).toBe(1); // keyword search still found it

    aiBox.error = new Error('timeout of 8000ms exceeded');
    res = await request(app).post('/search/ai').send({ query: 'paracetamol' });
    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.total).toBe(1);
  });

  it('never leaks key material or the raw provider payload', async () => {
    aiBox.error = Object.assign(new Error('401 Incorrect API key provided: sk-test-SECRET'), { status: 401 });
    const res = await request(app).post('/search/ai').send({ query: 'paracetamol' });
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('sk-test');
    expect(body).not.toContain('API key');
  });

  it('validates the input: too short, missing, or a non-string is 400', async () => {
    expect((await request(app).post('/search/ai').send({})).status).toBe(400);
    expect((await request(app).post('/search/ai').send({ query: 'a' })).status).toBe(400);
    expect((await request(app).post('/search/ai').send({ query: { $ne: '' } })).status).toBe(400);
    expect((await request(app).post('/search/ai').send({ query: 'x'.repeat(600) })).status).toBe(400);
  });

  it('guests may call it (no auth required) — the route is public', async () => {
    aiBox.reply = JSON.stringify({ target: 'product', keywords: ['paracetamol'] });
    const res = await request(app).post('/search/ai').send({ query: 'paracetamol' });
    expect(res.status).toBe(200);
  });

  it('routes a supplier-intent query to the suppliers engine', async () => {
    aiBox.reply = JSON.stringify({ target: 'supplier', keywords: ['pharma'], country: 'IN' });
    const res = await request(app).post('/search/ai').send({ query: 'pharma suppliers in india' });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('supplier');
    expect(res.body.suppliers[0].name).toBe('India Pharma');
    expect(res.body.suppliers[0]).not.toHaveProperty('kycStatus');
  });
});

describe('did you mean (M3-G)', () => {
  it('suggests a category on a ZERO-result typo, and stays silent otherwise', async () => {
    const typo = await request(app).get('/public/search').query({ q: 'medisin' });
    expect(typo.body.total).toBe(0);
    expect(typo.body.didYouMean).toEqual({ term: 'medicine', categorySlug: 'pharmaceutical-formulations' });

    // A successful query gets no suggestion…
    const hit = await request(app).get('/public/search').query({ q: 'paracetamol' });
    expect(hit.body.total).toBe(1);
    expect(hit.body.didYouMean).toBeNull();

    // …and nonsense is not force-matched.
    const nonsense = await request(app).get('/public/search').query({ q: 'zzzzqqqq' });
    expect(nonsense.body.total).toBe(0);
    expect(nonsense.body.didYouMean).toBeNull();
  });

  it('also fires after an AI fallback that found nothing', async () => {
    aiBox.error = new Error('provider down');
    const res = await request(app).post('/search/ai').send({ query: 'medisin' });
    expect(res.body.fallback).toBe(true);
    expect(res.body.total).toBe(0);
    expect(res.body.didYouMean.term).toBe('medicine');
  });
});

describe('SEO endpoints (M3-F)', () => {
  it('sitemap lists ONLY public entities, with absolute URLs and slugs', async () => {
    // things that must NOT appear
    await Product.create({
      exporterOrgId: inOrg._id,
      categoryId: pharmaLeaf._id,
      name: 'Hidden Draft',
      status: 'draft',
    });
    await Product.create({
      exporterOrgId: inOrg._id,
      categoryId: pharmaLeaf._id,
      name: 'Gone Archived',
      status: 'archived',
    });
    await Product.create({
      exporterOrgId: inOrg._id,
      categoryId: pharmaLeaf._id,
      name: 'Blocked One',
      status: 'active',
      takedown: { isDown: true, reason: 'x', at: new Date() },
    });
    const deadTop = await Category.create({ name: 'Paper', slug: 'paper', active: false });
    invalidateLeafCache();
    invalidateSitemapCache();

    const res = await request(app).get('/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('xml');
    const xml = res.text;

    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('http://localhost:5173/product/paracetamol-500mg'); // absolute + slug
    expect(xml).toContain('/supplier/india-pharma');
    expect(xml).toContain('/category/pharmaceuticals');
    // subs use the canonical NESTED form only
    expect(xml).toContain('/category/pharmaceuticals/pharmaceutical-formulations');

    expect(xml).not.toContain('hidden-draft');
    expect(xml).not.toContain('gone-archived');
    expect(xml).not.toContain('blocked-one');
    expect(xml).not.toContain(`/category/${deadTop.slug}`);
    expect(xml).not.toMatch(/[0-9a-f]{24}/); // never raw ObjectIds
  });

  it('robots.txt disallows search + filtered URLs and points at the sitemap', async () => {
    const res = await request(app).get('/robots.txt');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('Disallow: /search');
    expect(res.text).toContain('Sitemap: http://localhost:5173/sitemap.xml');
  });
});
