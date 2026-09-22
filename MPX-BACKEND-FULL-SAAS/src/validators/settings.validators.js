import { z } from 'zod';

/**
 * D8 · Platform settings (§3.5).
 *
 * Every field is optional — the screen sends only what changed. An EMPTY BODY is
 * rejected rather than treated as a no-op save: it is always a client bug, and
 * accepting it silently would make a broken form look like it worked.
 *
 * 🔴 The field list here is the whole allowlist. `.strict()` is what keeps it
 * that way: the decided scope is the AI guest ceiling plus the support contact
 * (`docs/Note.md` D8), and an unknown key is refused rather than ignored — so a
 * future "just add one field" reaches this file and its reasoning first, instead
 * of quietly becoming a settings store for D1 caps, OTP knobs or a secret.
 */

// Empty string means "clear it" — the form sends '' when a field is emptied, and
// the service maps that to null. `null` is accepted for the same reason.
const clearable = (schema) => schema.or(z.literal('')).nullable().optional();

export const updateSettings = {
  body: z
    .object({
      /**
       * §3.3's ceiling. Integer, at least 1 — a ceiling of 0 would read as "no
       * guest AI at all", which is a product decision disguised as a number and
       * is not what this control is for. Clearing it (null) is how you go back
       * to the env floor.
       */
      aiGuestDailyMax: z.coerce.number().int().min(1).max(1_000_000).nullable().optional(),

      // Shown in transactional email and on the site. Not a login identity, so
      // no uniqueness and no verification — it is a published contact address.
      supportEmail: clearable(z.string().trim().toLowerCase().email().max(200)),

      // Free-form on purpose: international formats, extensions and "+91 " vary
      // enough that a regex here would reject valid numbers. It is display copy,
      // never dialled by the server.
      supportPhone: clearable(z.string().trim().max(40)),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, {
      message: 'Send at least one setting to change.',
    }),
};
