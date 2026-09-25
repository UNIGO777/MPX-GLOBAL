import { PERMISSIONS } from '../config/permissions.js';
import { companyUserIds, markReadByRef, notify, staffUserIds } from './notification.service.js';

/**
 * D6 · web notices for seller unblock requests (owner, 2026-09-25: "web notices
 * both ways" — two new notice types, no email). Fire-and-forget like every
 * notice: the request or the decision is already saved.
 *
 * 🔴 A9: nothing here names the staff member who decided. The seller hears
 * "MPX Global", never a person.
 */
const staffRef = (product) => `staff-unblock:${product._id}`;
const sellerLink = (product) => `/exporter/products/${product._id}/edit`;
const reviewers = () => staffUserIds([PERMISSIONS.PRODUCT_TAKEDOWN]);

/** New request → staff who can restore products. */
export function notifyUnblockRequested({ product, sellerName }) {
  (async () => {
    await notify(await reviewers(), {
      type: 'product.unblock_requested',
      title: `Unblock request: ${product.name}`,
      body: sellerName ?? null,
      link: '/admin/products?status=requests',
      refKey: staffRef(product),
    });
  })().catch(() => {});
}

/** Once decided, the "please review" notice is done for every reviewer. */
function clearStaffNotices(product) {
  (async () => {
    for (const userId of await reviewers()) await markReadByRef({ userId, refKey: staffRef(product) });
  })().catch(() => {});
}

export function notifyUnblockApproved(product) {
  clearStaffNotices(product);
  (async () => {
    await notify(await companyUserIds(product.exporterOrgId, 'exporter'), {
      type: 'product.unblock_approved',
      title: `${product.name} is back online`,
      body: 'Your unblock request was approved.',
      link: sellerLink(product),
      orgId: product.exporterOrgId,
    });
  })().catch(() => {});
}

export function notifyUnblockRejected(product) {
  clearStaffNotices(product);
  (async () => {
    await notify(await companyUserIds(product.exporterOrgId, 'exporter'), {
      type: 'product.unblock_rejected',
      title: `Unblock request declined: ${product.name}`,
      body: 'Open the product to see why.',
      link: sellerLink(product),
      orgId: product.exporterOrgId,
    });
  })().catch(() => {});
}
