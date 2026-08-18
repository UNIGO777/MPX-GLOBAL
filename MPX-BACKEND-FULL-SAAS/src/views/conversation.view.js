/**
 * M4 — the public shapes of a thread and a message.
 *
 * Whitelists, never blacklists: a field reaches a client only by appearing here.
 * Two fields are the reason this file exists at all —
 *   `blockedBy`      — WHO blocked the chat. Both parties see the REASON (M4-25);
 *                      neither ever sees the acting admin, exactly as a seller
 *                      never sees `takedown.byUserId` (§A9).
 *   `senderUserId`   — WHICH person sent a line. M4-17 is explicit that threads
 *                      show COMPANY names, never person names.
 * Both are stored (we need them for audit) and neither is ever serialised to a
 * party. Widening this file is how they would leak.
 */

const PLATFORM_NAME = 'MPX Global';

/**
 * M4-18 — nothing is stored as a "title". It is composed at read time from the
 * live product while it exists, and from the snapshot once it is purged.
 */
function productName(conversation, product) {
  return product?.name ?? conversation.productNameSnapshot;
}

/**
 * M4-17 — the title depends on who is looking, and always names COMPANIES.
 *   buyer    → product × seller company
 *   exporter → product × buyer company
 *   staff    → buyer × seller × product
 */
function composeTitle(conversation, product, viewerSide) {
  const name = productName(conversation, product);
  if (viewerSide === 'buyer') return `${name} × ${conversation.exporterOrgName}`;
  if (viewerSide === 'exporter') return `${name} × ${conversation.buyerOrgName}`;
  return `${conversation.buyerOrgName} × ${conversation.exporterOrgName} × ${name}`;
}

/**
 * M4-19 — colour NEVER carries meaning alone; every label pairs a tone with text.
 * M4-21 / M4-22 / C5 decide which one applies:
 *   product taken down, row still there → yellow, and still reversible
 *   product purged (row gone)          → red, derived at read time, never stored
 *   chat blocked by an admin           → red
 * M4-29 means `frozenReason` holds the FIRST reason, so a chat blocked before a
 * takedown keeps the block label — which is what a moderator needs to see.
 */
function freezeLabel(conversation, productExists) {
  if (conversation.frozenReason === 'blocked') {
    return { tone: 'red', text: 'Conversation blocked by MPX Global' };
  }
  if (!productExists) {
    return { tone: 'red', text: 'Product no longer available' };
  }
  if (conversation.frozenReason === 'takedown') {
    return { tone: 'yellow', text: 'Product under review' };
  }
  return { tone: 'none', text: null };
}

/**
 * M4-1 — the platform's presence stays visible in the participant list, not just
 * in the opening message. It is still never a member of `parties` (M4-2): this is
 * composed for display, and admin access comes from role, never from membership.
 */
function participants(conversation) {
  return [
    { type: 'buyer', name: conversation.buyerOrgName },
    { type: 'exporter', name: conversation.exporterOrgName },
    { type: 'platform', name: PLATFORM_NAME },
  ];
}

// §7.5 — unread is DERIVED, never counted or stored. Equal timestamps count as
// read, which is what makes a thread not show unread to the buyer who just
// opened it.
export function isUnread(conversation, viewerSide) {
  const readAt = viewerSide === 'buyer' ? conversation.buyerLastReadAt : conversation.exporterLastReadAt;
  if (!conversation.lastMessageAt) return false;
  if (!readAt) return true;
  return conversation.lastMessageAt.getTime() > readAt.getTime();
}

/** The view for a party to the thread (buyer or exporter). */
export function conversationPartyView(conversation, { viewerSide, product, logos }) {
  const productExists = Boolean(product);
  return {
    id: String(conversation._id),
    title: composeTitle(conversation, product, viewerSide),
    product: {
      // Null once purged — M4-22's "no link to a page that no longer exists".
      id: productExists ? String(product._id) : null,
      slug: product?.slug ?? null,
      name: productName(conversation, product),
    },
    counterparty: {
      name: viewerSide === 'buyer' ? conversation.exporterOrgName : conversation.buyerOrgName,
      // 🔴 One display field, added 2026-08-17 (owner) — the company ICON, for
      // the list avatar and the thread header. Deliberately NOT the org: no id,
      // no country, no verification. An exporter's logo is public anyway; a
      // BUYER's is not, and reaches the seller only because the two are already
      // party to this conversation.
      logo:
        (logos?.get(
          String(viewerSide === 'buyer' ? conversation.exporterOrgId : conversation.buyerOrgId),
        )) ?? null,
    },
    participants: participants(conversation),
    lastMessageAt: conversation.lastMessageAt ?? null,
    lastMessagePreview: conversation.lastMessagePreview ?? null,
    unread: isUnread(conversation, viewerSide),
    frozen: Boolean(conversation.frozen),
    frozenLabel: freezeLabel(conversation, productExists),
    // M4-25: the reason, never the admin behind it.
    blockedReason: conversation.blockedReason ?? null,
    createdAt: conversation.createdAt ?? null,
  };
}

/**
 * The staff view. Adds what a moderator needs and a party must never have:
 * both org identities, the acting admin, and the raw freeze reason.
 */
export function conversationStaffView(conversation, { product, logos }) {
  const productExists = Boolean(product);
  return {
    id: String(conversation._id),
    title: composeTitle(conversation, product, 'staff'),
    product: {
      id: productExists ? String(product._id) : null,
      slug: product?.slug ?? null,
      name: productName(conversation, product),
    },
    buyerOrg: {
      id: String(conversation.buyerOrgId),
      name: conversation.buyerOrgName,
      logo: logos?.get(String(conversation.buyerOrgId)) ?? null,
    },
    exporterOrg: {
      id: String(conversation.exporterOrgId),
      name: conversation.exporterOrgName,
      logo: logos?.get(String(conversation.exporterOrgId)) ?? null,
    },
    participants: participants(conversation),
    lastMessageAt: conversation.lastMessageAt ?? null,
    lastMessagePreview: conversation.lastMessagePreview ?? null,
    // m5-features #10 — THE PARTIES' unread, not the admin's. Staff have no
    // read-tracking of their own and reading a thread as admin must never mark
    // it read for anyone; these are derived from the two stored timestamps, the
    // same comparison the parties see. It is how a moderator spots a thread the
    // seller never opened.
    unread: {
      buyer: isUnread(conversation, 'buyer'),
      exporter: isUnread(conversation, 'exporter'),
    },
    frozen: Boolean(conversation.frozen),
    frozenReason: conversation.frozenReason ?? null,
    frozenLabel: freezeLabel(conversation, productExists),
    blockedReason: conversation.blockedReason ?? null,
    blockedBy: conversation.blockedBy ? String(conversation.blockedBy) : null,
    blockedAt: conversation.blockedAt ?? null,
    createdAt: conversation.createdAt ?? null,
  };
}

/**
 * One line, for EVERY viewer — party and staff alike.
 * `senderUserId` and `senderOrgId` are deliberately absent: `senderType` is all
 * anyone needs to render the thread, and a person's identity is not ours to show.
 */
export function messageView(message) {
  return {
    id: String(message._id),
    senderType: message.senderType,
    // What the platform's own notice is ABOUT, so a client can tone a block
    // differently from a reopen without matching on the copy. Null on every
    // party message, and on system notices written before the field existed —
    // messages are append-only (M4-13), so those can never be backfilled.
    systemKind: message.senderType === 'system' ? (message.systemKind ?? null) : null,
    body: message.body,
    createdAt: message.createdAt,
  };
}
