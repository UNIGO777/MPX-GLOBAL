import * as svc from '../services/internalNotes.service.js';

/** Step 1c · staff-only internal notes. Thin: the subject-permission gate lives in the service. */
function clientMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

export async function list(req, res) {
  res.json({ notes: await svc.listNotes({ actor: req.user, ...req.validated.query }) });
}

export async function add(req, res) {
  res.status(201).json({ note: await svc.addNote({ actor: req.user, ...req.validated.body, meta: clientMeta(req) }) });
}
