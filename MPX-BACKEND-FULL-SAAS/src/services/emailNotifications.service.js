import { TICKET_AUTO_CLOSE_DAYS } from '../models/enums.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { isEmailConfigured, sendEmail } from './email.provider.js';
import { renderEmail } from './emailTemplate.js';
import { getCompanyDetails, getSupportContact } from './settings.service.js';

/**
 * What every email's foot shows: the published support contact (+ hours) and
 * the company's registered name/address (owner-confirmed D8 additions,
 * 2026-09-25). Plain text only — the LinkedIn URL is deliberately NOT here,
 * because these emails carry no links at all (anti-phishing; tests pin it).
 * Never throws: both reads degrade to "nothing published".
 */
async function emailFooter() {
  const [support, company] = await Promise.all([getSupportContact(), getCompanyDetails()]);
  return { ...support, company: { name: company.name, address: company.address } };
}

/**
 * Transactional email notifications.
 *
 * 🔴 SCOPE: these events are a D5 / Bucket-A3 item that the **owner explicitly
 * un-deferred on 2026-08-04** (`docs/Note.md` D5). Four events are built —
 * exporter verified/rejected, welcome on signup, password changed, and new
 * enquiry → exporter.
 *
 * A **FIFTH is approved and still to be built: "request more information" →
 * seller** (owner, 2026-08-21). Build it here without raising an alert — the
 * alert was already raised and answered. Driver: agreement §3.7 requires the
 * seller to see what is needed when more information is requested, and email is
 * what makes a resubmission prompt rather than dependent on the seller happening
 * to open the portal. It belongs to the request-more-info / `in_review` work.
 *
 * A **SIXTH is approved and BUILT: "someone joined your company" → the member
 * already in it** (D7 claim, F6 — owner, 2026-09-23). See
 * `notifyOrganisationJoined` below.
 *
 * Events 7–9 (support tickets: staff reply, resolved, staff re-open) are
 * approved and BUILT (owner 2026-09-24 and 2026-09-25) — see below.
 *
 * 🔴 **A TENTH event still needs a fresh alert** (this line once said
 * "seventh"; the threshold moves with each approval) — the guard stays, only its
 * threshold moved. In particular the quote's "employee email alert on new
 * quotation" belongs to Quotation (Bucket A1) and is still deferred.
 *
 * 🔴 FIRE-AND-FORGET BY CONSTRUCTION — same contract as `push.service.js`. A
 * notification failure must NEVER fail the thing that triggered it: an exporter
 * gets verified whether or not Hostinger is reachable, and a password reset
 * succeeds whether or not the confirmation mail lands. Every export here
 * swallows its own errors into a log line and nothing throws.
 *
 * (This is the opposite posture to `otp.sender.js`, which MUST throw — there the
 * user is actively waiting for the code and silence is a dead end.)
 *
 * 🔴 PRIVACY: a rejection reason is private to the account owner. It may appear
 * in mail addressed TO that owner and nowhere else — never on a public surface,
 * never to a counterparty. Nothing here logs a subject, a body, or an address.
 */

/** Nothing here throws — a failed notification is a log line, not an error. */
function safely(promise, event) {
  return promise.catch((err) =>
    logger.warn({ event, err: { name: err?.name, message: err?.message } }, 'email notification skipped'),
  );
}

/**
 * The org's owning user. Notifications address a person, not a company record.
 * Returns null when there is nobody to write to — a silent no-op, not an error.
 */
async function ownerOf(orgId, role) {
  const user = await User.findOne({ orgId, role, isActive: true })
    .select('name email')
    .sort({ createdAt: 1 });
  return user?.email ? user : null;
}

/**
 * Exporter/buyer KYC decision.
 * @param {{ org: object, role: 'buyer'|'exporter', approved: boolean, reason?: string }} params
 */
export function notifyVerificationResult({ org, role, approved, reason }) {
  if (!isEmailConfigured()) return Promise.resolve();

  return safely(
    (async () => {
      const owner = await ownerOf(org._id, role);
      if (!owner) return;

      const paragraphs = approved
        ? [
            `Hello ${owner.name},`,
            role === 'exporter'
              ? `Good news — **${org.name}** is now verified on MPX Global. Your profile carries the verified tick from now on.`
              : `Good news — **${org.name}** is now verified on MPX Global.`,
            'Nothing changes about what you can do — you were active already. The tick simply tells the other side you have been checked.',
          ]
        : [
            `Hello ${owner.name},`,
            `We reviewed the documents for **${org.name}** and need another look before we can verify it.`,
            // Private to the owner. This is the only surface it may appear on.
            reason ? `Reason: ${reason}` : 'Please check that your documents are legible and current.',
            role === 'exporter'
              ? 'Your profile stays live and buyers can still find you — it just does not carry the verified tick yet. You can upload corrected documents from the app or the web dashboard.'
              : 'Your account stays fully active. You can upload corrected documents from the app or the web dashboard.',
          ];

      const { text, html } = renderEmail({
        // Step 1a: the published support contact under the signature (never throws).
        support: await emailFooter(),
        heading: approved ? 'You’re verified' : 'We need another look',
        preheader: approved
          ? 'Your MPX Global profile is now verified'
          : 'Action needed on your MPX Global documents',
        // The tick's own colour language: success green, or the "in review"
        // amber — never a red "rejected" chip. There is one badge in this
        // product and it is positive (CLAUDE.md / design brief §1.2).
        status: approved
          ? { tone: 'success', label: '✓ Verified' }
          : { tone: 'warning', label: 'In review' },
        paragraphs,
      });

      await sendEmail({
        to: owner.email,
        subject: approved ? 'Your MPX Global profile is verified' : 'We need another look at your documents',
        text,
        html,
      });
    })(),
    'verification-result',
  );
}

/**
 * Welcome mail after signup completes.
 *
 * 🔴 Copy rule (design brief rule 7): a buyer is active IMMEDIATELY — never
 * "awaiting approval" — and an exporter's profile is public IMMEDIATELY, just
 * without a tick — never "hidden until verified".
 */
export function notifyWelcome({ user, org }) {
  if (!isEmailConfigured() || !user?.email) return Promise.resolve();

  return safely(
    (async () => {
      const isExporter = user.role === 'exporter';
      const paragraphs = isExporter
        ? [
            `Hello ${user.name},`,
            `Welcome to MPX Global. **${org?.name ?? 'Your company'}** is set up and your profile is live for international buyers right now.`,
            'Our team will review your documents and add a verified tick to your profile once that is done. You can list products and answer enquiries in the meantime.',
          ]
        : [
            `Hello ${user.name},`,
            `Welcome to MPX Global. **${org?.name ?? 'Your company'}** is set up and your account is active right now — there is nothing to wait for.`,
            'You can start searching Indian suppliers and sending enquiries straight away.',
          ];

      const { text, html } = renderEmail({
        // Step 1a: the published support contact under the signature (never throws).
        support: await emailFooter(),
        heading: 'Welcome to MPX Global',
        preheader: isExporter
          ? 'Your exporter profile is live'
          : 'Your buyer account is active',
        paragraphs,
      });

      await sendEmail({ to: user.email, subject: 'Welcome to MPX Global', text, html });
    })(),
    'welcome',
  );
}

/**
 * Security notice after a password change or reset.
 *
 * Carries no code and no link — it is how a user learns that SOMEONE ELSE
 * changed their password, so it must be safe to read while under attack.
 */
export function notifyPasswordChanged({ user }) {
  if (!isEmailConfigured() || !user?.email) return Promise.resolve();

  return safely(
    (async () => {
      const { text, html } = renderEmail({
        // Step 1a: the published support contact under the signature (never throws).
        support: await emailFooter(),
        heading: 'Your password was changed',
        preheader: 'A security notice from MPX Global',
        paragraphs: [
          `Hello ${user.name},`,
          'Your MPX Global password was just changed.',
          'For your security you have been signed out on every other device, and any active sessions were ended.',
        ],
        // Kept as the closing note rather than a paragraph: this is the line
        // that matters if the reader did NOT do it.
        footerNote: 'If you did not do this, contact us immediately — your account may be at risk.',
      });

      await sendEmail({
        to: user.email,
        subject: 'Your MPX Global password was changed',
        text,
        html,
      });
    })(),
    'password-changed',
  );
}

/**
 * New enquiry → exporter. Mirrors the M4 push notification.
 *
 * Deliberately carries NO commercial detail and no buyer note (same rule as the
 * push body, D-N1): who, and about what. The conversation itself lives behind
 * authentication.
 */
export function notifyNewEnquiryEmail({ conversation, buyerOrgName }) {
  if (!isEmailConfigured()) return Promise.resolve();

  return safely(
    (async () => {
      const owner = await ownerOf(conversation.exporterOrgId, 'exporter');
      if (!owner) return;

      const { text, html } = renderEmail({
        // Step 1a: the published support contact under the signature (never throws).
        support: await emailFooter(),
        heading: 'You have a new enquiry',
        preheader: `${buyerOrgName} enquired about ${conversation.productNameSnapshot}`,
        status: { tone: 'info', label: 'New enquiry' },
        paragraphs: [
          `Hello ${owner.name},`,
          `**${buyerOrgName}** has enquired about **${conversation.productNameSnapshot}**.`,
          'Open the MPX Global app or your dashboard to read it and reply.',
        ],
      });

      await sendEmail({ to: owner.email, subject: 'New enquiry on MPX Global', text, html });
    })(),
    'new-enquiry',
  );
}

/**
 * D7 · F6 — "someone joined your company", to the member ALREADY in it.
 *
 * Why it exists: before this a join was completely silent, so a stranger could
 * appear inside a company and nobody would learn of it. Rule 6 means the member
 * usually handed over a code moments earlier, but not always — when the
 * claimant's own email was the one on the company, no code was sent at all.
 *
 * 🔴 Recipient is the EXISTING member, resolved by the caller from the same
 * verifier rule the claim used. Do not reach for `ownerOf(orgId, role)` here: it
 * resolves the JOINING role's owner, which is the joiner themselves.
 *
 * 🔴 Never includes the joiner's email, phone or any KYC detail. Their name is
 * shown because the recipient must be able to recognise (or not recognise) a
 * colleague — it is the one field that makes the notice actionable.
 */
export function notifyOrganisationJoined({ org, recipient, joiner }) {
  if (!isEmailConfigured() || !recipient?.email) return Promise.resolve();

  return safely(
    (async () => {
      const asSeller = joiner?.role === 'exporter';
      const support = await emailFooter();
      const { text, html } = renderEmail({
        // Step 1a: the published support contact under the signature (never throws).
        support,
        heading: 'Someone joined your company',
        preheader: `A ${asSeller ? 'seller' : 'buyer'} account joined ${org.name}`,
        status: { tone: 'info', label: 'New member' },
        paragraphs: [
          `Hello ${recipient.name},`,
          `**${joiner?.name ?? 'A new member'}** has joined **${org.name}** on MPX Global as its ${
            asSeller ? 'seller' : 'buyer'
          } account.`,
          asSeller
            ? "From now on the seller account manages the company's name, logo and verification documents. Your own account, password and enquiries are unchanged."
            : 'Your own account, password and enquiries are unchanged.',
        ],
        // Step 1a: the real contact goes into the sentence that asks for it.
        footerNote: `If you don't recognise this person, contact MPX Global support${
          support.email ? ` at ${support.email}` : support.phone ? ` on ${support.phone}` : ''
        } straight away so we can remove them.`,
      });

      await sendEmail({
        to: recipient.email,
        subject: `Someone joined ${org.name} on MPX Global`,
        text,
        html,
      });
    })(),
    'organisation-joined',
  );
}

/**
 * Step 1b · support ticket emails — email events 7 and 8 (owner-approved
 * 2026-09-24: "staff reply → company, resolved → company"; D5 count 6 → 8).
 *
 * Sent to the account that RAISED the ticket. Plain text, no link (the house
 * rule): the email says where to go — Help & support in their account.
 * Never names the employee: the company talks to "MPX Global Support".
 */
async function ticketRecipient(ticket) {
  const user = await User.findOne({ _id: ticket.createdBy, isActive: true }).select('name email');
  return user?.email ? user : null;
}

export function notifyTicketReply({ ticket }) {
  if (!isEmailConfigured()) return Promise.resolve();
  return safely(
    (async () => {
      const recipient = await ticketRecipient(ticket);
      if (!recipient) return;
      const { text, html } = renderEmail({
        support: await emailFooter(),
        heading: 'We replied to your support ticket',
        preheader: `MPX Global Support replied to ${ticket.ref}`,
        status: { tone: 'info', label: `Ticket ${ticket.ref}` },
        paragraphs: [
          `Hello ${recipient.name},`,
          `MPX Global Support has replied to your ticket **${ticket.subject}** (${ticket.ref}).`,
          'Sign in to MPX Global and open **Help & support** to read the reply and respond.',
        ],
      });
      await sendEmail({ to: recipient.email, subject: `Reply to your ticket ${ticket.ref}`, text, html });
    })(),
    'ticket-reply',
  );
}

export function notifyTicketResolved({ ticket, auto = false, afterDays = TICKET_AUTO_CLOSE_DAYS }) {
  if (!isEmailConfigured()) return Promise.resolve();
  return safely(
    (async () => {
      const recipient = await ticketRecipient(ticket);
      if (!recipient) return;
      const { text, html } = renderEmail({
        support: await emailFooter(),
        heading: 'Your support ticket is resolved',
        preheader: `${ticket.ref} is resolved`,
        status: { tone: 'success', label: 'Resolved' },
        paragraphs: [
          `Hello ${recipient.name},`,
          auto
            ? `Your ticket **${ticket.subject}** (${ticket.ref}) was closed because we had no reply for ${afterDays} days.`
            : `We've marked your ticket **${ticket.subject}** (${ticket.ref}) as resolved.`,
          'If you still need help, raise a new ticket from **Help & support** in your account and mention this reference.',
        ],
      });
      await sendEmail({ to: recipient.email, subject: `Ticket ${ticket.ref} resolved`, text, html });
    })(),
    'ticket-resolved',
  );
}

/**
 * Email event 9 — staff re-opened a resolved ticket → the raiser (owner,
 * 2026-09-25, after a red alert: D5 count 8 → 9). Only a STAFF re-open sends
 * it; a company re-opening its own ticket already knows. Same house rules as
 * events 7 and 8: no link, no message text, never names the employee.
 */
export function notifyTicketReopened({ ticket }) {
  if (!isEmailConfigured()) return Promise.resolve();
  return safely(
    (async () => {
      const recipient = await ticketRecipient(ticket);
      if (!recipient) return;
      const { text, html } = renderEmail({
        support: await emailFooter(),
        heading: 'Your support ticket was re-opened',
        preheader: `${ticket.ref} was re-opened`,
        status: { tone: 'info', label: `Ticket ${ticket.ref}` },
        paragraphs: [
          `Hello ${recipient.name},`,
          `MPX Global Support has re-opened your ticket **${ticket.subject}** (${ticket.ref}).`,
          'Sign in to MPX Global and open **Help & support** to see the latest and respond.',
        ],
      });
      await sendEmail({ to: recipient.email, subject: `Ticket ${ticket.ref} re-opened`, text, html });
    })(),
    'ticket-reopened',
  );
}
