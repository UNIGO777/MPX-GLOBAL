/**
 * FINALIZE F5 — the error log viewer.
 *
 * Two things matter here above all. First that it is genuinely read-only: there
 * is no way for staff to make a bad week disappear, because retention belongs to
 * the TTL (A19) and nothing else. Second that exposing stack traces did not open
 * a secret leak — `err.message` and `err.stack` are the only two fields whose
 * shape we do not control, so they are redacted at the write site.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import '../src/models/index.js';
import { User } from '../src/models/User.js';
import { Organisation } from '../src/models/Organisation.js';
import { ErrorLog } from '../src/models/ErrorLog.js';
import { signAccessToken } from '../src/services/token.service.js';
import { hashPassword } from '../src/services/password.service.js';
import { persistErrorLog } from '../src/middleware/errorHandler.js';
import { redactSecrets } from '../src/utils/redact.js';
import { env } from '../src/config/env.js';

const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

let sa;
let viewer;
let auditor;
let plain;
let buyer;

async function makeUser(role, permissions = []) {
  seq += 1;
  const org = await Organisation.create({
    name: `${role} Co ${seq}`,
    type: role === 'buyer' || role === 'exporter' ? 'business' : 'platform',
    ...(role === 'exporter' ? { exporterSide: true } : {}),
    ...(role === 'buyer' ? { buyerSide: true } : {}),
  });
  const user = await User.create({
    name: `${role}-${seq}`,
    email: `f5_${Date.now()}_${seq}@example.com`,
    mobile: { countryCode: '+91', number: `65${3000000 + seq}`, e164: `+9165${3000000 + seq}` },
    passwordHash: await hashPassword('longpassword1'),
    role,
    orgId: org._id,
    permissions,
  });
  return { org, user, token: signAccessToken(user) };
}

async function entry(overrides = {}) {
  return ErrorLog.create({
    statusCode: 500,
    message: 'boom',
    stack: 'Error: boom\n    at somewhere.js:1:1',
    route: '/products',
    method: 'POST',
    requestId: `rq-${seq}-${Math.floor(Math.random() * 1e6)}`,
    occurredAt: new Date(),
    ...overrides,
  });
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Organisation.deleteMany({}), ErrorLog.deleteMany({})]);
  sa = await makeUser('superadmin');
  viewer = await makeUser('employee', ['errorlog:read']);
  auditor = await makeUser('employee', ['audit:read']);
  plain = await makeUser('employee', []);
  buyer = await makeUser('buyer');
});

describe('F5 · access control', () => {
  it('an employee holding errorlog:read can list', async () => {
    await entry();
    const res = await request(app).get('/admin/errors').set(bearer(viewer.token));
    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
  });

  it('superadmin is all-access', async () => {
    await entry();
    const res = await request(app).get('/admin/errors').set(bearer(sa.token));
    expect(res.status).toBe(200);
  });

  it('an employee with NO grant is refused', async () => {
    const res = await request(app).get('/admin/errors').set(bearer(plain.token));
    expect(res.status).toBe(403);
  });

  // The owner decision of 2026-08-01 made concrete: errorlog:read is its own
  // string precisely so that neither grant implies the other.
  it('audit:read alone does NOT open the error viewer', async () => {
    const res = await request(app).get('/admin/errors').set(bearer(auditor.token));
    expect(res.status).toBe(403);
  });

  it('errorlog:read alone does NOT open the audit viewer', async () => {
    const res = await request(app).get('/admin/audit').set(bearer(viewer.token));
    expect(res.status).toBe(403);
  });

  it('a buyer is refused', async () => {
    const res = await request(app).get('/admin/errors').set(bearer(buyer.token));
    expect(res.status).toBe(403);
  });

  it('a guest is refused', async () => {
    const res = await request(app).get('/admin/errors');
    expect(res.status).toBe(401);
  });

  it('the detail route is gated too', async () => {
    const row = await entry();
    expect((await request(app).get(`/admin/errors/${row._id}`).set(bearer(plain.token))).status).toBe(403);
    expect((await request(app).get(`/admin/errors/${row._id}`).set(bearer(viewer.token))).status).toBe(200);
  });
});

describe('F5 · read-only', () => {
  // Retention is the TTL's job (A19). A "clear the errors" endpoint is how a bad
  // week stops being visible, so none of these verbs may exist in any form.
  it.each(['post', 'patch', 'put', 'delete'])('%s /admin/errors is not a route', async (verb) => {
    const res = await request(app)[verb]('/admin/errors').set(bearer(sa.token)).send({});
    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(201);
    expect(res.status).not.toBe(204);
  });

  it.each(['post', 'patch', 'put', 'delete'])('%s /admin/errors/:id is not a route', async (verb) => {
    const row = await entry();
    const res = await request(app)[verb](`/admin/errors/${row._id}`).set(bearer(sa.token)).send({});
    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(201);
    expect(res.status).not.toBe(204);
  });
});

describe('F5 · content', () => {
  it('a real 5xx becomes a readable entry keyed by the SAME requestId the client got', async () => {
    // The reason the screen exists: the user quotes the reference from their
    // error response and staff find the server-side detail from it.
    const fakeReq = {
      originalUrl: '/products',
      method: 'POST',
      id: 'req-f5-trace',
      user: { userId: String(viewer.user._id), orgId: String(viewer.org._id) },
    };
    await persistErrorLog({ err: new Error('kaboom'), req: fakeReq, statusCode: 500 });

    const res = await request(app)
      .get('/admin/errors')
      .query({ requestId: 'req-f5-trace' })
      .set(bearer(viewer.token));

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0].message).toBe('kaboom');
    expect(res.body.entries[0].user.name).toBe(viewer.user.name);
  });

  it('a 4xx never reaches the viewer — errors only, not an application log', async () => {
    const rejected = await request(app).post('/auth/login').send({});
    expect(rejected.status).toBe(400);
    const res = await request(app).get('/admin/errors').set(bearer(viewer.token));
    expect(res.body.total).toBe(0);
  });

  it('the list omits the stack; the detail carries it', async () => {
    const row = await entry({ stack: 'Error: boom\n    at deep/frame.js:9:9' });

    const list = await request(app).get('/admin/errors').set(bearer(viewer.token));
    expect(list.body.entries[0]).not.toHaveProperty('stack');

    const detail = await request(app).get(`/admin/errors/${row._id}`).set(bearer(viewer.token));
    expect(detail.body.entry.stack).toContain('deep/frame.js');
  });

  it('an unresolvable user renders the entry rather than dropping it', async () => {
    await entry({ userId: new mongoose.Types.ObjectId() });
    const res = await request(app).get('/admin/errors').set(bearer(viewer.token));
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0].user.name).toBeNull();
  });

  it('an anonymous failure reports no user, not a placeholder', async () => {
    await entry({ userId: undefined });
    const res = await request(app).get('/admin/errors').set(bearer(viewer.token));
    expect(res.body.entries[0].user).toBeNull();
  });

  it('an unknown id is 404', async () => {
    const res = await request(app)
      .get(`/admin/errors/${new mongoose.Types.ObjectId()}`)
      .set(bearer(viewer.token));
    expect(res.status).toBe(404);
  });
});

describe('F5 · filters', () => {
  it('filters by route as an anchored prefix', async () => {
    await entry({ route: '/products/abc?x=1' });
    await entry({ route: '/admin/orgs' });

    const res = await request(app)
      .get('/admin/errors')
      .query({ route: '/products' })
      .set(bearer(viewer.token));
    expect(res.body.total).toBe(1);
    expect(res.body.entries[0].route).toBe('/products/abc?x=1');
  });

  it('a route filter is not a regex — metacharacters are escaped', async () => {
    await entry({ route: '/products' });
    const res = await request(app)
      .get('/admin/errors')
      .query({ route: '.*' })
      .set(bearer(viewer.token));
    expect(res.body.total).toBe(0);
  });

  it('an anchored prefix does not match mid-route', async () => {
    await entry({ route: '/admin/products' });
    const res = await request(app)
      .get('/admin/errors')
      .query({ route: 'products' })
      .set(bearer(viewer.token));
    expect(res.body.total).toBe(0);
  });

  it('filters by method and statusCode', async () => {
    await entry({ method: 'GET', statusCode: 503 });
    await entry({ method: 'POST', statusCode: 500 });

    const byMethod = await request(app).get('/admin/errors').query({ method: 'GET' }).set(bearer(viewer.token));
    expect(byMethod.body.total).toBe(1);

    const byStatus = await request(app).get('/admin/errors').query({ statusCode: 500 }).set(bearer(viewer.token));
    expect(byStatus.body.total).toBe(1);
    expect(byStatus.body.entries[0].method).toBe('POST');
  });

  it('a sub-500 statusCode is REJECTED, not answered with a misleading empty page', async () => {
    const res = await request(app).get('/admin/errors').query({ statusCode: 404 }).set(bearer(viewer.token));
    expect(res.status).toBe(400);
  });

  it('an inverted date range is rejected', async () => {
    const res = await request(app)
      .get('/admin/errors')
      .query({ from: '2026-08-01', to: '2026-07-01' })
      .set(bearer(viewer.token));
    expect(res.status).toBe(400);
  });

  it('filters by date range', async () => {
    await entry({ occurredAt: new Date('2026-01-10T00:00:00Z') });
    await entry({ occurredAt: new Date('2026-06-10T00:00:00Z') });

    const res = await request(app)
      .get('/admin/errors')
      .query({ from: '2026-05-01', to: '2026-07-01' })
      .set(bearer(viewer.token));
    expect(res.body.total).toBe(1);
  });

  it('rejects a malformed id and a non-string filter', async () => {
    expect((await request(app).get('/admin/errors/not-an-id').set(bearer(viewer.token))).status).toBe(400);
    // A Mongo operator payload is refused before it can reach the query (B2).
    const res = await request(app).get('/admin/errors?requestId[$gt]=').set(bearer(viewer.token));
    expect(res.status).toBe(400);
  });
});

describe('F5 · pagination', () => {
  it('caps the page size and paginates without repeating a tied row', async () => {
    const shared = new Date('2026-03-03T03:03:03Z');
    for (let i = 0; i < 5; i += 1) await entry({ occurredAt: shared, message: `m${i}` });

    const capped = await request(app).get('/admin/errors').query({ pageSize: 999 }).set(bearer(viewer.token));
    expect(capped.status).toBe(400); // above the declared max — rejected at the boundary

    const p1 = await request(app).get('/admin/errors').query({ pageSize: 2, page: 1 }).set(bearer(viewer.token));
    const p2 = await request(app).get('/admin/errors').query({ pageSize: 2, page: 2 }).set(bearer(viewer.token));
    expect(p1.body.total).toBe(5);
    const ids = [...p1.body.entries, ...p2.body.entries].map((e) => e.id);
    expect(new Set(ids).size).toBe(4); // all distinct despite identical timestamps
  });

  it('the sort index exists so a large collection does not fall back to an in-memory sort', async () => {
    const indexes = await ErrorLog.collection.indexes();
    const sortIndex = indexes.find(
      (i) => i.key && i.key.occurredAt === -1 && i.key._id === -1,
    );
    expect(sortIndex).toBeTruthy();
  });
});

describe('F5 · secret redaction at the write site', () => {
  it('redacts the configured connection string out of a persisted message', async () => {
    // A Mongo driver failure quotes its own connection string. In production that
    // string carries the database password (§A26), and F5 shows messages to staff.
    const err = new Error(`connect ECONNREFUSED for ${env.MONGODB_URI}`);
    await persistErrorLog({
      err,
      req: { originalUrl: '/x', method: 'GET', id: 'req-redact-1' },
      statusCode: 500,
    });

    const row = await ErrorLog.findOne({ requestId: 'req-redact-1' });
    expect(row.message).not.toContain(env.MONGODB_URI);
    expect(row.message).toContain('[redacted]');
  });

  it('redacts credentials embedded in any URI, even an unconfigured one', () => {
    // Synthetic, deliberately fake — the point is to prove the pattern fires.
    const out = redactSecrets('MongoServerError at mongodb://dbuser:not-a-real-pw@10.0.0.5:27017/mpx');
    expect(out).not.toContain('not-a-real-pw');
    expect(out).not.toContain('dbuser');
    expect(out).toContain('10.0.0.5:27017');
  });

  it('redacts a JWT and a bearer header fragment', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    expect(redactSecrets(`bad token ${jwt}`)).not.toContain(jwt);
    expect(redactSecrets('Authorization: Bearer abcdef1234567890')).not.toContain('abcdef1234567890');
  });

  it('leaves ordinary text alone and tolerates a missing stack', () => {
    expect(redactSecrets('Cast to ObjectId failed for value "abc"')).toBe(
      'Cast to ObjectId failed for value "abc"',
    );
    expect(redactSecrets(undefined)).toBeUndefined();
    expect(redactSecrets('')).toBe('');
  });

  it('a redacted secret never reaches the viewer response', async () => {
    await persistErrorLog({
      err: new Error(`failed talking to ${env.MONGODB_URI}`),
      req: { originalUrl: '/x', method: 'GET', id: 'req-redact-2' },
      statusCode: 500,
    });
    const res = await request(app)
      .get('/admin/errors')
      .query({ requestId: 'req-redact-2' })
      .set(bearer(viewer.token));
    expect(JSON.stringify(res.body)).not.toContain(env.MONGODB_URI);
  });
});
