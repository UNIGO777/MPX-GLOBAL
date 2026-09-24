import * as svc from '../services/staffReports.service.js';

/** Step 1e · "My work" + staff reports. Scope (self vs team) is decided in the service. */
export async function myWork(req, res) {
  res.json(await svc.myWork({ actor: req.user }));
}

export async function report(req, res) {
  res.json(await svc.staffReport({ actor: req.user, ...req.validated.query }));
}
