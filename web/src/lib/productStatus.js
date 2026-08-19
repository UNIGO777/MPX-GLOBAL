/**
 * The product status vocabulary — ONE map, used everywhere a status is shown.
 *
 * The stored value and the word the seller reads are deliberately different:
 * `active` reads "Live" and `inactive` reads "Hidden", because "inactive" tells
 * a seller nothing about what buyers can see.
 *
 * 🔴 BLOCKED IS NOT A STATUS. An admin takedown never touches `status` — it sets
 * `takedown.isDown`, so a product can legitimately be "Live · Taken down". Render
 * the blocked chip as an OVERLAY stacked beside whatever status chip the row
 * already has, never as a fifth value in this map, and never as a separate tab.
 *
 * ⚠️ ORDER MATTERS (owner, 2026-08-18). When both are true the TAKEDOWN leads and
 * the seller's own status drops to subordinate text ("Seller had it Live"). A
 * green "Live" chip in front made a taken-down product read as publicly visible,
 * which is the one thing a moderation screen must never imply. Both facts still
 * show — the product really does return to that status on restore.
 *
 * 🔴 `draft` is ONE-WAY. Once published a product can never return to it, so no
 * screen offers a "revert to draft" action.
 */
export const PRODUCT_STATUS_META = {
  draft: { label: 'Draft', tone: 'muted' },
  active: { label: 'Live', tone: 'success' },
  inactive: { label: 'Hidden', tone: 'warning' },
  archived: { label: 'Archived', tone: 'muted' },
};

/** The seller list's tabs, in design order. `all` carries no status filter. */
export const PRODUCT_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Live' },
  { key: 'inactive', label: 'Hidden' },
  { key: 'draft', label: 'Drafts' },
  { key: 'archived', label: 'Archived' },
];

/**
 * Which row actions a product offers, given its state.
 *
 * - Archived is TERMINAL: no actions at all, and the row never opens the form.
 * - A taken-down product is FROZEN for the seller — no Publish, no Hide — but
 *   Edit stays so they can fix the content, and Delete stays available.
 *   (§A9 / the M2 service refuses a status change while `takedown.isDown`.)
 */
export function rowActionsFor(product) {
  if (product.status === 'archived') return [];
  const blocked = Boolean(product.takedown);
  const edit = ['edit'];
  const del = ['delete'];
  if (blocked) return [...edit, ...del];
  if (product.status === 'active') return ['hide', ...edit, ...del];
  return ['publish', ...edit, ...del]; // draft and inactive both publish
}
