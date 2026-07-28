import { Organisation } from '../models/Organisation.js';
import { AppError } from '../utils/AppError.js';

// Public exporter profile (B7). An exporter is publicly visible from signup — its
// visibility is NEVER gated on verification. The query is constrained to
// type:'exporter' (so a buyer/platform org can't be read via a guessed id) and
// isActive (a deactivated org is 404). A rejected/pending exporter is still
// public; only its "verified" flag differs.
export async function getPublicExporter({ id }) {
  const org = await Organisation.findOne({ _id: id, type: 'exporter', isActive: true });
  if (!org) throw AppError.notFound('exporter not found', 'Not found.');
  return org;
}
