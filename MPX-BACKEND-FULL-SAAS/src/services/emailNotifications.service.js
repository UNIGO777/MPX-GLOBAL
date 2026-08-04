import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { isEmailConfigured, sendEmail } from './email.provider.js';
import { renderEmail } from './emailTemplate.js';

/**
 * Transactional email notifications.
 *
 * 🔴 SCOPE: these events are a D5 / Bucket-A3 item that the **owner explicitly
 * un-deferred on 2026-08-04** (`docs/Note.md` D5). Exactly four events are
 * approved — exporter verified/rejected, welcome on signup, password changed,
 * and new enquiry → exporter. **Do not add a fifth without a new alert.** In
 * particular the quote's "employee email alert on new quotation" belongs to
 * Quotation (Bucket A1) and is still deferred.
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
