import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { User } = await import('../src/models/User.js');
const { Organisation } = await import('../src/models/Organisation.js');
const { Ticket } = await import('../src/models/Ticket.js');
const { TicketMessage } = await import('../src/models/TicketMessage.js');
const { InternalNote } = await import('../src/models/InternalNote.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const { signAccessToken } = await import('../src/services/token.service.js');
const { hashPassword } = await import('../src/services/password.service.js');

/**
 * Step 1c · staff-only internal notes.
 *  1. 🔴 A company never reads a note — not by the notes route, not inside its
 *     own ticket, not on its own company profile.
 *  2. Access follows the SUBJECT's permission; default-deny otherwise.
 *  3. Append-only: no edit or delete route, and the model refuses both.
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
    name: `IN ${role} ${seq}`,
    email: `in_${RUN}_${seq}@example.com`,
    mobile: { countryCode: '+91', number, e164: `+91${number}` },
    passwordHash: await hashPassword('Password123!'),
    role, orgId, permissions,
    isActive: true, isEmailVerified: true, isMobileVerified: true,
  });
  made.users.push(user._id);
  return { user, token: signAccessToken(user) };
}

let org, buyer, orgReader, supportAgent, noPerms, superadmin, ticketId;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const name of ['InternalNote', 'Ticket', 'User']) await mongoose.model(name).syncIndexes();
  org = await Organisation.create({ name: `IN Co ${RUN}`, type: 'business', country: 'IN', buyerSide: true });
  made.orgs.push(org._id);
  buyer = await makeUser('buyer', { orgId: org._id });
  orgReader = await makeUser('employee', { permissions: ['organisation:read'] });
  supportAgent = await makeUser('employee', { permissions: ['support:read'] });
  noPerms = await makeUser('employee', { permissions: ['user:read'] });
  superadmin = await makeUser('superadmin');
  const res = await request(app).post('/support/tickets').set(bearer(buyer.token))
    .send({ subject: 'Need help please', category: 'other', body: 'Hello' });
  ticketId = res.body.ticket.id;
});

afterAll(async () => {
  // InternalNote + AuditLog are append-only — their test rows stay.
  await TicketMessage.deleteMany({ ticketId });
  await Ticket.deleteMany({ _id: ticketId });
  await User.deleteMany({ _id: { $in: made.users } });
  await Organisation.deleteMany({ _id: { $in: made.orgs } });
  await mongoose.disconnect();
});

describe('internal notes', () => {
  it('a support agent adds and lists a note on a ticket; it is audited without the text', async () => {
    const add = await request(app).post('/admin/notes').set(bearer(supportAgent.token))
      .send({ subjectType: 'ticket', subjectId: ticketId, body: 'Customer called twice — VIP account.' });
    expect(add.status).toBe(201);
    expect(add.body.note.author.name).toBe(supportAgent.user.name);
    const list = await request(app).get(`/admin/notes?subjectType=ticket&subjectId=${ticketId}`).set(bearer(supportAgent.token));
    expect(list.body.notes[0].body).toContain('VIP');
    const row = await AuditLog.findOne({ action: 'note.add', entityId: ticketId });
    expect(row).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain('VIP');
  });

  it('🔴 access follows the subject: an org reader cannot read ticket notes; a support agent cannot read org notes', async () => {
    expect((await request(app).get(`/admin/notes?subjectType=ticket&subjectId=${ticketId}`).set(bearer(orgReader.token))).status).toBe(403);
    expect((await request(app).get(`/admin/notes?subjectType=organisation&subjectId=${org._id}`).set(bearer(supportAgent.token))).status).toBe(403);
    expect((await request(app).get(`/admin/notes?subjectType=organisation&subjectId=${org._id}`).set(bearer(orgReader.token))).status).toBe(200);
    expect((await request(app).get(`/admin/notes?subjectType=ticket&subjectId=${ticketId}`).set(bearer(noPerms.token))).status).toBe(403);
  });

  it('🔴 a company account can never reach notes, and its own ticket carries none', async () => {
    await request(app).post('/admin/notes').set(bearer(superadmin.token))
      .send({ subjectType: 'organisation', subjectId: String(org._id), body: 'SECRET-ORG-NOTE' });
    expect((await request(app).get(`/admin/notes?subjectType=organisation&subjectId=${org._id}`).set(bearer(buyer.token))).status).toBe(403);
    expect((await request(app).post('/admin/notes').set(bearer(buyer.token)).send({ subjectType: 'ticket', subjectId: ticketId, body: 'x' })).status).toBe(403);
    const own = await request(app).get(`/support/tickets/${ticketId}`).set(bearer(buyer.token));
    expect(JSON.stringify(own.body)).not.toContain('VIP');
    const profile = await request(app).get('/me/organisation').set(bearer(buyer.token));
    expect(JSON.stringify(profile.body)).not.toContain('SECRET-ORG-NOTE');
  });

  it('a missing subject is 404', async () => {
    const res = await request(app).get(`/admin/notes?subjectType=ticket&subjectId=${new mongoose.Types.ObjectId()}`).set(bearer(superadmin.token));
    expect(res.status).toBe(404);
  });

  it('is append-only: no edit/delete route, and the model refuses both', async () => {
    const note = await InternalNote.findOne({ subjectId: ticketId });
    expect((await request(app).patch(`/admin/notes/${note._id}`).set(bearer(superadmin.token)).send({ body: 'x' })).status).toBe(404);
    expect((await request(app).delete(`/admin/notes/${note._id}`).set(bearer(superadmin.token))).status).toBe(404);
    await expect(InternalNote.updateOne({ _id: note._id }, { body: 'x' })).rejects.toThrow(/append-only/);
    await expect(InternalNote.deleteOne({ _id: note._id })).rejects.toThrow(/append-only/);
  });
});
