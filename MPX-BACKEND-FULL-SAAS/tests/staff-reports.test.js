import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Ticket } = await import('../src/models/Ticket.js');
const { TicketMessage } = await import('../src/models/TicketMessage.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');

/**
 * Step 1e · "My work" + staff reports.
 *  1. 🔴 An employee's report is ONLY their own row, even when asking for
 *     someone else's; a superadmin sees the team.
 *  2. Counts come from the audit log (a resolve is counted as resolved).
 *  3. "My work" lists the tickets assigned to me, and only if I can handle them.
 *  4. Company accounts are refused.
 */
const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const RUN = String(Date.now()).slice(-7);
let seq = 0;
const made = [];

async function makeUser(role, { permissions = [] } = {}) {
  seq += 1;
  const number = `5${RUN.slice(-6)}${String(seq).padStart(3, '0')}`;
  const user = await User.create({
    name: `SR ${role} ${seq} ${RUN}`,
    email: `sr_${RUN}_${seq}@example.com`,
    mobile: { countryCode: '+91', number, e164: `+91${number}` },
    passwordHash: await hashPassword('Password123!'),
    role, orgId: new mongoose.Types.ObjectId(), permissions,
    isActive: true, isEmailVerified: true, isMobileVerified: true,
  });
  made.push(user._id);
  return { user, token: signAccessToken(user) };
}

let buyer, agent, other, superadmin, ticketId;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  buyer = await makeUser('buyer');
  agent = await makeUser('employee', { permissions: ['support:read', 'support:reply', 'support:assign', 'support:status'] });
  other = await makeUser('employee', { permissions: ['support:read', 'support:reply', 'support:assign', 'support:status'] });
  superadmin = await makeUser('superadmin');
  const t = await request(app).post('/support/tickets').set(bearer(buyer.token)).send({ subject: 'Report test ticket', category: 'other', body: 'hi' });
  ticketId = t.body.ticket.id;
  await request(app).post(`/admin/support/tickets/${ticketId}/messages`).set(bearer(agent.token)).send({ body: 'On it' });
  await request(app).patch(`/admin/support/tickets/${ticketId}/status`).set(bearer(agent.token)).send({ status: 'resolved' });
  await request(app).patch(`/admin/support/tickets/${ticketId}/status`).set(bearer(other.token)).send({ status: 'open' });
});

afterAll(async () => {
  await TicketMessage.deleteMany({ ticketId });
  await Ticket.deleteMany({ _id: ticketId });
  await User.deleteMany({ _id: { $in: made } });
  await mongoose.disconnect();
});

describe('staff reports', () => {
  it('counts an employee\'s own actions from the audit log', async () => {
    const res = await request(app).get('/admin/reports/staff?days=7').set(bearer(agent.token));
    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('self');
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].id).toBe(String(agent.user._id));
    expect(res.body.rows[0].counts.ticketReplies).toBe(1);
    expect(res.body.rows[0].counts.ticketsResolved).toBe(1);
  });

  it('🔴 an employee asking for someone else still gets only their own row', async () => {
    const res = await request(app).get(`/admin/reports/staff?actorId=${agent.user._id}`).set(bearer(other.token));
    expect(res.body.rows.map((r) => r.id)).toEqual([String(other.user._id)]);
    expect(res.body.rows[0].counts.ticketsResolved).toBe(0);
  });

  it('a superadmin sees the team, and can narrow to one person', async () => {
    const all = await request(app).get('/admin/reports/staff?days=30').set(bearer(superadmin.token));
    expect(all.body.scope).toBe('team');
    const ids = all.body.rows.map((r) => r.id);
    expect(ids).toContain(String(agent.user._id));
    expect(ids).toContain(String(other.user._id));
    const one = await request(app).get(`/admin/reports/staff?actorId=${agent.user._id}`).set(bearer(superadmin.token));
    expect(one.body.rows.map((r) => r.id)).toEqual([String(agent.user._id)]);
  });

  it('refuses a window outside 7 / 30 / 90, and company accounts', async () => {
    expect((await request(app).get('/admin/reports/staff?days=365').set(bearer(superadmin.token))).status).toBe(400);
    expect((await request(app).get('/admin/reports/staff').set(bearer(buyer.token))).status).toBe(403);
    expect((await request(app).get('/admin/my-work').set(bearer(buyer.token))).status).toBe(403);
  });
});

describe('my work', () => {
  it('lists the open tickets assigned to me', async () => {
    const res = await request(app).get('/admin/my-work').set(bearer(agent.token));
    expect(res.status).toBe(200);
    expect(res.body.canTickets).toBe(true);
    expect(res.body.tickets.some((t) => t.id === ticketId)).toBe(true);
    expect(res.body.last30.id).toBe(String(agent.user._id));
  });

  it('an employee without the permission gets no ticket list', async () => {
    const plain = await makeUser('employee', { permissions: ['user:read'] });
    const res = await request(app).get('/admin/my-work').set(bearer(plain.token));
    expect(res.body.canTickets).toBe(false);
    expect(res.body.tickets).toEqual([]);
  });
});

describe('reports:team (owner, 2026-09-24)', () => {
  it('an employee granted reports:team sees the whole team; without it, only their own row', async () => {
    const lead = await makeUser('employee', { permissions: ['reports:team'] });
    const withTeam = await request(app).get('/admin/reports/staff?days=30').set(bearer(lead.token));
    expect(withTeam.status).toBe(200);
    expect(withTeam.body.scope).toBe('team');
    expect(withTeam.body.rows.length).toBeGreaterThan(1);
    const plain = await request(app).get('/admin/reports/staff?days=30').set(bearer(other.token));
    expect(plain.body.scope).toBe('self');
    expect(plain.body.rows.map((r) => r.id)).toEqual([String(other.user._id)]);
  });

  it('"My work" stays personal even with reports:team', async () => {
    const lead = await makeUser('employee', { permissions: ['reports:team', 'support:read'] });
    const res = await request(app).get('/admin/my-work').set(bearer(lead.token));
    expect(res.status).toBe(200);
    expect(res.body.last30.id).toBe(String(lead.user._id));
  });
});

