import { Settings, SETTINGS_ID } from '../models/Settings.js';
import { TICKET_AUTO_CLOSE_DAYS } from '../models/enums.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { recordAudit } from './audit.service.js';

/**
 * D8 · Platform settings (§3.5) — read and write the single settings document.
 *
 * Read at request time, as decided: a single read on a string primary key is
 * about as cheap as Mongo gets, and a cached copy would mean the
 * Client changes a number in the UI and the platform keeps using the old one
 * for a while — exactly the confusion the page exists to remove.
 */

/** The shape the API and the screen agree on. Nothing here is ever a secret. */
function view(doc) {
  return {
    // `null` means "no override" — the effective value then comes from the env
    // floor, which `effectiveAiGuestDailyMax` resolves. The screen shows both so
    // nobody has to guess which one is winning.
    aiGuestDailyMax: doc?.aiGuestDailyMax ?? null,
    envAiGuestDailyMax: env.AI_GUEST_DAILY_MAX ?? null,
    supportEmail: doc?.supportEmail ?? null,
    supportPhone: doc?.supportPhone ?? null,
    supportHours: doc?.supportHours ?? null,
    ticketAutoCloseDays: doc?.ticketAutoCloseDays ?? null,
    defaultTicketAutoCloseDays: TICKET_AUTO_CLOSE_DAYS,
    companyLegalName: doc?.companyLegalName ?? null,
    companyAddress: doc?.companyAddress ?? null,
    companyLinkedinUrl: doc?.companyLinkedinUrl ?? null,
    updatedAt: doc?.updatedAt ?? null,
    updatedBy: doc?.updatedBy ? String(doc.updatedBy) : null,
  };
}

/**
 * The document, or null when nobody has saved settings yet.
 *
 * Deliberately does NOT create a row on read: a GET must not write, and an
 * absent document is a meaningful state ("never configured"), not an error.
 */
async function load() {
  // An explicit filter, not `findById` — the A6 lint guard bans `findById*` in
  // services because querying by id alone is how cross-tenant reads happen. It
  // is not a false positive to work around: this document simply has no tenant
  // (there is one row, one possible id, and a constant rather than user input),
  // so the honest form is the same explicit filter the rest of the codebase uses.
  return Settings.findOne({ _id: SETTINGS_ID });
}

export async function getSettings() {
  return view(await load());
}

/**
 * The support contact, for the PUBLIC surface (Step 1a, 2026-09-24) — the help
 * page, the portal/app support screens, the privacy page and email footers.
 *
 * 🔴 A deliberate WHITELIST. The rest of the settings document (the AI
 * ceiling, the auto-close days, who last edited it) is platform governance and
 * stays behind the superadmin route; widening this object widens a public
 * endpoint. Widened ONCE, consciously, on 2026-09-25 (owner-confirmed D8
 * additions): `hours`, and the `company` footer block — all published copy.
 *
 * Never throws: a failed read degrades to "not published" — a help page must
 * not 500 because the settings row is briefly unreachable.
 */
export async function getSupportContact() {
  try {
    const doc = await load();
    return {
      email: doc?.supportEmail ?? null,
      phone: doc?.supportPhone ?? null,
      hours: doc?.supportHours ?? null,
    };
  } catch (err) {
    logger.warn({ err: err?.message }, 'support contact read failed — serving none');
    return { email: null, phone: null, hours: null };
  }
}

/** The public footer block (site footer + email foot). Same never-throws rule. */
export async function getCompanyDetails() {
  try {
    const doc = await load();
    return {
      name: doc?.companyLegalName ?? null,
      address: doc?.companyAddress ?? null,
      linkedinUrl: doc?.companyLinkedinUrl ?? null,
    };
  } catch (err) {
    logger.warn({ err: err?.message }, 'company details read failed — serving none');
    return { name: null, address: null, linkedinUrl: null };
  }
}

/**
 * Days a ticket waiting on the company stays open. The override, else the
 * built-in 14. Never throws — a settings blip must not stop the nightly job or
 * a ticket screen; it falls back to the default.
 */
export async function effectiveTicketAutoCloseDays() {
  try {
    const doc = await load();
    if (doc?.ticketAutoCloseDays != null) return doc.ticketAutoCloseDays;
  } catch (err) {
    logger.warn({ err: err?.message }, 'settings unreadable — ticket auto-close uses the default');
  }
  return TICKET_AUTO_CLOSE_DAYS;
}

/**
 * The guest AI ceiling actually in force: the runtime override when one is set,
 * otherwise the env floor.
 *
 * 🔴 NEVER THROWS, and the fallback direction matters. `guestAiAllowed()` is a
 * SPEND control that fails closed, so this must not turn a database blip into
 * "no ceiling configured" (which reads as unlimited). On any read failure it
 * returns the env value — the floor `env.js` refuses to boot production
 * without — so the worst case is the ceiling the process started with, never
 * an absent one.
 */
export async function effectiveAiGuestDailyMax() {
  try {
    const doc = await load();
    if (doc?.aiGuestDailyMax != null) return doc.aiGuestDailyMax;
  } catch (err) {
    logger.warn(
      { err: { name: err?.name, message: err?.message } },
      'platform settings unreadable — falling back to AI_GUEST_DAILY_MAX',
    );
  }
  return env.AI_GUEST_DAILY_MAX ?? null;
}

/**
 * Apply a partial update. Superadmin-only at the route; platform governance is
 * never a grantable employee permission (CLAUDE.md Roles).
 *
 * 🔴 Every change writes an AuditLog entry — agreement §11.1 covers platform
 * settings under "administrative actions, recording the actor and the time".
 * The entry carries a before/after of ONLY the fields that actually moved, so
 * the log answers "who changed the AI ceiling, when, and from what" without
 * restating the whole document on every save.
 */
export async function updateSettings({ actor, patch, meta }) {
  const existing = await load();
  const current = view(existing);

  // Only fields the caller actually sent, and only where the value differs —
  // a no-op save must not write an audit entry claiming something changed.
  const FIELDS = [
    'aiGuestDailyMax',
    'supportEmail',
    'supportPhone',
    'supportHours',
    'ticketAutoCloseDays',
    'companyLegalName',
    'companyAddress',
    'companyLinkedinUrl',
  ];
  const before = {};
  const after = {};
  for (const f of FIELDS) {
    if (patch[f] === undefined) continue;
    const next = patch[f] === '' ? null : patch[f];
    if (next === current[f]) continue;
    before[f] = current[f];
    after[f] = next;
  }

  if (Object.keys(after).length === 0) return current;

  const doc = await Settings.findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $set: { ...after, updatedBy: actor.userId }, $setOnInsert: { _id: SETTINGS_ID } },
    { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

  await recordAudit({
    actor,
    action: 'settings.update',
    entityType: 'Settings',
    // 🔴 No `entityId`: `AuditLog.entityId` is an ObjectId and SETTINGS_ID is the
    // string 'platform', which would fail to cast and throw INSIDE the audit
    // write — turning a successful settings save into a 500 after the fact.
    // A platform-level action has no entity id, exactly as it has no orgId.
    before,
    after,
    meta,
  });

  return view(doc);
}
