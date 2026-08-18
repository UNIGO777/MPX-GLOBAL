/**
 * Is this conversation's product still reachable on a public page?
 *
 * 🔴 Never link to a page that will 404, and this is the ONE definition of that
 * rule — it is needed wherever a product is offered as a link (the thread
 * header, the dock's title bar), and two copies would drift.
 *
 * M4-22 drops the link when the product is PURGED, which is covered by
 * `product.slug` being null. But a product UNDER REVIEW is equally unreachable
 * publicly — takedown removes it from every public query — while the
 * conversation still carries its slug, so a link took a buyer from "this product
 * is under review" straight to a not-found page.
 */
export function productPageLive(conversation) {
  return (
    Boolean(conversation?.product?.slug) &&
    conversation?.frozenLabel?.text !== 'Product under review'
  );
}
