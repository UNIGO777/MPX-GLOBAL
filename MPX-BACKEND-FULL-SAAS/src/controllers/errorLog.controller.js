import * as svc from '../services/errorLogViewer.service.js';
import { errorListView, errorDetailView } from '../views/errorLog.view.js';

// Read-only. There is deliberately no create, update, delete or "clear" handler
// here: entries are written by the central error handler, and retention is the
// TTL's job (A19), never a staff action.

export async function list(req, res) {
  const { rows, userById, total, page, pageSize, userFor } = await svc.listErrorEntries(
    req.validated.query,
  );
  res.json({
    entries: rows.map((row) => errorListView(row, userFor(row, userById))),
    total,
    page,
    pageSize,
  });
}

export async function get(req, res) {
  const { entry, user } = await svc.getErrorEntry(req.params.id);
  res.json({ entry: errorDetailView(entry, user) });
}
