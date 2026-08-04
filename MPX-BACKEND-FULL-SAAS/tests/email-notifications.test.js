import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Email notifications (the four events the owner un-deferred from D5 on
 * 2026-08-04).
 *
 * Two properties matter more than the copy itself:
 *
 *  1. **Fire-and-forget.** A notification failure must never fail the thing that
 *     triggered it. An exporter gets verified whether or not SMTP is reachable.
 *  2. **The copy obeys the product rules** — brief rule 7 (a buyer is active
 *     immediately, an exporter is public immediately without a tick) and the
 *     privacy rule that a rejection reason is owner-only.
 */

const email = vi.hoisted(() => ({ send: vi.fn(), configured: true }));
const users = vi.hoisted(() => ({ owner: null }));
const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock('../src/services/email.provider.js', () => ({
  isEmailConfigured: () => email.configured,
  sendEmail: email.send,
}));

vi.mock('../src/utils/logger.js', () => ({ logger: log }));

vi.mock('../src/models/User.js', () => ({
  User: {
    findOne: () => ({
      select: () => ({ sort: async () => users.owner }),
    }),
  },
}));

const {
  notifyVerificationResult,
  notifyWelcome,
  notifyPasswordChanged,
  notifyNewEnquiryEmail,
} = await import('../src/services/emailNotifications.service.js');

const OWNER = { name: 'Asha', email: 'asha@exportco.in' };
const ORG = { _id: 'org1', name: 'Export Co' };

beforeEach(() => {
  email.configured = true;
  email.send.mockReset().mockResolvedValue({ messageId: 'm1' });
  users.owner = OWNER;
  log.warn.mockReset();
});

afterEach(() => vi.restoreAllMocks());

/** The single most recent outgoing message. */
function lastMail() {
  return email.send.mock.calls.at(-1)[0];
}

describe('🔴 fire-and-forget — a notification never breaks its trigger', () => {
  it('resolves even when SMTP throws', async () => {
    email.send.mockRejectedValue(new Error('smtp: message could not be sent'));

    await expect(
      notifyVerificationResult({ org: ORG, role: 'exporter', approved: true }),
    ).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalled();
  });

  it('resolves for every event when SMTP throws', async () => {
    email.send.mockRejectedValue(new Error('boom'));

    await expect(notifyWelcome({ user: { name: 'A', email: 'a@b.c', role: 'buyer' }, org: ORG })).resolves.toBeUndefined();
    await expect(notifyPasswordChanged({ user: OWNER })).resolves.toBeUndefined();
    await expect(
      notifyNewEnquiryEmail({ conversation: { exporterOrgId: 'o', productNameSnapshot: 'Cotton' }, buyerOrgName: 'B' }),
    ).resolves.toBeUndefined();
  });

  it('is a silent no-op when SMTP is unconfigured', async () => {
    email.configured = false;
    await notifyVerificationResult({ org: ORG, role: 'exporter', approved: true });
    expect(email.send).not.toHaveBeenCalled();
  });

  it('is a no-op when the org has no reachable owner', async () => {
    users.owner = null;
    await notifyVerificationResult({ org: ORG, role: 'exporter', approved: true });
    expect(email.send).not.toHaveBeenCalled();
  });
});

describe('verification result', () => {
  it('tells a verified exporter about the tick', async () => {
    await notifyVerificationResult({ org: ORG, role: 'exporter', approved: true });

    const mail = lastMail();
    expect(mail.to).toBe(OWNER.email);
    expect(mail.subject).toMatch(/verified/i);
    expect(mail.text).toContain('Export Co');
  });

  it('includes the rejection reason — it is private to the OWNER, who is the recipient', async () => {
    await notifyVerificationResult({
      org: ORG,
      role: 'exporter',
      approved: false,
      reason: 'GST certificate is illegible',
    });

    expect(lastMail().text).toContain('GST certificate is illegible');
  });

  it('🔴 never tells a rejected exporter their profile is hidden (rule 7)', async () => {
    await notifyVerificationResult({ org: ORG, role: 'exporter', approved: false, reason: 'blurry' });

    const body = lastMail().text.toLowerCase();
    expect(body).toContain('stays live');
    expect(body).not.toMatch(/hidden|suspended|deactivat|removed/);
  });

  it('copes with a rejection that carries no reason', async () => {
    await notifyVerificationResult({ org: ORG, role: 'exporter', approved: false });
    expect(lastMail().text).toMatch(/legible|current/i);
  });
});

describe('welcome copy obeys rule 7', () => {
  it('tells a BUYER they are active immediately — never "awaiting approval"', async () => {
    await notifyWelcome({ user: { name: 'Sam', email: 's@b.com', role: 'buyer' }, org: ORG });

    const body = lastMail().text.toLowerCase();
    expect(body).toContain('active right now');
    // D3: there is no buyer approval gate, so the copy must never imply one.
    expect(body).not.toMatch(/await|pending approval|once approved|under review/);
  });

  it('tells an EXPORTER they are live immediately, tick to follow', async () => {
    await notifyWelcome({ user: { name: 'Asha', email: 'a@e.in', role: 'exporter' }, org: ORG });

    const body = lastMail().text.toLowerCase();
    expect(body).toContain('live');
    expect(body).not.toMatch(/hidden until|not visible|once verified you will appear/);
  });
});

describe('password-changed notice', () => {
  it('says other sessions ended, and carries no code or link', async () => {
    await notifyPasswordChanged({ user: OWNER });

    const mail = lastMail();
    expect(mail.text).toMatch(/signed out/i);
    // It must be safe to read while under attack: nothing to click, nothing to type.
    expect(mail.text).not.toMatch(/https?:\/\//);
    expect(mail.html).not.toMatch(/<a\s/i);
  });
});

describe('🔴 user-controlled names are escaped into the HTML', () => {
  it('a crafted company name cannot inject markup or a link', async () => {
    // Company and buyer names are user-supplied and land in an email that
    // appears to come from us. Unescaped, a crafted name could inject an anchor
    // — a phishing link inside a trusted-sender message.
    const hostile = '<a href="https://evil.example">Click here</a>';

    await notifyVerificationResult({
      org: { _id: 'o', name: hostile },
      role: 'exporter',
      approved: true,
    });

    const mail = lastMail();
    expect(mail.html).not.toMatch(/<a\s+href/i);
    expect(mail.html).toContain('&lt;a href');
  });

  it('escapes a hostile buyer name on the enquiry mail too', async () => {
    await notifyNewEnquiryEmail({
      conversation: { exporterOrgId: 'o1', productNameSnapshot: '<img src=x onerror=alert(1)>' },
      buyerOrgName: '"><script>bad()</script>',
    });

    const mail = lastMail();
    expect(mail.html).not.toMatch(/<script/i);
    // The brand logo is a legit <img>; the HOSTILE one must be ESCAPED, not rendered.
    expect(mail.html).toContain('&lt;img src=x onerror');
    expect(mail.html).not.toContain('<img src=x');
  });
});

describe('branded layout', () => {
  it('renders the navy canopy and carries no link anywhere', async () => {
    await notifyWelcome({ user: { name: 'Sam', email: 's@b.com', role: 'buyer' }, org: ORG });

    const mail = lastMail();
    expect(mail.html).toContain('#1A2E8F'); // brand navy band
    expect(mail.html).toContain('MPX GLOBAL');
    // No CTA button anywhere — adding one is a deliberate decision, not styling.
    expect(mail.html).not.toMatch(/<a\s/i);
    // Brand logo (hybrid, owner 2026-08-04): the Cloudinary <img> is present AND
    // carries the text wordmark as `alt`, so image-blocking clients still show it.
    expect(mail.html).toMatch(/<img\s/i);
    expect(mail.html).toContain('alt="MPX GLOBAL"');
  });

  it('still produces a usable plain-text alternative', async () => {
    await notifyWelcome({ user: { name: 'Sam', email: 's@b.com', role: 'buyer' }, org: ORG });

    const { text } = lastMail();
    expect(text).toContain('Welcome to MPX Global');
    expect(text).toContain('Export Co');
    // Markup markers must not survive into the text part.
    expect(text).not.toContain('**');
    expect(text).not.toMatch(/<[a-z]/i);
  });
});

describe('new enquiry', () => {
  it('names who and what, and leaks no commercial detail (D-N1)', async () => {
    await notifyNewEnquiryEmail({
      conversation: { exporterOrgId: 'o1', productNameSnapshot: 'Cotton Yarn 30s' },
      buyerOrgName: 'Global Textiles BV',
    });

    const mail = lastMail();
    expect(mail.text).toContain('Global Textiles BV');
    expect(mail.text).toContain('Cotton Yarn 30s');
    // The buyer's note, quantity and price live behind auth — never in an email.
    expect(mail.text).not.toMatch(/quantity|price|budget|note:/i);
  });
});
