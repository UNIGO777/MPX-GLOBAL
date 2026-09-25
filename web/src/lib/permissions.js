/**
 * Mirror of the backend permission catalogue (src/config/permissions.js — 22
 * grantable strings since 2026-09-24: support split into four, conversation:warn,
 * reports:team). The SERVER is the authority: it validates every grant
 * against its own list, so an entry here that drifted would simply be rejected
 * with a 400. This mirror exists only to render labels and grouping.
 *
 * Governance actions (activate/deactivate, employee create, permission
 * assignment, org block) are deliberately absent — they are hard superadmin
 * role gates on the server and must never appear as grantable options.
 */

export const PERMISSION_GROUPS = [
  // §10's exact areas (m5 web brief). The heavy grants carry the brief's own
  // warning copy verbatim — a grant whose cost isn't stated gets handed out.
  {
    group: 'Verification',
    items: [
      { value: 'buyer:approve', label: 'Approve buyers', help: 'Decide on buyer verification' },
      { value: 'exporter:verify', label: 'Verify exporters', help: 'Decide on exporter verification' },
      { value: 'kyc:view', label: 'View KYC documents', help: 'Open submitted identity documents (access is audited)' },
    ],
  },
  {
    group: 'Users',
    items: [
      { value: 'user:read', label: 'View user directory', help: 'Read-only access to the user list' },
    ],
  },
  {
    group: 'Catalogue',
    items: [
      { value: 'category:read', label: 'View categories', help: 'Admin category tree (read-only)' },
      { value: 'category:manage', label: 'Manage categories', help: 'Sub-category and attribute management' },
      { value: 'product:read', label: 'View products', help: 'Product monitoring list (read-only)' },
      { value: 'product:takedown', label: 'Take down / restore products', help: 'Take down and restore listings' },
    ],
  },
  {
    group: 'Conversations',
    items: [
      { value: 'conversation:read', label: 'Read conversations', help: 'Every conversation they open is recorded in the audit log' },
      { value: 'conversation:block', label: 'Block / unblock chats', help: 'Block and unblock a chat' },
      { value: 'conversation:warn', label: 'Send chat warnings', help: 'Post one of the pre-written platform warnings into a chat' },
    ],
  },
  {
    // Step 1b (2026-09-24) — the support desk, split into four grants.
    group: 'Support tickets',
    items: [
      { value: 'support:read', label: 'View support tickets', help: 'Tickets assigned to you, and their internal notes' },
      { value: 'support:view_all', label: 'See all tickets', help: 'Every ticket, assigned or not, and who has each one' },
      { value: 'support:reply', label: 'Reply to tickets', help: 'Answer companies as MPX Global Support (with See all tickets: take an unassigned one)' },
      { value: 'support:assign', label: 'Assign tickets', help: 'Give any ticket to anyone who can reply' },
      { value: 'support:status', label: 'Resolve / re-open tickets', help: 'Mark in progress, resolve, re-open' },
    ],
  },
  {
    group: 'Supplier requests',
    items: [
      { value: 'lead:manage', label: 'Route supplier requests', help: "Work buyers' 'find me a supplier' requests and connect them to a seller's product" },
    ],
  },
  {
    group: 'Governance records',
    items: [
      { value: 'organisation:read', label: 'View organisations', help: 'Company list and detail (read-only)' },
      { value: 'audit:read', label: 'View audit log', help: 'Includes the record of every KYC document and chat staff have viewed' },
      { value: 'reports:team', label: "See the whole team's report", help: "Staff report for everyone, not only their own row (e.g. a team lead)" },
    ],
  },
  {
    group: 'Debugging & content',
    items: [
      { value: 'errorlog:read', label: 'View error log', help: 'Server error entries (debugging)' },
      { value: 'featured:manage', label: 'Manage featured content', help: 'Landing-page banners and featured items' },
    ],
  },
];

/**
 * An action grant is useless without its read grant (the server requires both
 * on every action route). Ticking an action ticks its read; clearing the read
 * clears the actions that depend on it.
 */
export const PERMISSION_REQUIRES = {
  'support:view_all': 'support:read',
  'support:reply': 'support:read',
  // You can't hand out tickets you can't see (owner, 2026-09-25).
  'support:assign': 'support:view_all',
  'support:status': 'support:read',
};

/** Apply PERMISSION_REQUIRES to a toggle: `next` is the set after the click. */
export function withDependencies(prev, next) {
  const added = next.filter((p) => !prev.includes(p));
  const removed = prev.filter((p) => !next.includes(p));
  let out = [...next];
  // Follow chains both ways (assign → see all → view): adding pulls in every
  // prerequisite, removing drops everything that stands on it.
  for (const p of added) {
    for (let need = PERMISSION_REQUIRES[p]; need; need = PERMISSION_REQUIRES[need]) {
      if (!out.includes(need)) out.push(need);
    }
  }
  const gone = new Set(removed);
  for (let changed = true; changed; ) {
    changed = false;
    for (const q of out) {
      if (gone.has(PERMISSION_REQUIRES[q])) {
        out = out.filter((x) => x !== q);
        gone.add(q);
        changed = true;
      }
    }
  }
  return out;
}

export const PERMISSION_LABELS = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.value, i.label])),
);

/**
 * Flat, ordered catalogue — the design's employee drawer lists every
 * permission in one column with no group headings, M1's trio first.
 */
export const PERMISSION_LIST = PERMISSION_GROUPS.flatMap((g) => g.items);
