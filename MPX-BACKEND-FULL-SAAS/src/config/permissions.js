// Server-side permission catalogue. Employees are granted a subset of these
// (individually assignable); routes declare exactly one (default-deny).
export const PERMISSIONS = Object.freeze({
  BUYER_APPROVE: 'buyer:approve',
  EXPORTER_VERIFY: 'exporter:verify',
  // Grantable READ of the user directory (M1-E). Mutating a user's active state is
  // deliberately NOT a grantable permission — it is hard role-gated
  // (requireRole('superadmin')) so a granted employee can never escalate.
  USER_READ: 'user:read',
  // Grantable VIEW of an org's KYC documents (M1-D) via short-lived signed URLs — a
  // reviewer who can verify needs to see the docs. superadmin is all-access.
  KYC_VIEW: 'kyc:view',

  // --- M2 · Catalogue (§A25, owner-decided 2026-07-31). Catalogue WRITES are
  // deliberately grantable (supersedes the 07-30 "takedown = superadmin-only"
  // default); governance (user activate, employee create/permissions, org block)
  // stays hard role-gated and is NOT in this catalogue.
  // Admin category tree / attribute read.
  CATEGORY_READ: 'category:read',
  // Sub-category CRUD, attribute CRUD, top toggle, image upload (A20), synonyms (A12).
  CATEGORY_MANAGE: 'category:manage',
  // Product monitoring list + detail.
  PRODUCT_READ: 'product:read',
  // Product takedown AND restore.
  PRODUCT_TAKEDOWN: 'product:takedown',

  // --- M4 · Enquiry & Chat. Every read granted by CONVERSATION_READ is written to
  // the AuditLog (M4-34) — an employee's reads are recorded exactly as a
  // superadmin's are, because reading a thread means reading two companies'
  // private commercial conversation.
  CONVERSATION_READ: 'conversation:read',
  // Block AND unblock a single chat. One string covers both directions: a block is
  // reversible by design (M4-24), and a moderator who can freeze a thread but not
  // unfreeze it only generates escalations.
  // 🚫 Supersedes M4-38 ("employees get read permission only in month 1") — owner
  // decision 2026-07-31. Still default-deny and granted per employee, never blanket.
  CONVERSATION_BLOCK: 'conversation:block',
  // Post one of the PRE-WRITTEN platform warnings into a thread (D11). Split from
  // CONVERSATION_BLOCK by the owner on 2026-09-24: warning is a lighter act than
  // freezing a chat, so it can be granted on its own.
  CONVERSATION_WARN: 'conversation:warn',

  // --- M5 · Admin console (owner-decided 2026-08-01).
  // Organisation list + detail. A READ grant: it never carries KYC documents and
  // never carries another user's permissions, so it cannot escalate into either.
  // Block/unblock stays hard `requireRole('superadmin')` — governance is never
  // grantable (m5-rules §5).
  ORGANISATION_READ: 'organisation:read',
  // The audit log viewer. Separate from ORGANISATION_READ on purpose: the audit
  // trail records every KYC view and every conversation read, so being able to
  // browse a company is a much smaller thing than being able to read the record
  // of everything staff have ever looked at.
  AUDIT_READ: 'audit:read',

  // --- FINALIZE F5 · Error log viewer (owner-decided 2026-08-01).
  // Deliberately NOT folded into AUDIT_READ. The two answer different questions
  // and carry different weight: this one shows 5xx stack traces (a debugging
  // grant), while AUDIT_READ shows the record of every KYC document and private
  // conversation staff have ever opened. Bundling them would mean handing over
  // the heaviest read on the platform just to let someone chase a bug.
  ERRORLOG_READ: 'errorlog:read',

  // --- FINALIZE F5b · Featured landing content (owner-decided 2026-08-01).
  // GRANTABLE, following `category:manage` rather than the governance pattern:
  // this is content curation, not platform governance — it can put a product on
  // the front page but cannot change anyone's access, and every action is
  // audited. One string covers read + write of the admin surface: unlike
  // categories (whose read feeds pickers on other admin screens), the featured
  // list has no separate consumer — the landing page reads the PUBLIC endpoint.
  FEATURED_MANAGE: 'featured:manage',

  // --- Step 1b · Support tickets (quote Module 6 "ticket/query queue"). Split
  // into four grants by the owner on 2026-09-24 (was one `support:manage`).
  // Every action route ALSO requires SUPPORT_READ (requirePermissions is all-of),
  // so an action grant without read does nothing. Reaches only tickets — never
  // KYC documents, conversations or anyone's access.
  // View the queue, tickets, the ticket log; add internal notes on a ticket.
  // Open the support area. On its own: ONLY the tickets assigned to you
  // (owner, 2026-09-25). The whole queue needs SUPPORT_VIEW_ALL.
  SUPPORT_READ: 'support:read',
  // See EVERY ticket — assigned or unassigned — and who each is assigned to
  // (owner, 2026-09-25). Without it, staff see only their own tickets.
  SUPPORT_VIEW_ALL: 'support:view_all',
  // Reply to the company as "MPX Global Support" (a first reply takes an
  // unassigned ticket). Only holders appear in the "Assigned to" list.
  SUPPORT_REPLY: 'support:reply',
  // Assign / re-assign a ticket to ANY eligible person. Without it, staff can
  // only take an unassigned ticket for themselves.
  SUPPORT_ASSIGN: 'support:assign',
  // Resolve, re-open, mark in progress.
  SUPPORT_STATUS: 'support:status',

  // --- Step 1d · Enquiry routing (quote Module 6). GRANTABLE: read buyers'
  // "find me a supplier" requests and connect them to a seller's product —
  // which opens a normal enquiry in the BUYER's name. Reaches no documents and
  // no conversation contents.
  // On its own (owner, 2026-09-25): work the requests ASSIGNED TO YOU — route,
  // status, notes. The whole list needs LEAD_VIEW_ALL; giving one to someone
  // else needs LEAD_ASSIGN. Mirrors the support split.
  LEAD_MANAGE: 'lead:manage',
  // See EVERY supplier request, assigned or not, and who has each; take an
  // unassigned one for yourself.
  LEAD_VIEW_ALL: 'lead:view_all',
  // Assign / re-assign a request to anyone who can manage requests.
  LEAD_ASSIGN: 'lead:assign',

  // --- Step 1e · Reports (owner, 2026-09-24). Lets a chosen employee (a team
  // lead) see the WHOLE team's staff report instead of only their own row.
  // Read-only; it grants no action on anything.
  REPORTS_TEAM: 'reports:team',
});

/**
 * Who sees the WHOLE team's activity (staff report + ticket log): a superadmin,
 * or an employee granted `reports:team`. ONE rule, used everywhere team scope
 * is decided, so the report and the log can never disagree.
 */
/**
 * Which tickets a staff member may see at all (owner, 2026-09-25). A superadmin
 * or a `support:view_all` holder sees the whole queue; everyone else ONLY the
 * tickets assigned to them. ONE rule, applied to every staff ticket path — the
 * list, opening one, its timeline, replying, status, assigning, notes and the
 * counts — so no path can show more than the list does.
 */
export function canSeeAllTickets(actor) {
  return actor?.role === 'superadmin' || (actor?.permissions ?? []).includes(PERMISSIONS.SUPPORT_VIEW_ALL);
}
export function ticketScope(actor) {
  return canSeeAllTickets(actor) ? {} : { assignedTo: actor?.userId ?? null };
}

/** Same rule for supplier requests (owner, 2026-09-25). */
export function canSeeAllLeads(actor) {
  return actor?.role === 'superadmin' || (actor?.permissions ?? []).includes(PERMISSIONS.LEAD_VIEW_ALL);
}
export function leadScope(actor) {
  return canSeeAllLeads(actor) ? {} : { assignedTo: actor?.userId ?? null };
}

/**
 * What each permission stands on (owner, 2026-09-25). Enforced HERE, when an
 * employee is created or their permissions are saved — not only on the Staff
 * page — so a grant that could never work (e.g. "Verify exporters" without the
 * company record the review screen loads) cannot be stored at all.
 */
export const PERMISSION_REQUIRES = Object.freeze({
  [PERMISSIONS.SUPPORT_VIEW_ALL]: PERMISSIONS.SUPPORT_READ,
  [PERMISSIONS.SUPPORT_REPLY]: PERMISSIONS.SUPPORT_READ,
  [PERMISSIONS.SUPPORT_STATUS]: PERMISSIONS.SUPPORT_READ,
  [PERMISSIONS.SUPPORT_ASSIGN]: PERMISSIONS.SUPPORT_VIEW_ALL,
  [PERMISSIONS.LEAD_VIEW_ALL]: PERMISSIONS.LEAD_MANAGE,
  [PERMISSIONS.LEAD_ASSIGN]: PERMISSIONS.LEAD_VIEW_ALL,
  // The verification queue and the KYC screen both load the company record.
  [PERMISSIONS.BUYER_APPROVE]: PERMISSIONS.ORGANISATION_READ,
  [PERMISSIONS.EXPORTER_VERIFY]: PERMISSIONS.ORGANISATION_READ,
  [PERMISSIONS.KYC_VIEW]: PERMISSIONS.ORGANISATION_READ,
});

/** A permission list plus everything it stands on (transitively), de-duplicated. */
export function withPrerequisites(permissions) {
  const out = new Set(permissions ?? []);
  for (const p of [...out]) {
    for (let need = PERMISSION_REQUIRES[p]; need; need = PERMISSION_REQUIRES[need]) out.add(need);
  }
  return [...out];
}

export function hasTeamScope(actor) {
  return actor?.role === 'superadmin' || (actor?.permissions ?? []).includes(PERMISSIONS.REPORTS_TEAM);
}
