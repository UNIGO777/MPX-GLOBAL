import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import { Category } from '../src/models/Category.js';
import { Product } from '../src/models/Product.js';
import { ErrorLog } from '../src/models/ErrorLog.js';
import { persistErrorLog } from '../src/middleware/errorHandler.js';
import { signAccessToken } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';

const app = createApp();
let seq = 0;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Organisation.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    ErrorLog.deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
  ]);
});

describe('errorLogs (A19, M2-I)', () => {
  it('persists a shaped 5xx entry — no body, no headers, no secrets', async () => {
    const fakeReq = {
      originalUrl: '/products',
      method: 'POST',
      id: 'req-123',
      user: { userId: String(new mongoose.Types.ObjectId()), orgId: String(new mongoose.Types.ObjectId()) },
      body: { password: 'super-secret', kycDocuments: ['x'] },
      headers: { authorization: 'Bearer tok' },
    };
    await persistErrorLog({ err: new Error('boom'), req: fakeReq, statusCode: 500 });

    const row = await ErrorLog.findOne({ requestId: 'req-123' });
    expect(row).toBeTruthy();
    expect(row.statusCode).toBe(500);
    expect(row.message).toBe('boom');
    expect(row.route).toBe('/products');
    const serialised = JSON.stringify(row.toObject());
    expect(serialised).not.toContain('super-secret');
    expect(serialised).not.toContain('Bearer tok');
  });

  it('a 4xx request writes NO errorLogs row (errors only — not an application log)', async () => {
    const res = await request(app).post('/auth/login').send({}); // 400 validation
    expect(res.status).toBe(400);
    expect(await ErrorLog.countDocuments({})).toBe(0);
  });

  it('the TTL index exists on occurredAt (90 days)', async () => {
    const indexes = await ErrorLog.collection.indexes();
    const ttl = indexes.find((i) => i.expireAfterSeconds !== undefined);
    expect(ttl).toBeTruthy();
    expect(ttl.expireAfterSeconds).toBe(90 * 24 * 60 * 60);
  });
});

describe('§A23 sellerVerified sync on verification (M2-I)', () => {
  it('exporter verify flips sellerVerified on ALL of the org products', async () => {
    seq += 1;
    const org = await Organisation.create({
      name: 'Sync Co',
      type: 'business',
      exporterSide: true,
      country: 'IN',
      kycStatus: 'submitted',
    });
    const top = await Category.create({ name: 'Textiles', slug: 'textiles' });
    const leaf = await Category.create({ name: 'Cotton fabric', parentId: top._id, type: 'goods' });
    const products = await Promise.all(
      ['A', 'B', 'C'].map((n) =>
        Product.create({ exporterOrgId: org._id, categoryId: leaf._id, name: `Sync ${n}`, sellerVerified: false }),
      ),
    );

    const platform = await Organisation.create({ name: 'Platform', type: 'platform' });
    const reviewer = await User.create({
      name: 'reviewer',
      email: `rev_${Date.now()}@example.com`,
      mobile: { countryCode: '+91', number: `92${1000000 + seq}`, e164: `+9192${1000000 + seq}` },
      passwordHash: await hashPassword('longpassword1'),
      role: 'employee',
      orgId: platform._id,
      permissions: ['exporter:verify'],
    });

    const res = await request(app)
      .post(`/employee/exporters/${org._id}/verify`)
      .set({ Authorization: `Bearer ${signAccessToken(reviewer)}` });
    expect(res.status).toBe(200);

    for (const p of products) {
      expect((await Product.findById(p._id)).sellerVerified).toBe(true);
    }
  });
});
