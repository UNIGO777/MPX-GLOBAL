import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { User } = await import('../src/models/User.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { approveChange } = await import('../src/services/verification.service.js');

/**
 * The public URL follows the company name (owner, 2026-09-22) — and the old URL
 * must never die.
 *
 * `m3-seo.md` permits a slug to move on exactly one condition: *"keep the old
 * one and 301-redirect old→new. Never hard-break an indexed URL."* Every test
 * here guards one half of that bargain. The invariant, stated once:
 *
 *   a slug that was ever public keeps resolving, forever, and the public read
 *   always reports the CANONICAL slug so the client can redirect to it.
 */
const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const RUN = String(Date.now()).slice(-7);
let seq = 0;
// 10 digits, unique per run AND per fixture — the test DB is shared and keeps
// rows from previous runs behind a unique (mobile.e164, role) index.
const mobileFor = (n) => `9${RUN.slice(-6)}${String(n).padStart(3, '0')}`;

async function makeExporter({ name, kycStatus = 'pending', buyerSide = false } = {}) {
  seq += 1;
  const org = await Organisation.create({
    name: name ?? `Slug Co ${RUN}${seq}`,
    type: 'business',
    exporterSide: !buyerSide,
    buyerSide,
    kycStatus,
    ...(kycStatus === 'verified' ? { verifiedAt: new Date() } : {}),
    entityType: 'business',
    country: 'IN',
    address: { line1: '1 Mill Road', city: 'Tirupur', postalCode: '641601' },
  });
  const user = await User.create({
    name: 'Owner',
    email: `slug${RUN}${seq}@example.com`,
    mobile: { countryCode: '+91', number: mobileFor(seq), e164: `+91${mobileFor(seq)}` },
    passwordHash: await hashPassword('Password123!'),
    role: buyerSide ? 'buyer' : 'exporter',
    orgId: org._id,
    isActive: true,
    isEmailVerified: true,
    isMobileVerified: true,
  });
  // signAccessToken takes the USER DOCUMENT (it reads _id + tokenVersion) —
  // a hand-rolled claims object silently signs `sub: undefined`.
  const token = signAccessToken(user);
  return { org, user, token };
}

const rename = (token, name) => request(app).patch('/me/organisation').set(bearer(token)).send({ name });
const reload = (id) => Organisation.findById(id).lean();

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
});

describe('renaming an UNVERIFIED exporter (edits apply live)', () => {
  it('moves the slug to the new name and retires the old one', async () => {
    const { org, token } = await makeExporter({ name: `Trader Alliance ${RUN}` });
    const before = (await reload(org._id)).slug;

    const res = await rename(token, `Trader Alliance Global ${RUN}`);
    expect(res.status).toBe(200);

    const after = await reload(org._id);
    expect(after.slug).not.toBe(before);
    expect(after.slug).toContain('trader-alliance-global');
    // The bargain: the old value is RETIRED, never discarded.
    expect(after.previousSlugs).toContain(before);
  });

  it('keeps serving the OLD slug publicly, and answers with the CANONICAL one', async () => {
    const { org, token } = await makeExporter({ name: `Kanpur Leather ${RUN}` });
    const old = (await reload(org._id)).slug;
    await rename(token, `Kanpur Leather Works ${RUN}`);
    const canonical = (await reload(org._id)).slug;

    // This is the request a Google result or a saved bookmark makes.
    const res = await request(app).get(`/exporters/${old}`);
    expect(res.status).toBe(200);
    // It resolves to the same company, and reports where the page now lives —
    // which is what the client redirects on.
    expect(res.body.exporter.slug).toBe(canonical);
    expect(res.body.exporter.id ?? res.body.exporter._id).toBeDefined();
  });

  it('appends a suffix when the new name collides with another company', async () => {
    const taken = `Collide Textiles ${RUN}`;
    await makeExporter({ name: taken });
    const { org, token } = await makeExporter({ name: `Other Co ${RUN}` });

    await rename(token, taken);

    const after = await reload(org._id);
    // Same base, disambiguated — never a silent overwrite of the other org.
    expect(after.slug).toMatch(/^collide-textiles-/);
    expect(after.slug).not.toBe((await Organisation.findOne({ name: taken, _id: { $ne: org._id } }).lean()).slug);
  });

  it('will not take a slug that is merely RETIRED by another company', async () => {
    // A retired slug still routes, so handing it to someone else would silently
    // hijack the first company's old links — the subtlest way to break this.
    const { org: first, token: firstToken } = await makeExporter({ name: `Retired Base ${RUN}` });
    const retired = (await reload(first._id)).slug;
    await rename(firstToken, `Retired Base Renamed ${RUN}`);
    expect((await reload(first._id)).previousSlugs).toContain(retired);

    const { org: second, token: secondToken } = await makeExporter({ name: `Second Co ${RUN}` });
    await rename(secondToken, `Retired Base ${RUN}`);

    const after = await reload(second._id);
    expect(after.slug).not.toBe(retired);
    expect(after.slug).toMatch(/^retired-base-/);

    // And the first company's old link still goes to the FIRST company.
    const res = await request(app).get(`/exporters/${retired}`);
    expect(res.status).toBe(200);
    expect(String(res.body.exporter.id ?? res.body.exporter._id)).toBe(String(first._id));
  });

  it('🔴 a NEWLY CREATED org cannot take a slug another company has RETIRED', async () => {
    // Found 2026-09-23 while tracing what happens when someone DECLINES the D7
    // claim offer: they create a second company under the same name, and the
    // creation hook only checked LIVE slugs. A retired slug still routes, so the
    // new company would have served its own page to everyone holding the first
    // company's old link — a silent mis-route to a different business, which is
    // worse than a 404. The rename path always checked both; creation did not.
    const name = `Decline Twin ${RUN}`;
    const { org: first, token } = await makeExporter({ name });
    const retired = (await reload(first._id)).slug;
    await rename(token, `Decline Twin Renamed ${RUN}`);
    expect((await reload(first._id)).previousSlugs).toContain(retired);

    // The declining signup: same company name, brand new organisation.
    const { org: second } = await makeExporter({ name });

    expect((await reload(second._id)).slug).not.toBe(retired);
    // And the first company's old URL still goes to the FIRST company.
    const res = await request(app).get(`/exporters/${retired}`);
    expect(res.status).toBe(200);
    expect(String(res.body.exporter.id ?? res.body.exporter._id)).toBe(String(first._id));
  });

  it('renaming back (A→B→A) restores the slug and drops it from the retired list', async () => {
    const { org, token } = await makeExporter({ name: `Boomerang Co ${RUN}` });
    const original = (await reload(org._id)).slug;

    await rename(token, `Boomerang Traders ${RUN}`);
    expect((await reload(org._id)).previousSlugs).toContain(original);

    await rename(token, `Boomerang Co ${RUN}`);
    const after = await reload(org._id);

    expect(after.slug).toBe(original);
    // Otherwise the same string would be both the canonical URL and a redirect
    // source pointing at itself.
    expect(after.previousSlugs).not.toContain(original);
  });
});

describe('renaming a VERIFIED exporter (pending-change model)', () => {
  it('does NOT move the public URL until a reviewer approves', async () => {
    const { org, token } = await makeExporter({ name: `Verified Mills ${RUN}`, kycStatus: 'verified' });
    const before = (await reload(org._id)).slug;

    const res = await rename(token, `Verified Mills International ${RUN}`);
    expect(res.status).toBe(200);

    const after = await reload(org._id);
    // The whole point of A22: the live profile and its URL do not move on the
    // company's own say-so.
    expect(after.slug).toBe(before);
    expect(after.name).toBe(`Verified Mills ${RUN}`);
    expect(after.pendingChanges?.changedFields).toContain('name');
  });

  it('moves the slug when the change is approved, retiring the old one', async () => {
    const { org, token } = await makeExporter({ name: `Approve Mills ${RUN}`, kycStatus: 'verified' });
    const before = (await reload(org._id)).slug;
    await rename(token, `Approve Mills Global ${RUN}`);

    // A pending set only becomes reviewable once the company uploads its fresh
    // supporting documents (that upload is what flips the state). Documents are
    // not what this test is about, so the state is moved directly.
    await Organisation.updateOne({ _id: org._id }, { $set: { 'pendingChanges.state': 'awaiting_review' } });

    const reviewer = await User.create({
      name: 'Reviewer',
      email: `rev${RUN}${(seq += 1)}@example.com`,
      mobile: { countryCode: '+91', number: mobileFor(seq), e164: `+91${mobileFor(seq)}` },
      passwordHash: await hashPassword('Password123!'),
      role: 'superadmin',
      // Staff sit outside the org they review; any org ref satisfies the model.
      orgId: new mongoose.Types.ObjectId(),
      isActive: true,
    });
    await approveChange({
      orgId: String(org._id),
      sideFlag: 'exporterSide',
      actor: { userId: String(reviewer._id), role: 'superadmin' },
      meta: {},
    });

    const after = await reload(org._id);
    expect(after.name).toBe(`Approve Mills Global ${RUN}`);
    expect(after.slug).not.toBe(before);
    expect(after.slug).toContain('approve-mills-global');
    expect(after.previousSlugs).toContain(before);

    // The tick never blinked, and the old URL still resolves.
    expect(after.kycStatus).toBe('verified');
    const res = await request(app).get(`/exporters/${before}`);
    expect(res.status).toBe(200);
    expect(res.body.exporter.slug).toBe(after.slug);
  });
});

describe('who does NOT get a slug moved', () => {
  it('a buyer-only org has no public page, so a rename touches no slug', async () => {
    const { org, token } = await makeExporter({ name: `Buyer Only ${RUN}`, buyerSide: true });
    const before = (await reload(org._id)).slug;

    const res = await rename(token, `Buyer Only Renamed ${RUN}`);
    expect(res.status).toBe(200);

    const after = await reload(org._id);
    expect(after.name).toBe(`Buyer Only Renamed ${RUN}`);
    expect(after.slug).toBe(before);
    expect(after.previousSlugs ?? []).toHaveLength(0);
  });
});

describe('the sitemap stays canonical-only', () => {
  it('never lists a retired slug', async () => {
    const { org, token } = await makeExporter({ name: `Sitemap Co ${RUN}` });
    const retired = (await reload(org._id)).slug;
    await rename(token, `Sitemap Co Renamed ${RUN}`);
    const canonical = (await reload(org._id)).slug;

    const res = await request(app).get('/sitemap.xml');
    expect(res.status).toBe(200);
    // A retired slug in the sitemap would ask Google to index a redirect.
    expect(res.text).not.toContain(`/supplier/${retired}`);
    expect(res.text).toContain(`/supplier/${canonical}`);
  });
});
