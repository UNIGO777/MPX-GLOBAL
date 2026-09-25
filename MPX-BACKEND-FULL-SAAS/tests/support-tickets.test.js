import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Ticket } = await import('../src/models/Ticket.js');
const { TicketMessage } = await import('../src/models/TicketMessage.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');

/**
 * Step 1b · support tickets.
 *
 * What these pin, in order of consequence:
 *  1. OWNERSHIP — a company never reads another company's ticket (404), and a
 *     both-sides company's buyer and exporter accounts never see each other's.
 *  2. The company never learns WHICH employee handled it (no assignee, no
 *     author ids) — it talks to "MPX Global Support".
 *  3. Default-deny on every staff route; the team-wide ticket log is
 *     superadmin-only (an employee sees only their own actions).
 *  4. Every action writes exactly one log row naming the actor.
 */
const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const RUN = String(Date.now()).slice(-7);
let seq = 0;
const made = { users: [], orgs: [] };

async function makeUser(role, { orgId = new mongoose.Types.ObjectId(), permissions = [] } = {}) {
  seq += 1;
  const number = `8${RUN.slice(-6)}${String(seq).padStart(3, '0')}`;
  const user = await User.create({
    name: `ST ${role} ${seq}`,
    email: `st_${RUN}_${seq}@example.com`,
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
  return { user, token: signAccessToken(user), orgId };
}

let buyerA, exporterA, buyerB, superadmin, agent, agent2, plainEmployee;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of ['Ticket', 'TicketMessage', 'AuditLog', 'User']) await mongoose.model(name).syncIndexes();
  const orgA = new mongoose.Types.ObjectId();
  buyerA = await makeUser('buyer', { orgId: orgA });
  exporterA = await makeUser('exporter', { orgId: orgA }); // same company, other side
  buyerB = await makeUser('buyer');
  superadmin = await makeUser('superadmin');
  agent = await makeUser('employee', { permissions: ['support:read', 'support:view_all', 'support:reply', 'support:assign', 'support:status'] });
  agent2 = await makeUser('employee', { permissions: ['support:read', 'support:view_all', 'support:reply', 'support:assign', 'support:status'] });
  plainEmployee = await makeUser('employee', { permissions: ['user:read'] });
});

afterAll(async () => {
  const tickets = await Ticket.find({ createdBy: { $in: made.users } }).select('_id');
  const ids = tickets.map((t) => t._id);
  await TicketMessage.deleteMany({ ticketId: { $in: ids } });
  // AuditLog rows stay: the collection is append-only (C10) and refuses deletes.
  await Ticket.deleteMany({ _id: { $in: ids } });
  await User.deleteMany({ _id: { $in: made.users } });
  await mongoose.disconnect();
});

async function raise(who, extra = {}) {
  const res = await request(app)
    .post('/support/tickets')
    .set(bearer(who.token))
    .send({ subject: 'Cannot upload GST certificate', category: 'verification', body: 'It keeps failing.', ...extra });
  expect(res.status).toBe(201);
  return res.body.ticket;
}

describe('company side', () => {
  it('raises a ticket with a ref, open, and one log row', async () => {
    const t = await raise(buyerA);
    expect(t.ref).toMatch(/^T-[A-Z2-9]{6}$/);
    expect(t.status).toBe('open');
    const rows = await AuditLog.find({ entityType: 'ticket', entityId: t.id, action: 'ticket.create' });
    expect(rows).toHaveLength(1);
    expect(String(rows[0].actorId)).toBe(String(buyerA.user._id));
  });

  it('refuses an empty ticket', async () => {
    const res = await request(app)
      .post('/support/tickets')
      .set(bearer(buyerA.token))
      .send({ subject: 'Hello there', category: 'other', body: '' });
    expect(res.status).toBe(400);
  });

  it('a superadmin cannot raise one (company accounts only)', async () => {
    const res = await request(app)
      .post('/support/tickets')
      .set(bearer(superadmin.token))
      .send({ subject: 'Hello there', category: 'other', body: 'x' });
    expect(res.status).toBe(403);
  });

  it('🔴 another company gets 404, never the ticket', async () => {
    const t = await raise(buyerA);
    const res = await request(app).get(`/support/tickets/${t.id}`).set(bearer(buyerB.token));
    expect(res.status).toBe(404);
    const list = await request(app).get('/support/tickets').set(bearer(buyerB.token));
    expect(list.body.rows.find((r) => r.id === t.id)).toBeUndefined();
  });

  it('🔴 the same company\'s OTHER side gets 404 too', async () => {
    const t = await raise(buyerA);
    const res = await request(app).get(`/support/tickets/${t.id}`).set(bearer(exporterA.token));
    expect(res.status).toBe(404);
  });

  it('🔴 never shows which employee handled it', async () => {
    const t = await raise(buyerA);
    await request(app).post(`/admin/support/tickets/${t.id}/messages`).set(bearer(agent.token)).send({ body: 'Looking into it.' });
    const res = await request(app).get(`/support/tickets/${t.id}`).set(bearer(buyerA.token));
    expect(res.status).toBe(200);
    const json = JSON.stringify(res.body);
    expect(json).not.toContain(String(agent.user._id));
    expect(json).not.toContain(agent.user.name);
    expect(res.body.ticket.assignedTo).toBeUndefined();
    expect(res.body.messages.at(-1).authorType).toBe('staff');
    expect(res.body.messages.at(-1).author).toBeUndefined();
  });

  it('🔴 a resolved ticket is closed to the company — the reply is refused and nothing is stored', async () => {
    const t = await raise(buyerA);
    await request(app).patch(`/admin/support/tickets/${t.id}/status`).set(bearer(agent.token)).send({ status: 'resolved' });
    const before = await TicketMessage.countDocuments({ ticketId: t.id });
    const res = await request(app).post(`/support/tickets/${t.id}/messages`).set(bearer(buyerA.token)).send({ body: 'Still broken.' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TICKET_CLOSED');
    expect(await TicketMessage.countDocuments({ ticketId: t.id })).toBe(before);
    const after = await request(app).get(`/support/tickets/${t.id}`).set(bearer(buyerA.token));
    expect(after.body.ticket.status).toBe('resolved');
  });

  it('a company reply on an ongoing ticket keeps its status and flags it for staff', async () => {
    const t = await raise(buyerA);
    await request(app).post(`/admin/support/tickets/${t.id}/messages`).set(bearer(agent.token)).send({ body: 'Looking.' });
    const res = await request(app).post(`/support/tickets/${t.id}/messages`).set(bearer(buyerA.token)).send({ body: 'Thanks.' });
    expect(res.status).toBe(201);
    expect(res.body.ticket.status).toBe('in_progress');
    expect((await Ticket.findById(t.id)).unread.staff).toBe(true);
  });

  it('a staff reply on a resolved ticket moves it back to in progress, and the log says so', async () => {
    const t = await raise(buyerA);
    await request(app).patch(`/admin/support/tickets/${t.id}/status`).set(bearer(agent.token)).send({ status: 'resolved' });
    const res = await request(app).post(`/admin/support/tickets/${t.id}/messages`).set(bearer(agent.token)).send({ body: 'One more thing.' });
    expect(res.status).toBe(201);
    expect(res.body.ticket.status).toBe('in_progress');
    expect(res.body.ticket.resolvedAt).toBeNull();
    expect(await AuditLog.countDocuments({ entityId: t.id, action: 'ticket.status', 'before.status': 'resolved', 'after.status': 'in_progress' })).toBe(1);
  });

  it('has no route to edit or delete a message (append-only)', async () => {
    const t = await raise(buyerA);
    const msgId = (await TicketMessage.findOne({ ticketId: t.id }))._id;
    expect((await request(app).patch(`/support/tickets/${t.id}/messages/${msgId}`).set(bearer(buyerA.token)).send({ body: 'x' })).status).toBe(404);
    expect((await request(app).delete(`/support/tickets/${t.id}`).set(bearer(buyerA.token))).status).toBe(404);
  });
});

describe('staff side', () => {
  it('🔴 default-deny: no permission → 403 on every staff route', async () => {
    const t = await raise(buyerA);
    for (const [method, path] of [
      ['get', '/admin/support/tickets'],
      ['get', `/admin/support/tickets/${t.id}`],
      ['get', '/admin/support/overview'],
      ['get', '/admin/support/log'],
      ['get', '/admin/support/assignees'],
      ['patch', `/admin/support/tickets/${t.id}/status`],
    ]) {
      const res = await request(app)[method](path).set(bearer(plainEmployee.token)).send({ status: 'resolved' });
      expect(res.status, `${method} ${path}`).toBe(403);
    }
    // A company account cannot reach the staff queue either.
    expect((await request(app).get('/admin/support/tickets').set(bearer(buyerA.token))).status).toBe(403);
  });

  it('a first staff reply takes the ticket and moves it to in progress — each logged', async () => {
    const t = await raise(buyerA);
    const res = await request(app).post(`/admin/support/tickets/${t.id}/messages`).set(bearer(agent.token)).send({ body: 'On it.' });
    expect(res.status).toBe(201);
    expect(res.body.ticket.status).toBe('in_progress');
    expect(res.body.ticket.assignedTo.id).toBe(String(agent.user._id));
    const actions = (await AuditLog.find({ entityId: t.id }).sort({ occurredAt: 1 })).map((r) => r.action);
    expect(actions).toEqual(['ticket.create', 'ticket.reply', 'ticket.assign', 'ticket.status']);
    const fresh = await Ticket.findOne({ _id: t.id });
    expect(fresh.unread.company).toBe(true);
  });

  it('assigns only to staff who can take support tickets', async () => {
    const t = await raise(buyerA);
    const bad = await request(app).patch(`/admin/support/tickets/${t.id}/assign`).set(bearer(superadmin.token)).send({ assigneeId: String(plainEmployee.user._id) });
    expect(bad.status).toBe(400);
    const ok = await request(app).patch(`/admin/support/tickets/${t.id}/assign`).set(bearer(superadmin.token)).send({ assigneeId: String(agent2.user._id) });
    expect(ok.status).toBe(200);
    expect(ok.body.ticket.assignedTo.id).toBe(String(agent2.user._id));
  });

  it('resolving records who resolved it, with the time', async () => {
    const t = await raise(buyerA);
    const res = await request(app).patch(`/admin/support/tickets/${t.id}/status`).set(bearer(agent2.token)).send({ status: 'resolved' });
    expect(res.body.ticket.status).toBe('resolved');
    expect(res.body.ticket.resolvedAt).toBeTruthy();
    const row = await AuditLog.findOne({ entityId: t.id, action: 'ticket.status' });
    expect(String(row.actorId)).toBe(String(agent2.user._id));
    expect(row.after.status).toBe('resolved');
  });

  it('🔴 the team-wide ticket log is superadmin-only — an employee sees only their own actions', async () => {
    const t = await raise(buyerA);
    await request(app).patch(`/admin/support/tickets/${t.id}/status`).set(bearer(agent.token)).send({ status: 'in_progress' });
    await request(app).patch(`/admin/support/tickets/${t.id}/status`).set(bearer(agent2.token)).send({ status: 'resolved' });

    // agent asks for agent2's actions — gets only their own anyway.
    const mine = await request(app).get(`/admin/support/log?actorId=${agent2.user._id}`).set(bearer(agent.token));
    expect(mine.status).toBe(200);
    expect(mine.body.rows.length).toBeGreaterThan(0);
    expect(mine.body.rows.every((r) => r.actor.id === String(agent.user._id))).toBe(true);

    // superadmin filtering by agent2 sees agent2's resolve.
    const all = await request(app).get(`/admin/support/log?actorId=${agent2.user._id}&action=ticket.status`).set(bearer(superadmin.token));
    expect(all.body.rows.some((r) => r.ticket?.id === t.id && r.to === 'resolved' && r.actor.name === agent2.user.name)).toBe(true);
  });

  it('a ticket timeline lists every action, oldest first', async () => {
    const t = await raise(buyerA);
    await request(app).post(`/admin/support/tickets/${t.id}/messages`).set(bearer(agent.token)).send({ body: 'Hi' });
    const res = await request(app).get(`/admin/support/tickets/${t.id}/timeline`).set(bearer(agent.token));
    expect(res.status).toBe(200);
    expect(res.body.events.map((e) => e.action)).toEqual(['ticket.create', 'ticket.reply', 'ticket.assign', 'ticket.status']);
  });

  it('the overview counts open / unassigned and lists who holds each open ticket', async () => {
    const t = await raise(buyerA);
    const res = await request(app).get('/admin/support/overview').set(bearer(superadmin.token));
    expect(res.status).toBe(200);
    expect(res.body.counts.open).toBeGreaterThan(0);
    expect(res.body.counts.unassigned).toBeGreaterThan(0);
    const row = res.body.openTickets.find((r) => r.id === t.id);
    expect(row).toBeTruthy();
    expect(row.assignedTo).toBeNull();
    expect(row.org).toBeTruthy();
  });
});

describe('Closing, follow-ups, badges and auto-close (owner, 2026-09-24)', () => {
  const resolve = (id) => request(app).patch(`/admin/support/tickets/${id}/status`).set(bearer(agent.token)).send({ status: 'resolved' });
  const reopen = (id) => request(app).patch(`/admin/support/tickets/${id}/status`).set(bearer(agent.token)).send({ status: 'open' });

  it('the company can mark its own ticket solved — closed to replies, logged as the company', async () => {
    const t = await raise(buyerA);
    const res = await request(app).post(`/support/tickets/${t.id}/close`).set(bearer(buyerA.token));
    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe('resolved');
    expect(res.body.ticket.closedBy).toBe('company');
    const row = await AuditLog.findOne({ entityId: t.id, action: 'ticket.status' }).lean();
    expect(row.actorRole).toBe('buyer');
    expect(row.after.by).toBe('company');
    const reply = await request(app).post(`/support/tickets/${t.id}/messages`).set(bearer(buyerA.token)).send({ body: 'x' });
    expect(reply.status).toBe(409);
  });

  it('🔴 another company, or the other side of the same company, cannot close it (404)', async () => {
    const t = await raise(buyerA);
    expect((await request(app).post(`/support/tickets/${t.id}/close`).set(bearer(buyerB.token))).status).toBe(404);
    expect((await request(app).post(`/support/tickets/${t.id}/close`).set(bearer(exporterA.token))).status).toBe(404);
    expect((await Ticket.findById(t.id)).status).toBe('open');
  });

  it('a staff resolve and a staff re-open both light the company\'s "new" badge', async () => {
    const t = await raise(buyerA);
    await request(app).get(`/support/tickets/${t.id}`).set(bearer(buyerA.token)); // read → badge off
    await resolve(t.id);
    expect((await Ticket.findById(t.id)).unread.company).toBe(true);
    expect((await Ticket.findById(t.id)).closedBy).toBe('staff');
    await request(app).get(`/support/tickets/${t.id}`).set(bearer(buyerA.token));
    await reopen(t.id);
    const after = await Ticket.findById(t.id);
    expect(after.unread.company).toBe(true);
    expect(after.closedBy).toBeNull();
    expect(after.awaitingCompanySince).not.toBeNull();
  });

  it('a follow-up links back to the company\'s own closed ticket, and both sides see the link', async () => {
    const old = await raise(buyerA);
    await resolve(old.id);
    const res = await request(app).post('/support/tickets').set(bearer(buyerA.token))
      .send({ subject: 'Still failing', category: 'verification', body: 'Same problem again.', followUpOf: old.id });
    expect(res.status).toBe(201);
    expect(res.body.ticket.followUpOf).toEqual({ id: old.id, ref: old.ref });
    const staff = await request(app).get(`/admin/support/tickets/${res.body.ticket.id}`).set(bearer(agent.token));
    expect(staff.body.ticket.followUpOf.ref).toBe(old.ref);
  });

  it('🔴 a follow-up cannot point at another company\'s ticket — 404 and nothing is created', async () => {
    const foreign = await raise(buyerB);
    const before = await Ticket.countDocuments({ createdBy: buyerA.user._id });
    const res = await request(app).post('/support/tickets').set(bearer(buyerA.token))
      .send({ subject: 'Sneaky', category: 'other', body: 'x', followUpOf: foreign.id });
    expect(res.status).toBe(404);
    expect(await Ticket.countDocuments({ createdBy: buyerA.user._id })).toBe(before);
  });

  it('auto-close follows the Settings day count, stamps it on the ticket, and staff see the close date', async () => {
    const { autoCloseStaleTickets } = await import('../src/services/support.service.js');
    const { Settings, SETTINGS_ID } = await import('../src/models/Settings.js');
    await Settings.findOneAndUpdate({ _id: SETTINGS_ID }, { $set: { ticketAutoCloseDays: 5 } }, { upsert: true });
    try {
      const six = await raise(buyerA);
      const four = await raise(buyerA);
      for (const t of [six, four]) {
        await request(app).post(`/admin/support/tickets/${t.id}/messages`).set(bearer(agent.token)).send({ body: 'Any update?' });
      }
      const now = new Date();
      const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      await Ticket.updateOne({ _id: six.id }, { $set: { awaitingCompanySince: daysAgo(6) } });
      await Ticket.updateOne({ _id: four.id }, { $set: { awaitingCompanySince: daysAgo(4) } });

      const staffView = await request(app).get(`/admin/support/tickets/${four.id}`).set(bearer(agent.token));
      expect(new Date(staffView.body.ticket.autoCloseAt).getTime()).toBe(daysAgo(4).getTime() + 5 * 86_400_000);

      await autoCloseStaleTickets({ now });
      const [s6, s4] = await Promise.all([six, four].map((t) => Ticket.findById(t.id)));
      expect(s6.status).toBe('resolved');
      expect(s6.autoClosedAfterDays).toBe(5);
      expect(s4.status).toBe('in_progress');
      const mine = await request(app).get(`/support/tickets/${six.id}`).set(bearer(buyerA.token));
      expect(mine.body.ticket.autoClosedAfterDays).toBe(5);
    } finally {
      await Settings.updateOne({ _id: SETTINGS_ID }, { $set: { ticketAutoCloseDays: null } });
    }
  });

  it('auto-close: only tickets waiting on the company for 14+ days close, logged as "Automatic"', async () => {
    const { autoCloseStaleTickets } = await import('../src/services/support.service.js');
    const waiting = await raise(buyerA); // staff replied, company silent 15 days → closes
    const fresh = await raise(buyerA); // staff replied 13 days ago → stays
    const answered = await raise(buyerA); // company answered after staff → stays
    for (const t of [waiting, fresh, answered]) {
      await request(app).post(`/admin/support/tickets/${t.id}/messages`).set(bearer(agent.token)).send({ body: 'Can you send a screenshot?' });
    }
    await request(app).post(`/support/tickets/${answered.id}/messages`).set(bearer(buyerA.token)).send({ body: 'Here it is.' });
    const now = new Date();
    const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    await Ticket.updateOne({ _id: waiting.id }, { $set: { awaitingCompanySince: daysAgo(15) } });
    await Ticket.updateOne({ _id: fresh.id }, { $set: { awaitingCompanySince: daysAgo(13) } });

    await autoCloseStaleTickets({ now });

    const [w, f, a] = await Promise.all([waiting, fresh, answered].map((t) => Ticket.findById(t.id)));
    expect(w.status).toBe('resolved');
    expect(w.closedBy).toBe('auto');
    expect(w.unread.company).toBe(true);
    expect(f.status).toBe('in_progress');
    expect(a.status).toBe('in_progress');
    const row = await AuditLog.findOne({ entityId: waiting.id, action: 'ticket.status', 'after.by': 'auto' }).lean();
    expect(row.actorId).toBeNull();
    const log = await request(app).get(`/admin/support/tickets/${waiting.id}/timeline`).set(bearer(agent.token));
    expect(log.body.events.at(-1).actor.name).toBe('Automatic');

    // Running again closes nothing new.
    expect((await autoCloseStaleTickets({ now })).closed).toBe(0);
  });

  it('the queue filters "needs a reply" and "waiting on the company", and the overview counts them', async () => {
    const t = await raise(buyerA); // company wrote last, unread → needs a reply
    const q1 = await request(app).get('/admin/support/tickets?status=needs_reply&pageSize=50').set(bearer(agent.token));
    expect(q1.body.rows.some((r) => r.id === t.id)).toBe(true);
    await request(app).post(`/admin/support/tickets/${t.id}/messages`).set(bearer(agent.token)).send({ body: 'Checking.' });
    const q2 = await request(app).get('/admin/support/tickets?status=waiting&pageSize=50').set(bearer(agent.token));
    expect(q2.body.rows.some((r) => r.id === t.id)).toBe(true);
    const q3 = await request(app).get('/admin/support/tickets?status=needs_reply&pageSize=50').set(bearer(agent.token));
    expect(q3.body.rows.some((r) => r.id === t.id)).toBe(false);
    const ov = await request(app).get('/admin/support/overview').set(bearer(agent.token));
    expect(ov.body.counts.waiting).toBeGreaterThanOrEqual(1);
    expect(typeof ov.body.counts.needsReply).toBe('number');
  });

  it('🔴 a ticket can be re-assigned but never put back to unassigned', async () => {
    const t = await raise(buyerA);
    await request(app).patch(`/admin/support/tickets/${t.id}/assign`).set(bearer(superadmin.token)).send({ assigneeId: String(agent.user._id) });
    const res = await request(app).patch(`/admin/support/tickets/${t.id}/assign`).set(bearer(superadmin.token)).send({ assigneeId: null });
    expect(res.status).toBe(400);
    expect((await Ticket.findById(t.id)).assignedTo.toString()).toBe(String(agent.user._id));
  });

  it('🔴 split permissions: read-only can look but not reply, change status or assign', async () => {
    const reader = await makeUser('employee', { permissions: ['support:read', 'support:view_all'] });
    const t = await raise(buyerA);
    expect((await request(app).get(`/admin/support/tickets/${t.id}`).set(bearer(reader.token))).status).toBe(200);
    expect((await request(app).post(`/admin/support/tickets/${t.id}/messages`).set(bearer(reader.token)).send({ body: 'x' })).status).toBe(403);
    expect((await request(app).patch(`/admin/support/tickets/${t.id}/status`).set(bearer(reader.token)).send({ status: 'resolved' })).status).toBe(403);
    expect((await request(app).patch(`/admin/support/tickets/${t.id}/assign`).set(bearer(reader.token)).send({ assigneeId: String(reader.user._id) })).status).toBe(403);
    // …and is not offered as an assignee.
    const list = await request(app).get('/admin/support/assignees').set(bearer(superadmin.token));
    expect(list.body.staff.some((s) => s.id === String(reader.user._id))).toBe(false);
  });

  it('🔴 an action grant without support:read does nothing', async () => {
    const noRead = await makeUser('employee', { permissions: ['support:reply', 'support:status'] });
    const t = await raise(buyerA);
    expect((await request(app).post(`/admin/support/tickets/${t.id}/messages`).set(bearer(noRead.token)).send({ body: 'x' })).status).toBe(403);
    expect((await request(app).patch(`/admin/support/tickets/${t.id}/status`).set(bearer(noRead.token)).send({ status: 'resolved' })).status).toBe(403);
  });

  it('without support:assign: may take an unassigned ticket for yourself — not give it away, not take over', async () => {
    const replier = await makeUser('employee', { permissions: ['support:read', 'support:view_all', 'support:reply'] });
    const t = await raise(buyerA);
    const toOther = await request(app).patch(`/admin/support/tickets/${t.id}/assign`).set(bearer(replier.token)).send({ assigneeId: String(agent.user._id) });
    expect(toOther.status).toBe(403);
    const take = await request(app).patch(`/admin/support/tickets/${t.id}/assign`).set(bearer(replier.token)).send({ assigneeId: String(replier.user._id) });
    expect(take.status).toBe(200);
    expect(take.body.ticket.assignedTo.id).toBe(String(replier.user._id));
    const t2 = await raise(buyerA);
    await request(app).patch(`/admin/support/tickets/${t2.id}/assign`).set(bearer(superadmin.token)).send({ assigneeId: String(agent.user._id) });
    const takeOver = await request(app).patch(`/admin/support/tickets/${t2.id}/assign`).set(bearer(replier.token)).send({ assigneeId: String(replier.user._id) });
    expect(takeOver.status).toBe(403);
  });

  it('support:status alone (with read) can resolve but cannot reply', async () => {
    const closer = await makeUser('employee', { permissions: ['support:read', 'support:view_all', 'support:status'] });
    const t = await raise(buyerA);
    expect((await request(app).patch(`/admin/support/tickets/${t.id}/status`).set(bearer(closer.token)).send({ status: 'resolved' })).status).toBe(200);
    expect((await request(app).post(`/admin/support/tickets/${t.id}/messages`).set(bearer(closer.token)).send({ body: 'x' })).status).toBe(403);
  });

  it('🔴 replying to a CLOSED ticket needs support:status too (it would re-open it)', async () => {
    const replier = await makeUser('employee', { permissions: ['support:read', 'support:view_all', 'support:reply'] });
    const t = await raise(buyerA);
    await request(app).patch(`/admin/support/tickets/${t.id}/status`).set(bearer(agent.token)).send({ status: 'resolved' });
    const before = await TicketMessage.countDocuments({ ticketId: t.id });
    const res = await request(app).post(`/admin/support/tickets/${t.id}/messages`).set(bearer(replier.token)).send({ body: 'One more thing' });
    expect(res.status).toBe(403);
    expect(await TicketMessage.countDocuments({ ticketId: t.id })).toBe(before);
    expect((await Ticket.findById(t.id)).status).toBe('resolved');
    // …while on an OPEN ticket the same person replies normally.
    const open = await raise(buyerA);
    expect((await request(app).post(`/admin/support/tickets/${open.id}/messages`).set(bearer(replier.token)).send({ body: 'On it' })).status).toBe(201);
  });

  it('reports:team widens the ticket log to the whole team; without it, own actions only', async () => {
    const lead = await makeUser('employee', { permissions: ['support:read', 'support:view_all', 'reports:team'] });
    const plain = await makeUser('employee', { permissions: ['support:read', 'support:view_all'] });
    const t = await raise(buyerA);
    await request(app).post(`/admin/support/tickets/${t.id}/messages`).set(bearer(agent.token)).send({ body: 'Logged by agent' });
    const team = await request(app).get('/admin/support/log').set(bearer(lead.token));
    expect(team.status).toBe(200);
    expect(team.body.rows.some((r) => r.actor.id === String(agent.user._id))).toBe(true);
    const own = await request(app).get('/admin/support/log').set(bearer(plain.token));
    expect(own.body.rows.every((r) => r.actor.id === String(plain.user._id))).toBe(true);
  });
});

describe('🔴 ticket visibility — "See all tickets" (owner, 2026-09-25)', () => {
  it('without support:view_all, staff see ONLY tickets assigned to them — everywhere', async () => {
    const own = await makeUser('employee', { permissions: ['support:read', 'support:reply', 'support:status'] });
    const mineT = await raise(buyerA, { subject: 'Assigned to own' });
    const otherT = await raise(buyerA, { subject: 'Somebody else' });
    const unassignedT = await raise(buyerA, { subject: 'Nobody yet' });
    await request(app).patch(`/admin/support/tickets/${mineT.id}/assign`).set(bearer(agent.token)).send({ assigneeId: String(own.user._id) }).expect(200);
    await request(app).patch(`/admin/support/tickets/${otherT.id}/assign`).set(bearer(agent.token)).send({ assigneeId: String(agent2.user._id) }).expect(200);

    // The list: only their own, and the assignee filter cannot widen it.
    const list = await request(app).get('/admin/support/tickets?pageSize=50').set(bearer(own.token));
    const ids = list.body.rows.map((r) => r.id);
    expect(ids).toContain(mineT.id);
    expect(ids).not.toContain(otherT.id);
    expect(ids).not.toContain(unassignedT.id);
    const widened = await request(app).get('/admin/support/tickets?assignee=unassigned&pageSize=50').set(bearer(own.token));
    expect(widened.body.rows.map((r) => r.id)).not.toContain(unassignedT.id);

    // Every other path: someone else's (or an unassigned) ticket is a 404.
    for (const t of [otherT, unassignedT]) {
      expect((await request(app).get(`/admin/support/tickets/${t.id}`).set(bearer(own.token))).status).toBe(404);
      expect((await request(app).get(`/admin/support/tickets/${t.id}/timeline`).set(bearer(own.token))).status).toBe(404);
      expect((await request(app).post(`/admin/support/tickets/${t.id}/messages`).set(bearer(own.token)).send({ body: 'x' })).status).toBe(404);
      expect((await request(app).patch(`/admin/support/tickets/${t.id}/status`).set(bearer(own.token)).send({ status: 'resolved' })).status).toBe(404);
      expect((await request(app).patch(`/admin/support/tickets/${t.id}/assign`).set(bearer(own.token)).send({ assigneeId: String(own.user._id) })).status).toBe(404);
      expect((await request(app).get(`/admin/notes?subjectType=ticket&subjectId=${t.id}`).set(bearer(own.token))).status).toBe(404);
    }

    // Their own ticket works normally.
    expect((await request(app).get(`/admin/support/tickets/${mineT.id}`).set(bearer(own.token))).status).toBe(200);
    expect((await request(app).post(`/admin/support/tickets/${mineT.id}/messages`).set(bearer(own.token)).send({ body: 'On it' })).status).toBe(201);

    // The counts follow the same scope — no "unassigned" number for them.
    const ov = await request(app).get('/admin/support/overview').set(bearer(own.token));
    expect(ov.body.scope).toBe('mine');
    expect(ov.body.counts.unassigned).toBe(0);
    expect(ov.body.openTickets.every((t) => t.assignedTo?.id === String(own.user._id))).toBe(true);
  });

  it('with support:view_all, the whole queue — assigned or not — and who has each', async () => {
    const all = await makeUser('employee', { permissions: ['support:read', 'support:view_all'] });
    const t = await raise(buyerA, { subject: 'Visible to all-viewer' });
    const list = await request(app).get('/admin/support/tickets?assignee=unassigned&pageSize=50').set(bearer(all.token));
    expect(list.body.rows.map((r) => r.id)).toContain(t.id);
    expect((await request(app).get(`/admin/support/tickets/${t.id}`).set(bearer(all.token))).status).toBe(200);
    expect((await request(app).get('/admin/support/overview').set(bearer(all.token))).body.scope).toBe('all');
  });
});


describe('reassignment and the staff-name list (owner, 2026-09-25)', () => {
  it("the staff-name list needs support:view_all", async () => {
    const own = await makeUser('employee', { permissions: ['support:read', 'support:reply'] });
    expect((await request(app).get('/admin/support/assignees').set(bearer(own.token))).status).toBe(403);
    expect((await request(app).get('/admin/support/assignees').set(bearer(agent.token))).status).toBe(200);
  });

  it("moving a ticket away clears the previous owner's notices about it", async () => {
    const { Notification } = await import('../src/models/Notification.js');
    const t = await raise(buyerA, { subject: 'Reassign me' });
    await request(app).patch(`/admin/support/tickets/${t.id}/assign`).set(bearer(agent.token)).send({ assigneeId: String(agent2.user._id) }).expect(200);
    const before = async () => Notification.findOne({ userId: agent2.user._id, refKey: `staff-ticket-assigned:${t.id}` }).lean();
    for (let i = 0; i < 40 && !(await before()); i += 1) await new Promise((r) => setTimeout(r, 50));
    expect((await before()).readAt).toBeNull();
    await request(app).patch(`/admin/support/tickets/${t.id}/assign`).set(bearer(agent.token)).send({ assigneeId: String(agent.user._id) }).expect(200);
    let cleared = null;
    for (let i = 0; i < 40 && !cleared; i += 1) { cleared = (await before()).readAt; if (!cleared) await new Promise((r) => setTimeout(r, 50)); }
    expect(cleared).toBeTruthy();
  });
});
