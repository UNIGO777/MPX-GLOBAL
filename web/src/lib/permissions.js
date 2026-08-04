/**
 * Mirror of the backend permission catalogue (src/config/permissions.js — 14
 * grantable strings). The SERVER is the authority: it validates every grant
 * against its own list, so an entry here that drifted would simply be rejected
 * with a 400. This mirror exists only to render labels and grouping.
 *
 * Governance actions (activate/deactivate, employee create, permission
 * assignment, org block) are deliberately absent — they are hard superadmin
 * role gates on the server and must never appear as grantable options.
 */

export const PERMISSION_GROUPS = [
  {
    group: 'Verification',
    items: [
      { value: 'buyer:approve', label: 'Approve buyers', help: 'Decide on buyer verification' },
      { value: 'exporter:verify', label: 'Verify exporters', help: 'Decide on exporter verification' },
      { value: 'kyc:view', label: 'View KYC documents', help: 'Open submitted identity documents (access is audited)' },
    ],
  },
  {
    group: 'Directory',
    items: [
      { value: 'user:read', label: 'View user directory', help: 'Read-only access to the user list' },
      { value: 'organisation:read', label: 'View organisations', help: 'Company list and detail (read-only)' },
    ],
  },
  {
    group: 'Catalogue',
    items: [
      { value: 'category:read', label: 'View categories', help: 'Admin category tree (read-only)' },
      { value: 'category:manage', label: 'Manage categories', help: 'Sub-category and attribute management' },
      { value: 'product:read', label: 'Monitor products', help: 'Product monitoring list (read-only)' },
      { value: 'product:takedown', label: 'Take down products', help: 'Take down and restore listings' },
    ],
  },
  {
    group: 'Conversations',
    items: [
      { value: 'conversation:read', label: 'Read conversations', help: 'Open any chat thread (every read is audited)' },
      { value: 'conversation:block', label: 'Block conversations', help: 'Block and unblock a chat' },
    ],
  },
  {
    group: 'Oversight',
    items: [
      { value: 'audit:read', label: 'View audit log', help: 'The record of every staff action' },
      { value: 'errorlog:read', label: 'View error log', help: 'Server error entries (debugging)' },
      { value: 'featured:manage', label: 'Manage featured content', help: 'Landing-page banners and featured items' },
    ],
  },
];

export const PERMISSION_LABELS = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.value, i.label])),
);

/**
 * Flat, ordered catalogue — the design's employee drawer lists every
 * permission in one column with no group headings, M1's trio first.
 */
export const PERMISSION_LIST = PERMISSION_GROUPS.flatMap((g) => g.items);
