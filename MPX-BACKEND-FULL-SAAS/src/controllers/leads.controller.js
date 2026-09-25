import * as svc from '../services/leads.service.js';
import { markReadByRef } from '../services/notification.service.js';

/** Step 1d · enquiry routing. Thin: rules live in leads.service.js. */
function clientMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

export async function create(req, res) {
  res.status(201).json({ lead: await svc.createLead({ user: req.user, ...req.validated.body, meta: clientMeta(req) }) });
}
export async function listMine(req, res) {
  res.json({ leads: await svc.listMyLeads({ user: req.user }) });
}
export async function getMine(req, res) {
  res.json({ lead: await svc.getMyLead({ user: req.user, id: req.validated.params.id }) });
}
export async function list(req, res) {
  res.json(await svc.listLeads({ actor: req.user, ...req.validated.query }));
}
export async function get(req, res) {
  const lead = await svc.getLead({ id: req.validated.params.id });
  // Opening the request clears this staff member's own "assigned to you" notice.
  markReadByRef({ userId: req.user.userId, refKey: `lead-assigned:${req.validated.params.id}` });
  res.json({ lead });
}
export async function assign(req, res) {
  res.json({ lead: await svc.assignLead({ actor: req.user, id: req.validated.params.id, assigneeId: req.validated.body.assigneeId, meta: clientMeta(req) }) });
}
export async function status(req, res) {
  res.json({ lead: await svc.setLeadStatus({ actor: req.user, id: req.validated.params.id, status: req.validated.body.status, meta: clientMeta(req) }) });
}
export async function route(req, res) {
  res.status(201).json({ lead: await svc.routeLead({ actor: req.user, id: req.validated.params.id, productId: req.validated.body.productId, meta: clientMeta(req) }) });
}
export async function timeline(req, res) {
  res.json({ events: await svc.leadTimeline({ id: req.validated.params.id }) });
}
export async function assignees(_req, res) {
  res.json({ staff: await svc.assignableStaff() });
}
export async function overview(_req, res) {
  res.json(await svc.leadOverview());
}
