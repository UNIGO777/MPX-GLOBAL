import * as svc from '../services/adminOrgs.service.js';
import { orgListView, orgDetailView } from '../views/adminOrg.view.js';

// Read-only. Block/unblock stays on its own superadmin-gated routes — governance
// is never grantable (m5-rules §5), and `organisation:read` is a READ.

export async function list(req, res) {
  const { rows, productCounts, total, page, pageSize } = await svc.listOrganisations(req.validated.query);
  res.json({
    organisations: rows.map((org) => orgListView(org, productCounts.get(String(org._id)))),
    total,
    page,
    pageSize,
  });
}

export async function get(req, res) {
  res.json({ organisation: orgDetailView(await svc.getOrganisation(req.params.id)) });
}
