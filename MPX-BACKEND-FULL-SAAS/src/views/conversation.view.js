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

import { presentBody } from '../utils/messageText.js';
import { signedChatDocumentUrl, signedChatImageUrl } from '../services/chatAttachment.storage.service.js';
import { FREEZE_NOTICES } from '../services/conversationFreeze.service.js';

/**
 * The kind of a system notice written BEFORE `systemKind` existed (pre
 * 2026-08-18). Those rows can never be tagged — messages are append-only
 * (M4-13) — so they rendered as a plain "Platform notice", and a block looked
 * like any other notice (owner, 2026-09-24).
 *
 * Recognised on READ from the platform's own fixed wording. Nothing is written.
 * Deliberately limited to untagged rows: a tagged row always uses its tag, so
 * rewording a notice today can never change how a new message renders — only
 * these frozen historical sentences are matched.
 */
function legacySystemKind(body = '') {
  // Read at call time, not module load: the freeze service imports this view
  // (a cycle), so FREEZE_NOTICES is not initialised when this file first runs.
  const blockedPrefix = FREEZE_NOTICES.blocked('').replace(/\s*Reason:\s*$/, '');
  if (body.startsWith(blockedPrefix)) return 'blocked';
  if (body === FREEZE_NOTICES.unblocked) return 'unblocked';
  if (body === FREEZE_NOTICES.takedown) return 'product_takedown';
  if (body === FREEZE_NOTICES.restored) return 'product_restored';
  if (body === FREEZE_NOTICES.account) return 'account_paused';
  if (body === FREEZE_NOTICES.accountRestored) return 'account_restored';
  return null;
}

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
    lastMessagePreview: presentBody(conversation.lastMessagePreview ?? null),
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
    lastMessagePreview: presentBody(conversation.lastMessagePreview ?? null),
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
 * D9/D10 · the attachment as a client sees it. `kind` is always present on the
 * way out (an image stored before D10 has none — M4-13 forbids backfilling it).
 * A document carries its cleaned name, type and size so the bubble can say what
 * it is before anyone downloads it; its URL is a forced download.
 */
export function attachmentView(att) {
  if (!att?.storageKey) return null;
  if (att.kind === 'document') {
    return {
      kind: 'document',
      url: signedChatDocumentUrl({ storageKey: att.storageKey }),
      // PDFs only: a second link that OPENS in the browser's viewer. Null for
      // .docx/.xlsx — a browser cannot show them without a third party.
      viewUrl: att.format === 'pdf' ? signedChatDocumentUrl({ storageKey: att.storageKey, inline: true }) : null,
      name: att.name ?? `document.${att.format}`,
      format: att.format,
      bytes: att.bytes ?? null,
    };
  }
  return {
    kind: 'image',
    url: signedChatImageUrl({ storageKey: att.storageKey, format: att.format }),
    width: att.width ?? null,
    height: att.height ?? null,
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
    systemKind:
      message.senderType === 'system' ? (message.systemKind ?? legacySystemKind(message.body)) : null,
    // Presentation rules for append-only text (routed-notice wording, country
    // names) — see utils/messageText.js.
    body: presentBody(message.body, {
      systemKind: message.senderType === 'system' ? (message.systemKind ?? legacySystemKind(message.body)) : null,
    }),
    /**
     * D9 · the image, as a SHORT-LIVED SIGNED URL minted per read.
     *
     * 🔴 `storageKey` never leaves the server. It is the permanent handle; a
     * signed URL is a temporary one. Returning the key — even "just to the two
     * parties" — would hand out something that outlives the TTL and survives
     * being forwarded, which is the whole reason these assets are private.
     *
     * Width and height ride along so a client can reserve the right box before
     * the image loads; without them every attachment shifts the thread as it
     * arrives.
     */
    attachment: attachmentView(message.attachment),
    // Present only on a quotation notice. The client fetches the quotation with
    // it and renders the card live; the id alone discloses nothing, since the
    // quotation itself is two-party scoped on every read.
    quotationId: message.quotationId ? String(message.quotationId) : null,
    createdAt: message.createdAt,
  };
}
