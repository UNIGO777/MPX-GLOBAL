import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { Ticket } = await import('../src/models/Ticket.js');
const { TicketMessage } = await import('../src/models/TicketMessage.js');
const { Notification } = await import('../src/models/Notification.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { notify } = await import('../src/services/notification.service.js');
const { notifyMessageInApp } = await import('../src/services/chatNotifications.service.js');
const { approveBuyer } = await import('../src/services/verification.service.js');

/**
 * B8 · the web notification centre (owner override 2026-09-25).
 *
 * What these pin, in order of consequence:
 *  1. OWNERSHIP — a person only ever lists, counts or marks THEIR OWN
 *     notifications; someone else's id is a 404, never a 403.
 *  2. Coalescing — one unread row per (person, thing); reading it starts fresh.
 *  3. The events reach the right person with the right link, and a chat notice
 *     never carries message text (D-N1).
 *  4. Opening the thing clears its notice.
 */
const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const RUN = String(Date.now()).slice(-7);
let seq = 0;
const made = { users: [], orgs: [] };

async function makeUser(role, { orgId = new mongoose.Types.ObjectId(), permissions = [] } = {}) {
  seq += 1;
  const number = `7${RUN.slice(-6)}${String(seq).padStart(3, '0')}`;
  const user = await User.create({
    name: `B8 ${role} ${seq}`,
    email: `b8_${RUN}_${seq}@example.com`,
    mobile: { countryCode: '+91', number, e164: `+91${number}` },
    passwordHash: await hashPassword('Password123!'),
    role,
    orgId,
    permissions,
    isActive: true,
    isEmailVerified: true,
    isMobileVerified: true,
  });
  made.users.push(user._id);
  return { user, token: signAccessToken(user), orgId, id: String(user._id) };
}

/** Notifications are fire-and-forget — poll briefly for the one we expect. */
async function waitFor(fn, ms = 3000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
}
const mine = (u, filter = {}) => Notification.find({ userId: u.user._id, ...filter }).lean();

let buyer, exporter, other, superadmin, agent, agent2;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of ['Notification', 'Ticket', 'TicketMessage', 'User']) await mongoose.model(name).syncIndexes();
  const org = await Organisation.create({ name: `B8 Co ${RUN}`, type: 'business', country: 'IN', buyerSide: true, exporterSide: true, kycStatus: 'submitted' });
  made.orgs.push(org._id);
  buyer = await makeUser('buyer', { orgId: org._id });
  exporter = await makeUser('exporter', { orgId: new mongoose.Types.ObjectId() });
  other = await makeUser('buyer');
  superadmin = await makeUser('superadmin');
  agent = await makeUser('employee', { permissions: ['support:read', 'support:view_all', 'support:reply', 'support:assign', 'support:status'] });
  agent2 = await makeUser('employee', { permissions: ['support:read', 'support:view_all', 'support:reply', 'support:assign', 'support:status'] });
});

afterAll(async () => {
  const tickets = await Ticket.find({ createdBy: { $in: made.users } }).select('_id');
  await TicketMessage.deleteMany({ ticketId: { $in: tickets.map((t) => t._id) } });
  await Ticket.deleteMany({ _id: { $in: tickets.map((t) => t._id) } });
  await Notification.deleteMany({ userId: { $in: made.users } });
  await Organisation.deleteMany({ _id: { $in: made.orgs } });
  await User.deleteMany({ _id: { $in: made.users } });
  await mongoose.disconnect();
});

describe('B8 · access — your own notifications only', () => {
  it('every route needs a signed-in user', async () => {
    expect((await request(app).get('/notifications')).status).toBe(401);
    expect((await request(app).get('/notifications/unread-count')).status).toBe(401);
    expect((await request(app).post('/notifications/read-all')).status).toBe(401);
  });

  it("someone else's notification is invisible and cannot be marked — 404, never 403", async () => {
    await notify([buyer.id], { type: 'test.own', title: 'For the buyer only' });
    const row = await waitFor(async () => (await mine(buyer, { type: 'test.own' }))[0]);
    const list = await request(app).get('/notifications').set(bearer(other.token));
    expect(list.body.items.map((i) => i.id)).not.toContain(String(row._id));
    const mark = await request(app).post(`/notifications/${row._id}/read`).set(bearer(other.token));
    expect(mark.status).toBe(404);
    expect((await Notification.findById(row._id)).readAt).toBeNull();
  });

  it('lists newest first, counts unread, marks one and then all read', async () => {
    const u = await makeUser('buyer');
    await notify([u.id], { type: 'test.a', title: 'First' });
    await notify([u.id], { type: 'test.b', title: 'Second' });
    const list = await request(app).get('/notifications').set(bearer(u.token));
    expect(list.body.items.map((i) => i.title)).toEqual(['Second', 'First']);
    expect(Object.keys(list.body.items[0]).sort()).toEqual(['at', 'body', 'count', 'id', 'link', 'read', 'title', 'type']);
    expect((await request(app).get('/notifications/unread-count').set(bearer(u.token))).body.unread).toBe(2);
    await request(app).post(`/notifications/${list.body.items[0].id}/read`).set(bearer(u.token)).expect(200);
    expect((await request(app).get('/notifications/unread-count').set(bearer(u.token))).body.unread).toBe(1);
    await request(app).post('/notifications/read-all').set(bearer(u.token)).expect(200);
    expect((await request(app).get('/notifications/unread-count').set(bearer(u.token))).body.unread).toBe(0);
  });
});

describe('B8 · coalescing', () => {
  it('one unread row per thing — updated and counted, then a fresh row after it is read', async () => {
    const u = await makeUser('buyer');
    await notify([u.id], { type: 'test.c', title: 'One', refKey: 'thing:1' });
    await notify([u.id], { type: 'test.c', title: 'Two', refKey: 'thing:1' });
    let rows = await mine(u, { refKey: 'thing:1' });
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(2);
    expect(rows[0].title).toBe('Two');
    await Notification.updateOne({ _id: rows[0]._id }, { $set: { readAt: new Date() } });
    await notify([u.id], { type: 'test.c', title: 'Three', refKey: 'thing:1' });
    rows = await mine(u, { refKey: 'thing:1' });
    expect(rows).toHaveLength(2);
  });
});

describe('B8 · support tickets', () => {
  it('a staff reply notifies the company with its ticket link, and opening the ticket clears it', async () => {
    const t = (await request(app).post('/support/tickets').set(bearer(buyer.token))
      .send({ subject: 'Invoice question', category: 'other', body: 'Hello' })).body.ticket;
    await request(app).post(`/admin/support/tickets/${t.id}/messages`).set(bearer(agent.token)).send({ body: 'Looking into it' }).expect(201);
    const n = await waitFor(async () => (await mine(buyer, { type: 'ticket.reply' }))[0]);
    expect(n.link).toBe(`/buyer/support/${t.id}`);
    expect(n.readAt).toBeNull();
    await request(app).get(`/support/tickets/${t.id}`).set(bearer(buyer.token)).expect(200);
    expect(await waitFor(async () => (await Notification.findById(n._id)).readAt)).toBeTruthy();
  });

  it('assigning tells the new owner — but not someone who took it themselves', async () => {
    const t = (await request(app).post('/support/tickets').set(bearer(buyer.token))
      .send({ subject: 'Assign me', category: 'other', body: 'x' })).body.ticket;
    await request(app).patch(`/admin/support/tickets/${t.id}/assign`).set(bearer(agent.token)).send({ assigneeId: agent2.id }).expect(200);
    const n = await waitFor(async () => (await mine(agent2, { type: 'ticket.assigned' })).find((r) => r.link.endsWith(t.id)));
    expect(n.link).toBe(`/admin/support/${t.id}`);
    // Opening the ticket clears "assigned to you" too.
    await request(app).get(`/admin/support/tickets/${t.id}`).set(bearer(agent2.token)).expect(200);
    expect(await waitFor(async () => (await Notification.findById(n._id)).readAt)).toBeTruthy();

    const t2 = (await request(app).post('/support/tickets').set(bearer(buyer.token))
      .send({ subject: 'Self take', category: 'other', body: 'x' })).body.ticket;
    await request(app).patch(`/admin/support/tickets/${t2.id}/assign`).set(bearer(agent.token)).send({ assigneeId: agent.id }).expect(200);
    await new Promise((r) => setTimeout(r, 300));
    expect((await mine(agent, { type: 'ticket.assigned' })).some((r) => r.link.endsWith(t2.id))).toBe(false);
  });

  it("a company reply notifies the ticket's assignee", async () => {
    const t = (await request(app).post('/support/tickets').set(bearer(buyer.token))
      .send({ subject: 'Reply to owner', category: 'other', body: 'x' })).body.ticket;
    await request(app).patch(`/admin/support/tickets/${t.id}/assign`).set(bearer(agent.token)).send({ assigneeId: agent2.id }).expect(200);
    await request(app).post(`/support/tickets/${t.id}/messages`).set(bearer(buyer.token)).send({ body: 'More detail' }).expect(201);
    const n = await waitFor(async () => (await mine(agent2, { type: 'ticket.company_reply' })).find((r) => r.link.endsWith(t.id)));
    expect(n).toBeTruthy();
  });
});

describe('B8 · verification', () => {
  it('a decision notifies the company account on that side with a link to its verification page', async () => {
    await approveBuyer({ orgId: buyer.orgId, actor: { userId: superadmin.id, role: 'superadmin', permissions: [] }, meta: {} });
    const n = await waitFor(async () => (await mine(buyer, { type: 'verification.approved' }))[0]);
    expect(n.link).toBe('/buyer/verification');
  });
});

describe('B8 · chat', () => {
  it('a new message notifies the other side — product and company only, never the text — and coalesces per thread', async () => {
    const conversation = {
      _id: new mongoose.Types.ObjectId(),
      buyerOrgId: buyer.orgId,
      exporterOrgId: exporter.orgId,
      buyerOrgName: 'Buyer Co',
      exporterOrgName: 'Seller Co',
      productNameSnapshot: 'Cotton Twill',
    };
    notifyMessageInApp({ conversation, senderSide: 'exporter', senderUserId: exporter.id });
    await waitFor(async () => (await mine(buyer, { refKey: `conv:${conversation._id}` }))[0]);
    notifyMessageInApp({ conversation, senderSide: 'exporter', senderUserId: exporter.id });
    const rows = await waitFor(async () => {
      const r = await mine(buyer, { refKey: `conv:${conversation._id}` });
      return r[0]?.count === 2 ? r : null;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('New message from Seller Co');
    expect(rows[0].body).toBe('Cotton Twill');
    expect(rows[0].link).toBe(`/buyer/chat/${conversation._id}`);
    // The sender's own side is never notified of their own message.
    expect(await mine(exporter, { refKey: `conv:${conversation._id}` })).toHaveLength(0);
  });

  it("clearing is per person — the other side (or a missing id) never clears your notice", async () => {
    const { markReadByRef } = await import('../src/services/notification.service.js');
    const refKey = `conv:${new mongoose.Types.ObjectId()}`;
    await notify([buyer.id], { type: 'chat.message', title: 'x', refKey });
    await markReadByRef({ userId: exporter.id, refKey });
    await markReadByRef({ userId: undefined, refKey });
    const row = (await mine(buyer, { refKey }))[0];
    expect(row.readAt).toBeNull();
    await markReadByRef({ userId: buyer.id, refKey });
    expect((await Notification.findById(row._id)).readAt).toBeTruthy();
  });
});
