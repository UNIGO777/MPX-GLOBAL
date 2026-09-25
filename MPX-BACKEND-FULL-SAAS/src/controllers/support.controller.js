import * as svc from '../services/support.service.js';
import { markReadByRef } from '../services/notification.service.js';

/**
 * Step 1b · support tickets. Thin: zod validates at the route, the rules live in
 * support.service.js. The file (if any) comes from `uploadSupportFile`.
 */
function clientMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}
const fileOf = (req) => (req.file?.fieldname === 'file' ? { buffer: req.file.buffer, originalname: req.file.originalname } : null);

// ── company ──
export async function create(req, res) {
  const { subject, category, body, followUpOf } = req.validated.body;
  const result = await svc.createTicket({ user: req.user, subject, category, body, followUpOf, file: fileOf(req), meta: clientMeta(req) });
  res.status(201).json(result);
}
export async function listMine(req, res) {
  res.json(await svc.listMyTickets({ user: req.user, ...req.validated.query }));
}
export async function getMine(req, res) {
  res.json(await svc.getMyTicket({ user: req.user, id: req.validated.params.id }));
}
export async function replyMine(req, res) {
  res.status(201).json(
    await svc.replyMyTicket({ user: req.user, id: req.validated.params.id, body: req.validated.body.body, file: fileOf(req), meta: clientMeta(req) }),
  );
}
export async function closeMine(req, res) {
  res.json(await svc.closeMyTicket({ user: req.user, id: req.validated.params.id, meta: clientMeta(req) }));
}
export async function myUnread(req, res) {
  res.json({ count: await svc.myUnreadCount({ user: req.user }) });
}

// ── staff ──
export async function list(req, res) {
  res.json(await svc.listTickets({ actor: req.user, ...req.validated.query }));
}
export async function get(req, res) {
  const out = await svc.getTicket({ id: req.validated.params.id, actor: req.user });
  // Opening the ticket clears this staff member's own notices about it —
  // "new reply" and "assigned to you" alike.
  markReadByRef({ userId: req.user.userId, refKey: `staff-ticket:${req.validated.params.id}` });
  markReadByRef({ userId: req.user.userId, refKey: `staff-ticket-assigned:${req.validated.params.id}` });
  res.json(out);
}
export async function reply(req, res) {
  res.status(201).json(
    await svc.replyTicket({ actor: req.user, id: req.validated.params.id, body: req.validated.body.body, file: fileOf(req), meta: clientMeta(req) }),
  );
}
export async function status(req, res) {
  res.json(await svc.setTicketStatus({ actor: req.user, id: req.validated.params.id, status: req.validated.body.status, meta: clientMeta(req) }));
}
export async function assign(req, res) {
  res.json(await svc.assignTicket({ actor: req.user, id: req.validated.params.id, assigneeId: req.validated.body.assigneeId, meta: clientMeta(req) }));
}
export async function assignees(_req, res) {
  res.json({ staff: await svc.assignableStaff() });
}
export async function timeline(req, res) {
  res.json({ events: await svc.ticketTimeline({ id: req.validated.params.id, actor: req.user }) });
}
export async function overview(req, res) {
  res.json(await svc.supportOverview({ actor: req.user }));
}
export async function log(req, res) {
  res.json(await svc.ticketLog({ actor: req.user, ...req.validated.query }));
}
