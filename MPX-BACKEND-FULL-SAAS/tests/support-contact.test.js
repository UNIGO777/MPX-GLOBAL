import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const { createApp } = await import('../src/app.js');
await import('../src/models/index.js');
const { Settings, SETTINGS_ID } = await import('../src/models/Settings.js');

/**
 * Step 1a · GET /public/support-contact.
 *
 * The one guarantee that matters: this is a PUBLIC read of the settings
 * document, so it must return the support email + phone and NOTHING else —
 * the AI spend ceiling and the last editor stay behind the superadmin route.
 * Also: no auth needed (a locked-out user must be able to find support), and
 * "never configured" is a clean null, not an error.
 */
const app = createApp();
let original = null;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  // Restore whatever the dev database had, so this suite never clobbers it.
  original = await Settings.findOne({ _id: SETTINGS_ID }).lean();
});
afterAll(async () => {
  await Settings.deleteOne({ _id: SETTINGS_ID });
  if (original) await Settings.create(original);
  await mongoose.disconnect();
});

describe('GET /public/support-contact', () => {
  it('returns nulls when nothing has been configured', async () => {
    await Settings.deleteOne({ _id: SETTINGS_ID });
    const res = await request(app).get('/public/support-contact');
    expect(res.status).toBe(200);
    expect(res.body.support).toEqual({ email: null, phone: null });
  });

  it('returns ONLY the email and phone — no other settings field leaks', async () => {
    await Settings.findOneAndUpdate(
      { _id: SETTINGS_ID },
      {
        $set: {
          supportEmail: 'help@example.com',
          supportPhone: '+91 90000 00000',
          aiGuestDailyMax: 123,
          updatedBy: new mongoose.Types.ObjectId(),
        },
      },
      { upsert: true, new: true },
    );
    const res = await request(app).get('/public/support-contact');
    expect(res.status).toBe(200);
    expect(res.body.support).toEqual({ email: 'help@example.com', phone: '+91 90000 00000' });
    expect(Object.keys(res.body)).toEqual(['support']);
    expect(Object.keys(res.body.support).sort()).toEqual(['email', 'phone']);
    expect(JSON.stringify(res.body)).not.toContain('123');
  });

  it('needs no sign-in', async () => {
    const res = await request(app).get('/public/support-contact');
    expect(res.status).toBe(200);
  });
});

describe('email template — support line (Step 1a)', async () => {
  const { renderEmail } = await import('../src/services/emailTemplate.js');

  it('adds "Need help?" with the published contact', () => {
    const { text, html } = renderEmail({
      heading: 'Hi',
      paragraphs: ['Body'],
      support: { email: 'help@example.com', phone: '+91 90000 00000' },
    });
    expect(text).toContain('Need help? help@example.com · +91 90000 00000');
    expect(html).toContain('help@example.com');
    // No link — these emails carry none by design (anti-phishing).
    expect(html).not.toMatch(/<a\s/i);
  });

  it('adds nothing when no contact is published', () => {
    const { text, html } = renderEmail({ heading: 'Hi', paragraphs: ['Body'], support: { email: null, phone: null } });
    expect(text).not.toContain('Need help?');
    expect(html).not.toContain('Need help?');
  });

  it('escapes the contact in HTML', () => {
    const { html } = renderEmail({ heading: 'Hi', paragraphs: [], support: { email: 'a<b>@x.com', phone: null } });
    expect(html).not.toContain('a<b>@x.com');
  });
});
