import * as svc from '../services/auditViewer.service.js';
import { auditListView, auditDetailView } from '../views/audit.view.js';

// Read-only. There is deliberately no create, update or delete handler here —
// entries are written by the services that perform the actions, and the model
// refuses every mutation (rule 1).

export async function list(req, res) {
  const { rows, actorById, total, page, pageSize, actorFor } = await svc.listAuditEntries(
    req.validated.query,
  );
  res.json({
    entries: rows.map((row) => auditListView(row, actorFor(row, actorById))),
    total,
    page,
    pageSize,
  });
}

export async function get(req, res) {
  const { entry, actor } = await svc.getAuditEntry(req.params.id);
  res.json({ entry: auditDetailView(entry, actor) });
}
