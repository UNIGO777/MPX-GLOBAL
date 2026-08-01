import { buildDashboard } from '../services/dashboard.service.js';

export async function get(req, res) {
  res.json(await buildDashboard({ user: req.user }));
}
