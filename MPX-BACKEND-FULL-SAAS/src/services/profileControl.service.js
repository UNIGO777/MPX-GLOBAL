import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { ERROR_CODES } from '../utils/errorCodes.js';

/**
 * D7 rule 7 · WHO controls a company's profile (owner, 2026-09-23).
 *
 * An organisation with an active EXPORTER account: the exporter controls the
 * company profile — name, country, address, entity type, logo, cover,
 * description, pending changes and KYC documents. The buyer account keeps its
 * own buyer functions and its own password, nothing more on the company.
 * No active exporter: the buyer controls it, exactly as §A22 always worked.
 *
 * Why single control: with both sides editing, two people overwrite each
 * other's company name and logo at any moment. Why the EXPORTER: there is one
 * KYC and one tick per organisation, and the exporter side is the one whose tick
 * is public and whose review is stricter.
 *
 * The buyer is never surprised by this: rule 6 means an exporter joins only
 * with a code from the buyer's own inbox (or IS the buyer), and both that email
 * and the F6 join notice say the seller account will manage these details.
 *
 * A pending change the buyer left in flight becomes the exporter's to amend or
 * cancel — there is no path that leaves it stuck with nobody able to touch it.
 *
 * 🔴 Server-side on every write (CLAUDE.md #2). The client's read-only screen is
 * presentation; this is the control.
 */
export async function controlsCompanyProfile({ user, org }) {
  if (user.role === 'exporter') return true;
  if (!org.exporterSide) return true;
  // `exporterSide` alone is not enough: an exporter deactivated by support has
  // left the company, and control returns to the buyer rather than freezing.
  const exporter = await User.exists({ orgId: org._id, role: 'exporter', isActive: true });
  return !exporter;
}

export async function assertControlsCompanyProfile({ user, org }) {
  if (await controlsCompanyProfile({ user, org })) return;
  // 403, not 404: the caller owns this organisation and already knows it exists;
  // the question is only which of its accounts may change it.
  throw AppError.forbidden(
    'company profile managed by exporter',
    "Your company's seller account manages these details.",
    ERROR_CODES.PROFILE_MANAGED_BY_EXPORTER,
  );
}
