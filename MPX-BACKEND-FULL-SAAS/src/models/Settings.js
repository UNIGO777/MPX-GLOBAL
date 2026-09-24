import mongoose from 'mongoose';

import { declareScope, SCOPE } from './scoping.js';

const { Schema } = mongoose;

/**
 * D8 · Platform settings — ONE document, forever.
 *
 * 🔴 WHY THIS EXISTS AT ALL, because it is one clause and not a general
 * preferences store: agreement **§3.3** says the AI guest daily ceiling "may be
 * changed by the Client **at any time**". Today that number lives in
 * `AI_GUEST_DAILY_MAX`, which needs a `.env` edit and a process restart — i.e.
 * the Client cannot change it at all without us. This document is what makes
 * that sentence literally true.
 *
 * 🔴 WHAT MAY NEVER GO IN HERE (owner-decided 2026-08-21, `docs/Note.md` D8 —
 * do not re-derive these, and do not treat their absence as an omission):
 *   · **NOT the D1 caps** (3 active / 10 drafts). Those numbers are written into
 *     agreement **§3.2**. Making them editable invites someone to set 5 and put
 *     the running platform silently out of step with the contract. They stay as
 *     constants in `product.service.js`.
 *   · **NOT OTP knobs** (TTL, attempts, lock) — security controls, env-only
 *     (`security-baseline.md`).
 *   · **NEVER a secret** — no API key, no SMTP password. `secrets-and-hygiene.md`
 *     is absolute: secrets live in `.env` only. A settings row is readable by
 *     anyone with database access and lands in an AuditLog diff.
 *   · **NOT featured/banner content** — that is already `/admin/featured`.
 *
 * Keep it small on purpose: §3.11.1 fixes scope to Clause 3, where "Platform
 * settings" is undefined, so anything elaborate here is scope creep rather than
 * delivery.
 *
 * SINGLETON, enforced by a fixed `_id` rather than a convention: `findOne()`
 * with no filter would happily return the second document someone inserted, and
 * two platform-settings rows is a class of bug that is very hard to see from the
 * UI. There is exactly one possible id, so a duplicate insert is a duplicate-key
 * error instead.
 */
export const SETTINGS_ID = 'platform';

const settingsSchema = new Schema(
  {
    _id: { type: String, default: SETTINGS_ID, enum: [SETTINGS_ID] },

    /**
     * Runtime override for the guest AI-search daily ceiling (§3.3).
     *
     * `null` = no override, in which case `AI_GUEST_DAILY_MAX` applies. The env
     * var is NOT retired by this field: `env.js` still refuses to boot a
     * production process without it, so there is always a ceiling in force even
     * before anyone opens this page, and a database that cannot be read falls
     * back to it rather than to "unlimited".
     */
    aiGuestDailyMax: { type: Number, min: 1, max: 1_000_000, default: null },

    /**
     * The support contact shown in transactional email and on the website.
     *
     * 🔴 This is also the fix for a live defect, not just a convenience: the
     * published Terms and Privacy pages both tell people to use "the contact
     * address published by MPX Global", and no address is published anywhere
     * (`docs/Client-Requests.md` §1.1). A privacy policy whose contact route is
     * circular is its one defect that matters.
     */
    supportEmail: { type: String, trim: true, lowercase: true, default: null },
    supportPhone: { type: String, trim: true, default: null },

    /*
     * ✅ Added 2026-09-25 (owner confirmed the D8 red alert: "Support hours,
     * Ticket auto-close days, Company footer details"). All display copy or an
     * operational number — none of the D8 exclusions below.
     */
    // "Mon–Sat, 10:00–18:00 IST" — shown beside the contact on Help and in email.
    supportHours: { type: String, trim: true, maxlength: 80, default: null },
    // Days a ticket waiting on the company stays open before it closes itself.
    // `null` = the built-in default (TICKET_AUTO_CLOSE_DAYS, 14).
    ticketAutoCloseDays: { type: Number, min: 3, max: 90, default: null },
    // Footer copy: the site footer and the foot of every email (name + address;
    // the LinkedIn link is website-only — platform emails carry no links).
    companyLegalName: { type: String, trim: true, maxlength: 120, default: null },
    companyAddress: { type: String, trim: true, maxlength: 300, default: null },
    companyLinkedinUrl: { type: String, trim: true, maxlength: 200, default: null },

    // Who last changed anything here. The full history is the AuditLog's job —
    // this is only so the screen can say "last changed by X" without a join.
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, minimize: false },
);

// PLATFORM: this is the one singleton that belongs to nobody's org — it carries
// no `orgId` and is reachable only through superadmin-gated routes. The scope
// registry has no "exempt" option on purpose (an undeclared model throws rather
// than querying unscoped), so the exemption has to be stated, not omitted.
declareScope(settingsSchema, SCOPE.PLATFORM);

export const Settings = mongoose.model('Settings', settingsSchema);
