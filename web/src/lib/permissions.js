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
    ],
  },
  {
    group: 'Governance records',
    items: [
      { value: 'organisation:read', label: 'View organisations', help: 'Company list and detail (read-only)' },
      { value: 'audit:read', label: 'View audit log', help: 'Includes the record of every KYC document and chat staff have viewed' },
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

export const PERMISSION_LABELS = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.value, i.label])),
);

/**
 * Flat, ordered catalogue — the design's employee drawer lists every
 * permission in one column with no group headings, M1's trio first.
 */
export const PERMISSION_LIST = PERMISSION_GROUPS.flatMap((g) => g.items);
